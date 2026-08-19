// One-off: charge specific overdue invoices against the saved card immediately,
// at Eric's explicit direction (27 Jul 2026). Uses the SAME code path as the
// admin "Charge saved card" button and the overdue cron — chargeInvoiceOffSession
// — so the invoice is marked paid, a payment is recorded, and a receipt is sent.
//
// NOTE: this deliberately bypasses the 2-business-day notice in the card
// authority text (src/lib/cardAuthority.js). That was an explicit decision;
// the normal path is to let api/overdue-reminders.js send notice first.
//
//   node scripts/charge-overdue-now.mjs           # dry run
//   node scripts/charge-overdue-now.mjs --apply
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const TARGETS = ['INV-3018', 'INV-2925'] // Mynt.Media, AC Bridge International Group

// Env must be in process.env BEFORE the api/* modules load.
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n')
  .filter(l => l && !l.trimStart().startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v

const { createClient } = await import('@supabase/supabase-js')
const { chargeInvoiceOffSession, invoiceTotalIncGst } = await import('../api/_stripe.js')

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: iRows } = await sb.from('invoices').select('id,data')
const { data: tRows } = await sb.from('tenants').select('id,data')

for (const number of TARGETS) {
  const row = iRows.find(r => r.data.number === number)
  if (!row) { console.error(`${number}: NOT FOUND`); continue }
  const invoice = { ...row.data, id: row.id }
  const tenant = tRows.find(r => r.id === invoice.tenantId)?.data
  const total = invoiceTotalIncGst(invoice)
  const paid = (invoice.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0)
  const due = Math.round((total - paid) * 100) / 100

  console.log(`\n${number} — ${tenant?.businessName}`)
  console.log(`  status=${invoice.status} owing=$${due.toFixed(2)} card=${tenant?.cardBrand} ••${tenant?.cardLast4} authority=${tenant?.cardAuthorityAccepted === true}`)
  console.log(`  receipt to: ${tenant?.email || invoice.clientEmail || '(NO EMAIL — receipt will be skipped)'}`)
  if (!APPLY) { console.log('  DRY RUN — not charged'); continue }

  const result = await chargeInvoiceOffSession(sb, invoice, tenant)
  if (result.ok) console.log(`  CHARGED $${result.amount.toFixed(2)} — ${result.paymentIntentId} — invoice marked paid, receipt sent`)
  else console.error(`  DECLINED/FAILED: ${result.error}${result.code ? ` (${result.code})` : ''}`)
}
if (!APPLY) console.log('\nDRY RUN — re-run with --apply to charge.')
