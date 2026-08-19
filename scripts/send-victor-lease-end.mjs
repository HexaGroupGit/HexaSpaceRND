// One-off: end-of-lease confirmation + outstanding balance for Victor Group
// Holdings (tc80), bilingual EN/中文. Dry-run by default.
//   node scripts/send-victor-lease-end.mjs           # preview
//   node scripts/send-victor-lease-end.mjs --apply
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v

const { createClient } = await import('@supabase/supabase-js')
const { brandFrame, bKicker, bH1, bP, bSmall } = await import('../api/_brand.js')

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: sRow } = await sb.from('settings').select('data').eq('id', 'global').single()
const settings = sRow?.data ?? {}
const b = settings.billing ?? {}

const TO = ['1401226971@qq.com']
const CC = ['jayzx093302@gmail.com']
const TENANT_ID = 'tc98_placeholder'

// Pull the live figures rather than hard-coding them.
const { data: iRows } = await sb.from('invoices').select('id,data')
const owing = (iRows ?? []).map(r => r.data)
  .filter(i => i.tenantId === 'tc80' && i.status === 'overdue')
  .sort((a, b2) => String(a.issueDate).localeCompare(String(b2.issueDate)))
  .map(i => {
    const sub = (i.lineItems ?? []).reduce((s, l) => s + Number(l.unitPrice ?? 0) * Number(l.qty ?? 1) * (1 - Number(l.discountPct ?? 0) / 100), 0)
    const total = i.vatEnabled !== false ? Math.round(sub * 1.1 * 100) / 100 : Math.round(sub * 100) / 100
    const paid = (i.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0)
    return { number: i.number, issue: i.issueDate, due: i.dueDate, owing: Math.round((total - paid) * 100) / 100 }
  })
const totalOwing = owing.reduce((s, r) => s + r.owing, 0)
const money = (v) => `$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
const dmy = (d) => { const [y, m, dd] = String(d).split('-'); return `${dd}/${m}/${y}` }

const HAIR = '#e3e1e6', MUTE = '#6b6b6b', INK = '#1a1a1a'
const SANS = "'HexaGT','Helvetica Neue',Arial,sans-serif"
const rows = owing.map(r => `<tr>
  <td style="padding:9px 0;border-bottom:1px solid ${HAIR};font-family:${SANS};font-size:13px;color:${INK}">${r.number}</td>
  <td style="padding:9px 0;border-bottom:1px solid ${HAIR};font-family:${SANS};font-size:12px;color:${MUTE}">due ${dmy(r.due)}</td>
  <td style="padding:9px 0;border-bottom:1px solid ${HAIR};font-family:${SANS};font-size:13px;color:${INK};text-align:right">${money(r.owing)}</td></tr>`).join('')

const bank = `<table style="width:100%;border-collapse:collapse;margin:6px 0 20px;background:#faf9f7">
  ${[['Account Name', b.businessName || 'Hexa Space Pty Ltd'], ['Bank', b.bankName || ''], ['BSB', String(b.bsb || '').replace(/^(\d{3})(\d{3})$/, '$1-$2')], ['Account', b.acc || ''], ['Reference', owing.map(r => r.number).join(' / ')]]
    .map(([k, v]) => `<tr><td style="padding:8px 14px;font-family:${SANS};font-size:12px;color:${MUTE}">${k}</td><td style="padding:8px 14px;font-family:${SANS};font-size:13px;color:${INK};font-weight:600">${v}</td></tr>`).join('')}
