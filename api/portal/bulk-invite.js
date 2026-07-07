// POST /api/portal/bulk-invite — sends the portal-migration announcement +
// password-setup invite to every ACTIVE member and active-company contact.
// Admin only. Body: { dryRun?: boolean, limit?: number, resend?: boolean }
//
// - dryRun: returns the recipient list without creating users or sending.
// - limit (default 20): recipients per call — the button loops until
//   remaining === 0, keeping each call inside the serverless timeout.
// - resend: include people already stamped portalMigrationInvitedAt.
//
// Every send goes through invitePortalUser → sendResendEmail, so SAFE MODE
// applies: while it's on, all invites redirect to the test recipient.

import { requireAdmin } from '../_auth.js'
import { selectAllRows } from '../_db.js'
import { invitePortalUser } from '../_invite.js'
import { SANS, INK } from '../_brand.js'

// A batch of 20 (createUser + link + email each) runs well past Vercel's 10s
// default — give the function a real budget so batches complete.
export const config = { maxDuration: 60 }

const SUBJECT = 'Your new Hexa Space member portal is ready'
const HEADING = "We're moving to a new member portal"
const INTRO = 'Hexa Space is upgrading to our own member portal at <strong>portal.hexaspace.com.au</strong>. It replaces the old members site and becomes your home for everything to do with your membership. Your membership, invoices and booking history are already in place — your login is this email address, you just need to set a password.'
const CTA = 'Set up your password'
const li = (t) => `<div style="font-family:${SANS};font-size:13px;line-height:1.9;color:${INK}">— &nbsp;${t}</div>`
const PANEL = `<div style="background:#EFEDF2;border-radius:8px;padding:16px 18px;margin:0 0 18px">${
  li('View and pay invoices online — card or bank transfer') +
  li('Book meeting rooms and event spaces') +
  li('Request fobs, remotes and after-hours access') +
  li('Add or remove your team members') +
  li('Message our team directly')
}</div>`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = await requireAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const { sb } = auth

  const { dryRun = false, limit = 20, resend = false } = req.body ?? {}

  const [tenantRows, leaseRows, memberRows] = await Promise.all([
    selectAllRows(sb, 'tenants'), selectAllRows(sb, 'leases'), selectAllRows(sb, 'members'),
  ])
  const tenants = tenantRows.map((r) => r.data)
  const leases = leaseRows.map((r) => r.data)
  const members = memberRows.map((r) => r.data)

  const today = new Date().toISOString().split('T')[0]
  const activeCompanyIds = new Set(
    leases.filter((l) => l.status === 'active' && (l.endDate ?? '9999') >= today).map((l) => l.tenantId)
  )

  // Recipient = every member of an active company + the company's own contact,
  // deduped by email. Each carries the source rows so we can stamp them sent.
  const byEmail = new Map()
  const addRecipient = (email, name, company, stamp) => {
    const e = String(email ?? '').trim().toLowerCase()
    if (!e || !e.includes('@')) return
    const r = byEmail.get(e) ?? { email: e, name: name ?? '', company: company ?? '', stamps: [], invited: false }
    r.name = r.name || name || ''
    r.stamps.push(stamp)
    if (stamp.row.portalMigrationInvitedAt) r.invited = true
    byEmail.set(e, r)
  }
  for (const m of members) {
    if (!activeCompanyIds.has(m.companyId)) continue
    const company = tenants.find((t) => t.id === m.companyId)
    addRecipient(m.email, m.name, company?.businessName, { table: 'members', row: m })
  }
  for (const t of tenants) {
    if (!activeCompanyIds.has(t.id)) continue
    addRecipient(t.email, t.contactName, t.businessName, { table: 'tenants', row: t })
  }

  const all = [...byEmail.values()]
  const pending = all.filter((r) => resend || !r.invited)

  if (dryRun) {
    return res.status(200).json({
      dryRun: true,
      totalRecipients: all.length,
      alreadyInvited: all.length - pending.length,
      toSend: pending.length,
      sample: pending.slice(0, 10).map((r) => ({ email: r.email, name: r.name, company: r.company })),
    })
  }

  const batch = pending.slice(0, Math.max(1, Math.min(50, limit)))
  const sent = [], failed = []
  for (const r of batch) {
    const firstName = (r.name ?? '').trim().split(/\s+/)[0] || 'there'
    const out = await invitePortalUser({
      email: r.email,
      subject: SUBJECT,
      heading: HEADING,
      greeting: `Hi ${firstName},`,
      intro: INTRO,
      extraHtml: PANEL,
      ctaLabel: CTA,
      footerLabel: 'Member Portal',
    })
    if (!out.ok) { failed.push({ email: r.email, error: out.error }); continue }
    sent.push(r.email)
    const at = new Date().toISOString()
    for (const s of r.stamps) {
      s.row.portalMigrationInvitedAt = at
      await sb.from(s.table).upsert({ id: s.row.id, data: s.row, updated_at: at })
    }
  }

  return res.status(200).json({
    sent,
    failed,
    remaining: pending.length - batch.length + failed.length,
    totalRecipients: all.length,
  })
}
