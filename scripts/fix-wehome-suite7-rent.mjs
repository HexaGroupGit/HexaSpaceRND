// Wehome Real Estate (tc81) — Suite 7 rent was wrong, and the Suite 24 rent had
// been folded into it as well as billed separately, double-charging $1,000/mo.
//
//   CON-120        Suite 7   monthlyRent 2838 -> 1838   (its own OfficeRND
//                            `total` says 1838, and every historical invoice
//                            reads "Suite 7, $1,838.00" @ $2,021.80 inc GST)
//   INV-3281       Aug 2026  line 2838 -> 1838
//   CON-WEHOME24   Suite 24  $1,000 — correct, untouched (INV-3342 stands)
//   tenant tc81              combineInvoices: true, so from September the two
//                            contracts bill as one invoice with a line each
//
//   node scripts/fix-wehome-suite7-rent.mjs           # dry run
//   node scripts/fix-wehome-suite7-rent.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

const TENANT = 'tc81'
const LEASE = 'CON-120'
const INVOICE = 'inv_auto_1785619827091_txlk9'   // INV-3281
const RIGHT_RENT = 1838
const WRONG_RENT = 2838

const changes = []
const save = async (table, id, data) => {
  if (!APPLY) return
  const { error } = await sb.from(table).update({ data, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(`${table}/${id}: ${error.message}`)
}

// ── 1. the lease ────────────────────────────────────────────────────────────
const { data: leaseRow } = await sb.from('leases').select('id,data').eq('id', LEASE).single()
if (!leaseRow) throw new Error(`lease ${LEASE} not found`)
const lease = leaseRow.data
if (Number(lease.monthlyRent) !== WRONG_RENT) {
  console.log(`  ! ${LEASE} monthlyRent is ${lease.monthlyRent}, expected ${WRONG_RENT} — leaving it alone`)
} else {
  changes.push(`${LEASE} monthlyRent  ${lease.monthlyRent} -> ${RIGHT_RENT}`)
  await save('leases', LEASE, { ...lease, monthlyRent: RIGHT_RENT, total: RIGHT_RENT })
}

// ── 2. the August invoice ───────────────────────────────────────────────────
const { data: invRow } = await sb.from('invoices').select('id,data').eq('id', INVOICE).single()
if (!invRow) throw new Error(`invoice ${INVOICE} not found`)
const inv = invRow.data
if (inv.status !== 'pending' || (inv.payments ?? []).length) {
  console.log(`  ! ${inv.number} is ${inv.status} with ${(inv.payments ?? []).length} payment(s) — NOT editing; raise a credit note instead`)
} else {
  const lineItems = inv.lineItems.map((li) =>
    Number(li.unitPrice) === WRONG_RENT ? { ...li, unitPrice: RIGHT_RENT } : li
  )
  const before = inv.lineItems.reduce((s, l) => s + l.unitPrice * (l.qty ?? 1), 0)
  const after = lineItems.reduce((s, l) => s + l.unitPrice * (l.qty ?? 1), 0)
  if (before === after) {
    console.log(`  ! ${inv.number} has no $${WRONG_RENT} line — leaving it alone`)
  } else {
    changes.push(`${inv.number} subtotal   $${before} -> $${after} ex GST  ($${(after * 1.1).toFixed(2)} inc)`)
    await save('invoices', INVOICE, { ...inv, lineItems })
  }
}

// ── 3. combine future invoices ──────────────────────────────────────────────
const { data: tRow } = await sb.from('tenants').select('id,data').eq('id', TENANT).single()
if (!tRow) throw new Error(`tenant ${TENANT} not found`)
if (tRow.data.combineInvoices === true) {
  console.log('  · combineInvoices already on')
} else {
  changes.push(`${TENANT} combineInvoices  ${tRow.data.combineInvoices ?? '(unset)'} -> true`)
  await save('tenants', TENANT, { ...tRow.data, combineInvoices: true })
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — nothing written'}:`)
for (const c of changes) console.log(`  ${c}`)
if (!changes.length) console.log('  (nothing to change)')
if (!APPLY) console.log('\nRe-run with --apply to write.')