</table>`

const inner =
  bKicker('End of lease') +
  bH1('Suite 8 — lease ends 31 July 2026') +
  bP('Dear Victor Group Holdings,') +
  bP('We confirm that your lease for <strong>Suite 8</strong> at Hexa Space will end on <strong>31 July 2026</strong>.') +
  bP('Before we can close out your account, the following invoices remain outstanding:') +
  `<table style="width:100%;border-collapse:collapse;margin:4px 0 8px">${rows}
    <tr><td style="padding:11px 0;font-family:${SANS};font-size:13px;font-weight:600;color:${INK}">Total</td><td></td>
    <td style="padding:11px 0;font-family:${SANS};font-size:17px;font-weight:600;color:${INK};text-align:right">${money(totalOwing)} AUD</td></tr></table>` +
  bSmall('Amounts include GST.') +
  bP('We ask that this balance is settled <strong>today</strong>. Once payment has been made, please send your remittance advice to <a href="mailto:info@hexaspace.com.au">info@hexaspace.com.au</a> so we can match it against your account.') +
  bP('<strong>Payment details</strong>') + bank +
  bP('<strong>Please note:</strong> if the balance remains unpaid as at today’s date, the following month (August 2026) will also be invoiced.') +
  `<hr style="border:none;border-top:1px solid ${HAIR};margin:26px 0">` +
  bP('尊敬的 Victor Group Holdings：') +
  bP('兹确认，贵公司承租的 Hexa Space <strong>Suite 8</strong> 租约将于 <strong>2026年7月31日</strong> 正式终止。') +
  bP('在为贵公司结清账户之前，目前仍有以下账单尚未支付，合计 <strong>' + money(totalOwing) + ' 澳元（含GST）</strong>：') +
  `<table style="width:100%;border-collapse:collapse;margin:4px 0 12px">${owing.map(r => `<tr>
      <td style="padding:9px 0;border-bottom:1px solid ${HAIR};font-family:${SANS};font-size:13px;color:${INK}">${r.number}</td>
      <td style="padding:9px 0;border-bottom:1px solid ${HAIR};font-family:${SANS};font-size:12px;color:${MUTE}">到期日 ${dmy(r.due)}</td>
      <td style="padding:9px 0;border-bottom:1px solid ${HAIR};font-family:${SANS};font-size:13px;color:${INK};text-align:right">${money(r.owing)}</td></tr>`).join('')}</table>` +
  bP('烦请于<strong>今日内</strong>完成付款。付款后，请将付款水单（remittance advice）发送至 <a href="mailto:info@hexaspace.com.au">info@hexaspace.com.au</a>，以便我们及时核对入账。银行账户信息如上表所示，付款备注请填写账单编号。') +
  bP('<strong>特此提醒：</strong>如今日仍未收到款项，我们将继续开具下一个月（2026年8月）的账单。') +
  bSmall('Hexa Space Pty Ltd · ABN ' + (b.abn || '') + ' · ' + (b.address || ''))

const subject = `End of lease — Suite 8, 31 July 2026 · Outstanding ${money(totalOwing)} | 租约终止确认及未付款项`
const html = brandFrame(inner, { footerLabel: 'Accounts' })

console.log(`to:      ${TO.join(', ')}`)
console.log(`cc:      ${CC.join(', ')}`)
console.log(`subject: ${subject}`)
console.log('invoices:')
for (const r of owing) console.log(`   ${r.number}  issued ${dmy(r.issue)}  due ${dmy(r.due)}  ${money(r.owing)}`)
console.log(`total:   ${money(totalOwing)}`)
console.log(`bank:    ${b.businessName} · ${b.bankName} · BSB ${String(b.bsb).replace(/^(\d{3})(\d{3})$/, '$1-$2')} · ${b.acc}`)

if (!APPLY) { console.log('\nDRY RUN — nothing sent. Re-run with --apply.'); process.exit(0) }

const fromName = settings?.emails?.fromName || 'Hexa Space'
const fromEmail = settings?.emails?.fromEmail || 'noreply@hexaspace.com.au'
const r = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: `${fromName} <${fromEmail}>`, to: TO, cc: CC,
    reply_to: settings?.emails?.replyTo || 'info@hexaspace.com.au',
    subject, html,
  }),
})
const j = await r.json().catch(() => ({}))
if (!r.ok) { console.error('SEND FAILED:', JSON.stringify(j)); process.exit(1) }
console.log(`\nSENT — Resend id ${j.id}`)

const logId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
await sb.from('email_log').insert({
  id: logId,
  data: { id: logId, tenantId: 'tc80', emailType: 'lease_end_balance', to: TO.join(', '), subject, sentAt: new Date().toISOString(), hasAttachment: false },
})
console.log('logged to email_log')
