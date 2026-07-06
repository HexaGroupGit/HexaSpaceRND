// GET /api/papercut/members
// Serves the active Hexa member roster to the on-prem provisioning script
// (scripts/papercut-connector/provision-members.mjs), which creates/updates the
// matching PaperCut users — the OfficeRnD model (companies → groups, members →
// users, PIN identity, no password copy). See docs/papercut-integration.md.
//
// Auth: shared PAPERCUT_SYNC_TOKEN (Authorization: Bearer <token>), same as the
// other PaperCut endpoints. Read-only; returns no secrets beyond PINs already
// assigned (needed so the provisioner avoids PIN collisions when generating new ones).

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
    // member_pins is service-role only; used so the provisioner avoids collisions.
    const { data } = await supabase.from('member_pins').select('pin')
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

  const usedPins = pinRows.map((r) => String(r.pin)).filter(Boolean)

  return res.status(200).json({ members: roster, usedPins })
}
