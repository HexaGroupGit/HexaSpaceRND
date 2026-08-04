// Canwealth VIC (tc13) — Suite 2 rent drops from $2,100 to $1,725 + GST
// ($1,897.50 inc) from August 2026.
//
// The change is recorded as a PRICING STEP on CON-171 rather than by simply
// overwriting monthlyRent: the contract runs to 30 Jul 2027 and was genuinely
// $2,100 for its first year, so the payment schedule (and any agreement
// regenerated from it) should show both rates. monthlyRent is updated too, since
// that's what the UI and MRR read.
//
// The August invoice INV-3288 is still pending and unpaid, so it's corrected in
// place. Their parking contract ($300/mo, l_xa_con171park, INV-3344) is separate
// and untouched.
//
//   node scripts/set-canwealth-rent-1725.mjs           # dry run + schedule check
//   node scripts/set-canwealth-rent-1725.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildPaymentSchedule } from '../src/lib/paymentSchedule.js'
import { buildMonthlyInvoiceForLease } from '../src/lib/billingEngine.js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

const LEASE = 'CON-171'
const INVOICE = 'inv_auto_1785619834214_ciwsc'   // INV-3288, Aug 2026
const SPACE = 'hx_l2_suite2'
const OLD = 2100
const NEW = 1725
const CHANGE_FROM = '2026-08-01'

const { data: leaseRow } = await sb.from('leases').select('data').eq('id', LEASE).single()
const lease = leaseRow.data
if (Number(lease.monthlyRent) !== OLD) throw new Error(`${LEASE} rent is ${lease.monthlyRent}, expected ${OLD} — stopping`)
if ((lease.items ?? []).length) throw new Error(`${LEASE} already has pricing items — review by hand`)

// UTC throughout: `new Date('2026-08-01T00:00:00')` is LOCAL midnight, and
// toISOString() then shifts it back a day in +10:00, silently ending the old
// rate on the 30th and prorating the last month.
const dayBefore = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().split('T')[0]
}
const nextLease = {
  ...lease,
  monthlyRent: NEW,
  items: [{
    spaceId: SPACE,
    steps: [
      { startDate: lease.startDate, endDate: dayBefore(CHANGE_FROM), listPrice: OLD, qty: 1, discount: '' },
      { startDate: CHANGE_FROM, endDate: lease.endDate, listPrice: NEW, qty: 1, discount: '' },
    ],
  }],
}

// Prove the schedule before writing: the old rate must hold to July 2026, the
// new one from August, with no gap, no doubled month and no zero month.
const { data: settRow } = await sb.from('settings').select('data').eq('id', 'global').single()
const settings = settRow?.data ?? {}
const sched = buildPaymentSchedule(nextLease, settings)
const show = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2027-07']
console.log(`${LEASE}  ${lease.startDate} → ${lease.endDate}`)
console.log(`  monthlyRent ${lease.monthlyRent} -> ${NEW}   (inc GST $${(NEW * 1.1).toFixed(2)})`)
console.log('\n  schedule after the change:')
for (const k of show) {
  const r = sched.rows.find((x) => x.key === k)
  console.log(`    ${k}  office $${r?.office ?? '—'}  total $${r?.total ?? '—'}  inc GST $${r?.incGst ?? '—'}`)
}
const bad = sched.rows.filter((r) => r.total !== OLD && r.total !== NEW)
console.log(`  months at neither rate: ${bad.length ? bad.map((r) => `${r.key}=$${r.total}`).join(', ') : 'none ✓'}`)

const { data: invRows } = await sb.from('invoices').select('data')
const invoices = invRows.map((r) => r.data)
const sep = buildMonthlyInvoiceForLease({ ...nextLease, id: LEASE }, new Date('2026-09-01T00:00:00'), { invoices, spaces: [], settings })
console.log(`\n  next auto-bill (Sept): ${sep.reason ?? sep.invoice.lineItems.map((l) => `${l.description} $${l.unitPrice}`).join(' | ')}`)

// ── the August invoice ──
const { data: invRow } = await sb.from('invoices').select('data').eq('id', INVOICE).single()
const inv = invRow.data
if (inv.status !== 'pending' || (inv.payments ?? []).length) throw new Error(`${inv.number} is ${inv.status} with payments — raise a credit note instead`)
const lineItems = inv.lineItems.map((li) => (Number(li.unitPrice) === OLD ? { ...li, unitPrice: NEW } : li))
const before = inv.lineItems.reduce((s, l) => s + l.unitPrice * (l.qty ?? 1), 0)
const after = lineItems.reduce((s, l) => s + l.unitPrice * (l.qty ?? 1), 0)
console.log(`\n${inv.number} (${inv.periodStart} → ${inv.periodEnd}, ${inv.status}, ${inv.sentStatus})`)
console.log(`  $${before} -> $${after} ex GST   ($${(before * 1.1).toFixed(2)} -> $${(after * 1.1).toFixed(2)} inc GST)`)

if (APPLY) {
  const stamp = new Date().toISOString()
  let { error } = await sb.from('leases').update({ data: nextLease, updated_at: stamp }).eq('id', LEASE)
  if (error) throw new Error(`lease: ${error.message}`)
  ;({ error } = await sb.from('invoices').update({ data: { ...inv, lineItems }, updated_at: stamp }).eq('id', INVOICE))
  if (error) throw new Error(`invoice: ${error.message}`)
  console.log('\nAPPLIED')
} else {
  console.log('\nDRY RUN — nothing written. Re-run with --apply.')
}
