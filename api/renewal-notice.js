// Vercel serverless — /api/renewal-notice
// Public, token-gated self-serve NOTICE for a tenant: the "I don't wish to
// renew" button in the renewal reminder / auto-renew confirmation emails links
// to /give-notice/<token>, which reads the lease with GET and records the
// notice with POST. The token is a per-lease unguessable string (noticeToken).
//
//   GET  ?token=…            → { contract, unit, business, vacateDate, state }
//   POST { token, reason? }  → records the notice (renewalDeclined + noticeGiven
//                              + vacateDate); the daily reconcile cron ends and
//                              offboards the lease on the vacate date (step 3).
//
// Vacate date = the LATER of the current committed term end and today + the
// lease's noticePeriodMonths — so a fixed-term member serves out their term and
// a month-to-month member leaves after the required notice. Declining a lease
// that just auto-rolled (pendingRenewalApproval) rolls it back to its previous
// term end first.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const todayISO = () => new Date().toISOString().split('T')[0]
const addMonthsISO = (iso, months) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().split('T')[0]
}

// The committed-term end a notice should honour, and the earliest the notice
// period allows — vacate is the later of the two.
function computeVacate(lease) {
  const noticeMonths = Number(lease.noticePeriodMonths ?? 2)
  const earliest = addMonthsISO(todayISO(), noticeMonths)
  const committedEnd = (lease.pendingRenewalApproval && lease.previousEndDate)
    ? lease.previousEndDate
    : lease.endDate
  // Max ISO date wins; if there's no committed end (month-to-month), use earliest.
  return [earliest, committedEnd].filter(Boolean).sort().pop()
}

function leaseState(lease) {
  if (['expired', 'terminated', 'cancelled', 'voided'].includes(String(lease.status))) return 'ended'
  if (lease.noticeGiven || lease.renewalDeclined || lease.terminationScheduledFor) return 'noticed'
  return 'active'
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.method === 'GET' ? req.query?.token : req.body?.token
  if (!token) return res.status(400).json({ error: 'Missing token' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  try {
    const [{ data: leaseRows }, { data: spaceRows }, { data: tenantRows }, { data: settRows }] = await Promise.all([
      supabase.from('leases').select('id, data'),
      supabase.from('spaces').select('id, data'),
      supabase.from('tenants').select('id, data'),
      supabase.from('settings').select('data').eq('id', 'global'),
    ])
    const leaseRow = (leaseRows ?? []).find((r) => r.data?.noticeToken === token)
    if (!leaseRow) return res.status(404).json({ error: 'This link is no longer valid.' })
    const lease = leaseRow.data
    const space = (spaceRows ?? []).map((r) => r.data).find((s) => s.id === lease.spaceId)
    const tenant = (tenantRows ?? []).map((r) => r.data).find((t) => t.id === lease.tenantId)
    const settings = settRows?.[0]?.data ?? {}

    const preview = {
      contract: lease.contractNumber ?? lease.id,
      unit: space?.unitNumber ?? '',
      business: tenant?.businessName ?? '',
      vacateDate: computeVacate(lease),
      noticeMonths: Number(lease.noticePeriodMonths ?? 2),
      state: leaseState(lease),
    }

    if (req.method === 'GET') return res.status(200).json(preview)

    // ── POST: record the notice ────────────────────────────────────────────
    if (preview.state === 'ended') return res.status(400).json({ error: 'This membership has already ended.', ...preview })
    if (preview.state === 'noticed') return res.status(200).json({ ok: true, alreadyNoticed: true, ...preview })

    const reason = String(req.body?.reason ?? '').slice(0, 500)
    const vacateDate = preview.vacateDate
    const now = new Date().toISOString()
    const patch = {
      ...lease,
      noticeGiven: true,
      noticeDate: todayISO(),
      vacateDate,
      terminationScheduledFor: vacateDate,
      terminationReason: 'Tenant notice — did not renew',
      terminationComments: reason || 'Notice given by the tenant via the renewal email.',
      renewalDeclined: true,
      // If a renewal had just auto-rolled and was awaiting approval, giving
      // notice cancels it: drop back to the previously committed end date.
      ...(lease.pendingRenewalApproval && lease.previousEndDate
        ? { endDate: lease.previousEndDate, pendingRenewalApproval: false }
        : {}),
      noticeSource: 'renewal-email',
      noticedAt: now,
    }
    await supabase.from('leases').upsert({ id: leaseRow.id, data: patch, updated_at: now })

    // Admin heads-up so a self-serve departure never goes unseen.
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const { sendResendEmail } = await import('./_email.js')
        const { brandFrame, bKicker, bH1, bP, bSmall, bTable } = await import('./_brand.js')
        const notif = [...new Set(['eric@hexaspace.com.au', 'info@hexaspace.com.au', settings?.emails?.notificationEmail].filter(Boolean).map((e) => e.toLowerCase()))]
        const inner =
          bKicker('Notice Received') +
          bH1('A tenant gave notice') +
          bP(`${preview.business || 'A member'} gave notice via the renewal email — they will not be renewing.`) +
          bTable([
            ['Business', preview.business || '—', true],
            ['Contract', preview.contract, true],
            ['Space', preview.unit || '—', true],
            ['Last day (vacate)', vacateDate, true],
            ['Reason', reason || '—', true],
          ]) +
          bSmall('The reconcile cron will end and offboard the contract on the vacate date. Review it under Renewals / Contracts.')
        await sendResendEmail({
          from: 'Hexa Space <info@hexaspace.com.au>',
          to: notif,
          subject: `Notice given — ${preview.business || preview.contract} (last day ${vacateDate})`,
          html: brandFrame(inner, { footerLabel: 'Operations' }),
        }).catch(() => {})
      } catch { /* admin email is best-effort */ }
    }

    return res.status(200).json({ ok: true, ...preview, vacateDate })
  } catch (err) {
    console.error('renewal-notice error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please email info@hexaspace.com.au.' })
  }
}
