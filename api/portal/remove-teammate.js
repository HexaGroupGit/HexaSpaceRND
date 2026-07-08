// POST /api/portal/remove-teammate  { memberId }
// A member removes a teammate from their own company via the portal. This is a
// full offboard in one call: the member record is marked Former with portal
// access off, their Supabase login is banned, and Salto door access is revoked
// (Zapier remove_user hook, or an ops-task email when the hook isn't wired).
// Guardrails: only the company's contact person or billing person may remove
// teammates, you can't remove yourself, and the billing person can only be
// removed by an admin (so companies can't orphan their own billing contact).
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH1, bP, bSmall, bTable } from '../_brand.js'
import { requireMember, isAdminEmail } from '../_auth.js'

export const config = { maxDuration: 60 }

async function banAuthUser(sb, email) {
  // Admin API has no direct email lookup — page through users (bounded).
  const target = String(email).toLowerCase()
  let user = null
  for (let page = 1; page <= 20 && !user; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return { ok: false, note: error.message }
    user = (data?.users ?? []).find((u) => u.email?.toLowerCase() === target) ?? null
    if ((data?.users ?? []).length < 200) break
  }
  if (!user) return { ok: true, note: 'No auth user found' } // invite never claimed
  const { error } = await sb.auth.admin.updateUserById(user.id, { ban_duration: '87600h' }) // ~10 years
  return error ? { ok: false, note: error.message } : { ok: true }
}

async function revokeSalto(member, removedBy) {
  const webhook = process.env.SALTO_REVOKE_WEBHOOK
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_user',
          email: member.email ?? null,
          saltoUserId: member.saltoUserId ?? null,
          source: 'hexaspace-platform',
        }),
      })
      if (r.ok) return { zapier: true, queued: true }
    } catch (err) {
      console.error('Salto Zapier revoke failed (portal removal):', err)
    }
  }
  // Hook missing or failed — raise an ops task so the removal never silently drops.
  const inner =
    bKicker('Door Access Task') +
    bH1('Remove member from Salto KS') +
    bP('A company removed this team member via the member portal. Their portal access is already revoked — please also remove (or block) the user in the Salto KS portal: Users → find the user → remove.') +
    bTable([
      ['Name', member.name ?? '—', true],
      ['Email', member.email ?? '—', true],
      ['Removed by', removedBy, true],
    ]) +
    bSmall('Automated task from the member platform. This step goes away once the Salto KS Zapier connector is live.')
  await sendResendEmail({
    from: 'Hexa Space <noreply@hexaspace.com.au>',
    to: 'info@hexaspace.com.au',
    subject: `Salto task — REMOVE ${member.name ?? member.email}`,
    html: brandFrame(inner, { footerLabel: 'Operations' }),
  }).catch(() => {})
  return { opsTasked: true }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireMember(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb
  const isAdmin = await isAdminEmail(sb, auth.user.email)

  const { memberId } = req.body ?? {}
  if (!memberId) return res.status(400).json({ error: 'memberId is required.' })

  try {
    const { data: rows } = await sb.from('members').select('id, data').eq('id', memberId)
    const member = rows?.[0]?.data
    if (!member) return res.status(404).json({ error: 'Team member not found.' })

    if (!isAdmin && member.companyId !== auth.companyId) {
      return res.status(403).json({ error: 'You can only remove teammates from your own company.' })
    }
    if (!isAdmin) {
      // Only the company's contact person or billing person may remove teammates.
      const { data: mineRows } = await sb.from('members').select('data')
      const caller = (mineRows ?? []).map((r) => r.data).find(
        (m) => m.companyId === auth.companyId && (m.email || '').toLowerCase() === auth.user.email,
      )
      if (!caller?.contactPerson && !caller?.billingPerson) {
        return res.status(403).json({ error: 'Only your company\'s contact or billing person can remove team members.' })
      }
    }
    if ((member.email || '').toLowerCase() === auth.user.email) {
      return res.status(400).json({ error: "You can't remove yourself. Ask a teammate, or contact us." })
    }
    if (member.billingPerson && !isAdmin) {
      return res.status(400).json({ error: 'The billing contact can only be removed by Hexa Space — email info@hexaspace.com.au and we\'ll sort it.' })
    }

    const now = new Date().toISOString()
    const updated = {
      ...member,
      status: 'Former',
      portalAccess: false,
      removedAt: now,
      removedBy: auth.user.email,
      removedVia: 'portal-team',
    }
    const { error: upErr } = await sb.from('members').update({ data: updated, updated_at: now }).eq('id', memberId)
    if (upErr) return res.status(500).json({ error: upErr.message })

    // Best-effort side effects — the member record is already off; report what ran.
    const [login, salto] = await Promise.all([
      member.email ? banAuthUser(sb, member.email) : Promise.resolve({ ok: true, note: 'No email on record' }),
      revokeSalto(member, auth.user.email),
    ])

    return res.status(200).json({ removed: true, login, salto })
  } catch (err) {
    console.error('remove-teammate error:', err)
    return res.status(500).json({ error: 'Could not remove the team member.' })
  }
}
