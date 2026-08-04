// GET /api/papercut/member-status[?email=someone@example.com]
// The admin portal's view of printing set-up, per member: do they have a portal
// password (their Mobility Print sign-in), and what PIN have they been allocated.
// Powers Settings → PaperCut and the Printing card on a member's profile, so staff
// can answer "what's my PIN?" at the front desk and see who still can't sign in.
//
// ADMIN ONLY — a PIN is a credential. Unlike the aggregate /api/papercut/status
// this returns real PINs, so it is gated by requireAdmin (verified Supabase JWT +
// the admins allow-list), NOT by the shared sync token and not open like status.
// Members read their OWN pin through /api/portal/print-pin instead; nothing here
// is reachable from a member session.
//
// Password status comes from the SECURITY DEFINER fn papercut_has_password — a
// boolean per email, never a hash. See docs/papercut-integration.md.

import { selectAllRows } from '../_db.js'
import { applyCors } from '../_cors.js'
import { requireAdmin } from '../_auth.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await requireAdmin(req)
  if (gate.error) return res.status(gate.status).json({ error: gate.error })
  const supabase = gate.sb

  const only = typeof req.query?.email === 'string' ? req.query.email.trim().toLowerCase() : ''

  let members, tenants, pinRows
  try {
    ;[members, tenants] = await Promise.all([
      selectAllRows(supabase, 'members').then((r) => r.map((x) => x.data)),
      selectAllRows(supabase, 'tenants').then((r) => r.map((x) => x.data)),
    ])
    const { data, error } = await supabase
      .from('member_pins')
      .select('email, pin, balance, updated_at, balance_updated_at')
    if (error) throw error
    pinRows = data ?? []
  } catch (err) {
    console.error('PaperCut member-status load error:', err.message)
    return res.status(500).json({ error: 'Failed to load member print status.' })
  }

  const companyName = (id) => tenants.find((t) => t.id === id)?.businessName || ''
  const byEmail = new Map(pinRows.filter((r) => r?.email).map((r) => [String(r.email).toLowerCase(), r]))

  // Same active-member definition the provisioning roster uses, so the two views
  // never disagree about who is supposed to have a printing account.
  const isSeed = (m) => /^demo_co/i.test(m.companyId || '') || /(^|\.)demo@|@example\./i.test(m.email || '')
  const seen = new Set()
  let list = members
    .filter((m) => m?.email && m.portalAccess !== false && !isSeed(m))
    .map((m) => ({
      email: String(m.email).toLowerCase(),
      name: m.name || m.email,
      companyId: m.companyId || '',
      companyName: companyName(m.companyId),
    }))
    .filter((m) => (seen.has(m.email) ? false : (seen.add(m.email), true)))

  if (only) list = list.filter((m) => m.email === only)

  // Portal password per member. If the fn isn't installed, report null (unknown)
  // rather than failing the whole view.
  const pwByEmail = new Map()
  let passwordCheck = 'ok'
  try {
    const emails = list.map((m) => m.email)
    for (let i = 0; i < emails.length; i += 500) {
      const { data, error } = await supabase.rpc('papercut_has_password', { emails: emails.slice(i, i + 500) })
      if (error) throw error
      for (const r of data ?? []) pwByEmail.set(String(r.email).toLowerCase(), !!r.has_password)
    }
  } catch (err) {
    console.error('PaperCut member-status password check failed:', err.message)
    passwordCheck = 'unavailable'
  }

  const rows = list.map((m) => {
    const p = byEmail.get(m.email)
    return {
      ...m,
      pin: p?.pin ?? null,
      balance: p?.balance ?? null,
      pinUpdatedAt: p?.updated_at ?? null,
      balanceUpdatedAt: p?.balance_updated_at ?? null,
      hasPassword: passwordCheck === 'ok' ? (pwByEmail.get(m.email) ?? false) : null,
    }
  })

  // "Ready" = can complete the whole flow: sign in to Mobility Print with their
  // portal password AND release at the copier with their own PIN.
  return res.status(200).json({
    passwordCheck,
    members: rows.sort((a, b) => a.name.localeCompare(b.name)),
    summary: {
      total: rows.length,
      withPin: rows.filter((r) => r.pin).length,
      withPassword: rows.filter((r) => r.hasPassword === true).length,
      ready: rows.filter((r) => r.pin && r.hasPassword === true).length,
    },
  })
}
