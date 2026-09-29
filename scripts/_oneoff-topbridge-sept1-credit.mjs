// One-off: correct INV-3415 (Top bridge group Pty Ltd, tc77).
//
// Linda Sheng booked Central for 1 Sept 2026 11:30–13:00 on 31 Aug. September's
// 15-credit allowance was untouched, so the 1.5h (3 credits at the list rate)
// was covered — but both member booking paths draw from the pool of the month
// the booking is MADE in and date the overage fee on TODAY. August's pool was
// exhausted, so the booking drew 0 credits, raised an $84 fee dated 31/08 and
// the August bill run swept it onto INV-3415 (period 1–31 Aug).
//
// Proof it was never spent: her September pool still reads 10 of 15. It should
// read 7 — the 3 credits for this booking are sitting there unused while she is
// being chased for $92.40 of cash for the same hours (5 reminders, last 27/09).
//
// This restates the invoice IN PLACE rather than raising a credit note. Nothing
// has been paid against it, so Xero's copy is still editable: keeping the id,
// number, payToken and xeroInvoiceId means the hourly sync's restate pass pushes
// the new total to the linked copy on its next run (api/xero/sync.js — status
// 'overdue' is restatable, and xeroRestatedTotal 554.40 vs 462.00 is a big
// enough gap to clear its rounding guard). No void, so no permanent number burn.
//
// Also NOT recovered here: the 13 Aug booking needed 4 credits, only 2 were
// left, and no fee was ever raised for the 2-credit shortfall ($56 + GST). It is
// left as goodwill — she has been chased five times over an invoice that was
// wrong. Recovering it would mean a new charge six weeks late on the same bill.
//
//   $504.00 ex / $554.40 inc  →  $420.00 ex / $462.00 inc
//
// Does NOT email. The corrected invoice needs sending from the Billing page, and
// email_log holds no invoice or reminder ever delivered to any tc77 address
// despite remindersSent: 5 — worth resolving before another send goes out.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8')
  .split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const APPLY = process.argv.includes('--apply')
const TODAY = '2026-09-29'
const NOW = new Date().toISOString()

const CO = 'tc77'
const INV = 'INV-3415'
const FEE_ID = 'f_1788136288222_ih3z'
const LINE_ID = `li_fee_${FEE_ID}`
const BOOKING_ID = 'bk_1788136288221_3699'
const MK = '2026-09'          // the month the booking actually falls in
const CREDITS = 3             // 1.5h × Central $80/hr list ÷ $40 per credit
const POOL_BEFORE = 10
const POOL_AFTER = 7
const EX_BEFORE = 504, INC_BEFORE = 554.40
const EX_AFTER = 420, INC_AFTER = 462.00

const money = (n) => `$${Number(n).toFixed(2)}`
const fail = (m) => { throw new Error(`GUARD: ${m}`) }
const ex = (i) => Math.round((i.lineItems ?? []).reduce((s, li) =>
  s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0) * 100) / 100
const inc = (i) => Math.round(ex(i) * (i.vatEnabled !== false ? 1.1 : 1) * 100) / 100

// ── Read ─────────────────────────────────────────────────────────────────────
const [invRes, feeRes, bkRes, tRes] = await Promise.all([
  sb.from('invoices').select('id,data').eq('data->>number', INV),
  sb.from('fees').select('id,data').eq('id', FEE_ID),
  sb.from('bookings').select('id,data').eq('id', BOOKING_ID),
  sb.from('tenants').select('id,data').eq('id', CO),
])
for (const [name, r] of [['invoices', invRes], ['fees', feeRes], ['bookings', bkRes], ['tenants', tRes]]) {
  if (r.error) throw new Error(`${name}: ${r.error.message}`)
}
const invoice = invRes.data?.[0]?.data
const fee = feeRes.data?.[0]?.data
const booking = bkRes.data?.[0]?.data
const tenant = tRes.data?.[0]?.data

