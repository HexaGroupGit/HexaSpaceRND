// One-off: Earth Power Co (Tiani O'Neill) CON-227 auto-rolled on 27/10/2026 to a
// fixed end of 24/06/2027. It renews month-to-month instead, at Eric's direction.
//
// endDate is cleared, not kept: api/renewal-notice.js vacates at the LATER of the
// notice date and endDate, so a leftover 2027 date would hold her to June 2027
// even with contractType Month-to-month. Open-ended leases bill every month and
// never auto-roll. noticePeriodMonths is deliberately left as it is.
//
// Dry-run by default; pass --apply to write and send.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '../api/_email.js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter((l) => l && !l.trimStart().startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')] }))
for (const k of ['RESEND_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) process.env[k] ??= env[k]
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Guards: sends must really reach her, and the lease must be as last read.
const { data: st } = await sb.from('settings').select('data').eq('id', 'global').single()
if (st?.data?.emails?.safeMode !== false) throw new Error('GUARD: safeMode is not false')
const { data: row, error } = await sb.from('leases').select('data').eq('id', 'CON-227').single()
if (error) throw error
const lease = row.data
if (lease.status !== 'active' || lease.endDate !== '2027-06-24' || lease.noticeGiven || Number(lease.monthlyRent) !== 1227.27) {
  throw new Error(`GUARD: CON-227 changed: ${lease.status} ${lease.endDate} ${lease.monthlyRent} notice=${lease.noticeGiven}`)
}

const note = '[04/11/2026 — renewed month-to-month per Eric; auto-roll end date 24/06/2027 removed]'
const patch = { endDate: '', contractType: 'Month-to-month', notes: [lease.notes, note].filter(Boolean).join(' ') }

const P = (t) => `<p style="margin:0 0 14px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#1a1a1a">${t}</p>`
const html = `<div style="max-width:560px;padding:8px 2px">
${P('Hi Tiani,')}
${P('A quick update on your membership for <strong>Suite 18</strong> (CON-227). It has renewed on a <strong>month-to-month</strong> basis, so there is no longer a fixed end date.')}
${P('Our automated renewal email on 28/10/2026 said your membership runs through 24/06/2027. Please disregard that date &mdash; you are not committed to that term.')}
${P('Your rate stays the same at <strong>$1,227.27 + GST per month</strong>, and the membership continues until notice is given under your agreement. There is nothing you need to do.')}
${P('If you have any questions, just reply to this email.')}
${P('Best regards,<br>Eric<br>Hexa Space &middot; 402/830 Whitehorse Road, Box Hill VIC 3128')}
</div>`
const subject = 'Your Suite 18 membership — now month-to-month'

console.log('CON-227', lease.startDate, lease.endDate, '->', JSON.stringify(patch))
console.log('To: tiani@earthpowerco.com.au |', subject)
if (!APPLY) { console.log('DRY RUN - pass --apply.'); process.exit(0) }

writeFileSync('con-227-mtm-backup.json', JSON.stringify(lease, null, 2))
const { error: upErr } = await sb.from('leases').update({ data: { ...lease, ...patch }, updated_at: new Date().toISOString() }).eq('id', 'CON-227')
if (upErr) throw upErr
const { data: after } = await sb.from('leases').select('data').eq('id', 'CON-227').single()
if (after.data.endDate !== '' || after.data.contractType !== 'Month-to-month') throw new Error('Write did not stick; email NOT sent')
console.log('Lease updated.')

const res = await sendResendEmail({
  from: 'Eric at Hexa Space <info@hexaspace.com.au>',
  to: 'tiani@earthpowerco.com.au',
  replyTo: 'eric@hexaspace.com.au',
  bcc: ['eric@hexaspace.com.au'],
  subject,
  html,
})
if (!res?.ok || res.skipped) throw new Error(`send failed: ${res?.reason ?? res?.error ?? 'unknown'}`)
console.log('Sent to tiani@earthpowerco.com.au (bcc eric@).', JSON.stringify(res))
