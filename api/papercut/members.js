// GET /api/papercut/members
// Serves the active Hexa member roster to the on-prem provisioning script
// (scripts/papercut-connector/provision-members.mjs), which creates/updates the
// matching PaperCut users — the OfficeRnD model (companies → groups, members →
// users, PIN identity, no password copy). See docs/papercut-integration.md.
//
// Each roster row carries the three things the provisioner needs to set a member
// up end-to-end:
//   email        — the identity everywhere (portal login, PaperCut email, match key)
//   hasPassword  — does this member have a PORTAL password? After the Phase 5 auth
//                  switch that password IS their Mobility Print sign-in, so a member
//                  without one gets an account + PIN but can't log in to the client
//                  until they set it. Read via the SECURITY DEFINER fn
//                  papercut_has_password — a boolean only, never a hash.
//   pin          — the PIN Hexa already has on record for them, so the provisioner
//                  RESTORES the member's existing number rather than issuing a new
//                  one if the PaperCut user was recreated or lost its card.
//
// Auth: shared PAPERCUT_SYNC_TOKEN (Authorization: Bearer <token>), same as the
// other PaperCut endpoints. Read-only; returns no secrets beyond PINs already
// assigned (needed so the provisioner keeps numbers stable and avoids collisions).

import { createClient } from '@supabase/supabase-js'
import { selectAllRows } from '../_db.js'
import { applyCors } from '../_cors.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.PAPERCUT_SYNC_TOKEN
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured.' })

  if (token) {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (bearer !== token) return res.status(401).json({ error: 'Invalid PaperCut sync token.' })
  } else {
    // No token set yet → don't leak the roster. Mirror the mock stance of the others.
    return res.status(200).json({ mock: true, members: [], usedPins: [], note: 'PAPERCUT_SYNC_TOKEN not set — roster withheld.' })
  }

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let members, tenants, pinRows
  try {
    ;[members, tenants] = await Promise.all([
      selectAllRows(supabase, 'members').then((r) => r.map((x) => x.data)),
      selectAllRows(supabase, 'tenants').then((r) => r.map((x) => x.data)),
    ])
    // member_pins is service-role only; used so the provisioner keeps each
    // member's existing number and avoids collisions when generating new ones.
    const { data } = await supabase.from('member_pins').select('email, pin')
    pinRows = data ?? []
  } catch (err) {
    console.error('PaperCut roster load error:', err)
    return res.status(500).json({ error: 'Failed to load roster.' })
  }

  const companyName = (id) => tenants.find((t) => t.id === id)?.businessName || ''

  // Active = has an email and not explicitly offboarded. (portalAccess === false is
  // set when a membership ends — see MobileApp gate.) Exclude seed/demo rows whose
  // companyId is demo_co* — these are sample data, must never reach PaperCut.
  const isSeed = (m) => /^demo_co/i.test(m.companyId || '') || /(^|\.)demo@|@example\./i.test(m.email || '')
  const seen = new Set()
  const roster = members
    .filter((m) => m?.email && m.portalAccess !== false && !isSeed(m))
    .map((m) => ({
      email: String(m.email).toLowerCase(),
      fullName: m.name || m.email,
      companyId: m.companyId || '',
      companyName: companyName(m.companyId),
    }))
    // Dedupe by email — the members table can list the same person more than once.
    .filter((m) => (seen.has(m.email) ? false : (seen.add(m.email), true)))

  // The PIN Hexa already holds for each email → the provisioner reuses it instead
  // of issuing a new number when PaperCut has none (recreated/lost card), so a
  // member's PIN stays the same one they've been shown in the app all along.
  const pinByEmail = new Map(
    pinRows.filter((r) => r?.email && r?.pin).map((r) => [String(r.email).toLowerCase(), String(r.pin)]),
  )

  // Portal password status, batched. If the SECURITY DEFINER fn isn't installed
  // yet, report `null` (unknown) rather than failing — provisioning must not be
  // blocked by the readiness check, it just loses the warning.
  const pwByEmail = new Map()
  let passwordCheck = 'ok'
  try {
    const emails = roster.map((m) => m.email)
    for (let i = 0; i < emails.length; i += 500) {
      const { data, error } = await supabase.rpc('papercut_has_password', { emails: emails.slice(i, i + 500) })
      if (error) throw error
      for (const r of data ?? []) pwByEmail.set(String(r.email).toLowerCase(), !!r.has_password)
    }
  } catch (err) {
    console.error('PaperCut roster password check failed:', err.message)
    passwordCheck = 'unavailable'
  }

  const rows = roster.map((m) => ({
    ...m,
    pin: pinByEmail.get(m.email) ?? null,
    hasPassword: passwordCheck === 'ok' ? (pwByEmail.get(m.email) ?? false) : null,
  }))

  // Every PIN in use anywhere, so a generated one can't collide with a member's.
  const usedPins = pinRows.map((r) => String(r.pin)).filter(Boolean)

  return res.status(200).json({
    members: rows,
    usedPins,
    passwordCheck,
    summary: {
      total: rows.length,
      withPin: rows.filter((m) => m.pin).length,
      withPassword: rows.filter((m) => m.hasPassword === true).length,
      withoutPassword: rows.filter((m) => m.hasPassword === false).length,
    },
  })
}