// ── Guards: refuse anything we did not survey, and refuse to run twice ───────
if (!invoice) fail(`${INV} not found`)
if (!fee) fail(`fee ${FEE_ID} not found`)
if (!booking) fail(`booking ${BOOKING_ID} not found`)
if (!tenant) fail(`tenant ${CO} not found`)

if (invoice.tenantId !== CO) fail(`${INV} belongs to ${invoice.tenantId}, not ${CO}`)
if ((invoice.payments ?? []).length) fail(`${INV} has ${invoice.payments.length} payment(s) — a paid invoice needs a credit note, not a restate`)
if (!['overdue', 'pending'].includes(invoice.status)) fail(`${INV} is '${invoice.status}' — expected overdue/pending`)
if (invoice.status === 'voided' || invoice.voidedAt) fail(`${INV} is voided`)
if (invoice.creditNoteForId) fail(`${INV} is itself a credit note`)
if (!(invoice.lineItems ?? []).some((li) => li.id === LINE_ID)) fail(`${INV} no longer carries ${LINE_ID} — already corrected?`)
if (Math.abs(ex(invoice) - EX_BEFORE) > 0.005) fail(`${INV} is ${money(ex(invoice))} ex, expected ${money(EX_BEFORE)} — it has changed since this was surveyed`)
if (Math.abs(inc(invoice) - INC_BEFORE) > 0.005) fail(`${INV} is ${money(inc(invoice))} inc, expected ${money(INC_BEFORE)}`)

if (fee.companyId !== CO) fail(`fee ${FEE_ID} belongs to ${fee.companyId}`)
if (fee.status === 'Waived') fail(`fee ${FEE_ID} is already Waived — already corrected?`)
if (Math.abs(Number(fee.price) - 84) > 0.005) fail(`fee ${FEE_ID} is ${money(fee.price)}, expected $84.00`)
if (!/01\/09\/2026/.test(fee.name)) fail(`fee ${FEE_ID} does not name the 01/09/2026 booking: ${fee.name}`)

if (booking.companyId !== CO) fail(`booking belongs to ${booking.companyId}`)
if (booking.date !== '2026-09-01') fail(`booking date is ${booking.date}, expected 2026-09-01`)
if (booking.status === 'Cancelled') fail('booking is cancelled — nothing to re-credit')
if (Number(booking.creditsUsed ?? 0) !== 0) fail(`booking already drew ${booking.creditsUsed} credits — already corrected?`)

// The 3 credits must still be sitting unspent, or correcting the pool would
// double-count against bookings made since the survey.
if (Number(tenant.creditsRemaining) !== POOL_BEFORE) fail(`${CO} pool is ${tenant.creditsRemaining} credits, expected ${POOL_BEFORE} — she has booked since this was surveyed; re-audit before running`)
if (tenant.creditsPeriod !== MK) fail(`${CO} pool period is ${tenant.creditsPeriod}, expected ${MK} — the month has rolled; the pool correction no longer applies`)
if (Number(tenant.monthlyAllowance) !== 15) fail(`${CO} allowance is ${tenant.monthlyAllowance}, expected 15`)

// ── Build ────────────────────────────────────────────────────────────────────
const nextInvoice = {
  ...invoice,
  lineItems: invoice.lineItems.filter((li) => li.id !== LINE_ID),
  comments: [...(invoice.comments ?? []), {
    id: `cmt${Date.now()}tb`,
    createdAt: TODAY,
    text: `Restated 29/09/2026 from ${money(INC_BEFORE)} to ${money(INC_AFTER)} inc GST. The "Central · 01/09/2026 11:30–13:00" line (${money(84)} ex) was raised in error: September's 15-credit allowance was untouched and covered the 1.5h in full, but the booking was made on 31/08 and both member booking paths drew from August's exhausted pool and dated the fee 31/08, so the August bill run collected it. The 3 credits have now been drawn from her September pool (10 → 7) and fee ${FEE_ID} waived. Xero's copy restates on the next hourly sync. Separately not recovered, as goodwill: the 13/08 booking's 2-credit shortfall ($56 ex) never raised a fee.`,
  }],
}
if (Math.abs(ex(nextInvoice) - EX_AFTER) > 0.005) fail(`restated invoice computes ${money(ex(nextInvoice))} ex, expected ${money(EX_AFTER)}`)
if (Math.abs(inc(nextInvoice) - INC_AFTER) > 0.005) fail(`restated invoice computes ${money(inc(nextInvoice))} inc, expected ${money(INC_AFTER)}`)

// 'Waived' (not a delete) so the fee keeps its history AND stays out of the next
// bill run — attachUnbilledFees skips Paid/Waived/Invoiced. Left 'Invoiced' it
// would point at an invoice it is no longer on, the same silent orphan Simple
// Stacks' 01/09 fee is in.
const nextFee = {
  ...fee,
  status: 'Waived',
  waivedAt: NOW,
  waivedReason: `Raised in error — 1 Sept booking charged against August's exhausted credit pool while September's allowance was untouched. Covered by 3 credits from the September pool instead; ${INV} restated from ${money(INC_BEFORE)} to ${money(INC_AFTER)} inc GST on 29/09/2026.`,
}

const nextBooking = { ...booking, creditsUsed: CREDITS, paidBy: 'credits' }

// Write the month-keyed pool alongside the legacy pair so the record is right
// either way: the legacy fields are what production reads today, creditPools is
// what the month-aware fix reads once it ships.
const nextTenant = {
  ...tenant,
  creditsRemaining: POOL_AFTER,
  creditsPeriod: MK,
  creditPools: { ...(tenant.creditPools ?? {}), [MK]: POOL_AFTER },
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`${INV}  Top bridge group Pty Ltd (${CO})  status ${invoice.status}, ${(invoice.payments ?? []).length} payments\n`)
for (const li of invoice.lineItems) {
  const drop = li.id === LINE_ID
  console.log(`  ${drop ? 'DROP ' : '  keep'} ${money(li.unitPrice)}${li.discountPct ? ` less ${li.discountPct}%` : ''}  ${li.description}`)
}
console.log(`\n  total   ${money(ex(invoice))} ex / ${money(inc(invoice))} inc  ->  ${money(ex(nextInvoice))} ex / ${money(inc(nextInvoice))} inc`)
console.log(`  fee     ${FEE_ID}  ${fee.status} -> Waived`)
console.log(`  booking ${BOOKING_ID}  creditsUsed ${booking.creditsUsed} -> ${CREDITS}, paidBy ${booking.paidBy} -> credits`)
console.log(`  pool    ${CO} September  ${POOL_BEFORE} -> ${POOL_AFTER} of ${tenant.monthlyAllowance} credits`)
console.log(`\n  she is credited ${money(INC_BEFORE - INC_AFTER)} inc GST`)

writeFileSync(`topbridge-sept1-${TODAY}-backup.json`, JSON.stringify({ invoice, fee, booking, tenant }, null, 2))
console.log(`\n  backup -> topbridge-sept1-${TODAY}-backup.json`)

if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.\n'); process.exit(0) }

// ── Write ────────────────────────────────────────────────────────────────────
for (const [table, id, data] of [
  ['invoices', invoice.id, nextInvoice],
  ['fees', FEE_ID, nextFee],
  ['bookings', BOOKING_ID, nextBooking],
  ['tenants', CO, nextTenant],
]) {
  const { error } = await sb.from(table).update({ data, updated_at: NOW }).eq('id', id)
  if (error) throw new Error(`${table} ${id}: ${error.message}`)
  console.log(`  wrote ${table}/${id}`)
}
console.log(`\nDone. ${INV} is now ${money(INC_AFTER)} inc GST; the hourly Xero sync restates the linked copy.`)
console.log('Send the corrected invoice from the Billing page — this script deliberately does not email.\n')
