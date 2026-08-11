// "Did anything stop being billed after the migration?"
//
// For a given month, every membership that should be charged must have a live
// invoice covering that period. Walks the leases rather than the invoices, so a
// membership that silently stopped billing shows up as an absence.
//
// Excluded by request: rent-free ($0) and cancelled/terminated memberships.
// Usage: node scripts/audit-aug-coverage.mjs [YYYY-MM]   (default 2026-08)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const MONTH = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a)) ?? '2026-08'
const start = `${MONTH}-01`
const end = new Date(Date.UTC(Number(MONTH.slice(0, 4)), Number(MONTH.slice(5, 7)), 0)).toISOString().slice(0, 10)

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const [{ data: lsR }, { data: invR }, { data: tnR }, { data: spR }] = await Promise.all([
  sb.from('leases').select('id,data'), sb.from('invoices').select('id,data'),
  sb.from('tenants').select('id,data'), sb.from('spaces').select('id,data'),
])
const tById = new Map(tnR.map((t) => [t.id, t.data]))
const spById = new Map(spR.map((s) => [s.id, s.data]))
const leases = lsR.map((r) => r.data)
const invoices = invR.map((r) => r.data)
const inc = (i) => Math.round((i.lineItems ?? []).reduce((s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0) * (i.vatEnabled !== false ? 1.1 : 1) * 100) / 100

// Live invoices covering the month, by lease and by tenant. Combined invoices
// carry leaseIds[]; single ones carry leaseId.
//
// Match on OVERLAP, not on periodStart's month: some bill runs stamp the period
// as "31 Jul – 30 Aug" instead of "1 Aug – 31 Aug", and an exact-month test
// reads those as never billed. Half a month of overlap is enough to count.
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5
const coversMonth = (i) => {
  const ps = i.periodStart ?? i.issueDate, pe = i.periodEnd ?? ps
  if (!ps) return false
  const overlap = days(ps > start ? ps : start, (pe < end ? pe : end)) + 1
  return overlap >= 15
}
const monthInv = invoices.filter((i) => i.status !== 'voided' && coversMonth(i))
const byLease = new Map(), byTenant = new Map()
for (const i of monthInv) {
  for (const lid of i.leaseIds ?? (i.leaseId ? [i.leaseId] : [])) byLease.set(lid, [...(byLease.get(lid) ?? []), i])
  byTenant.set(i.tenantId, [...(byTenant.get(i.tenantId) ?? []), i])
}

// A membership that should be charged for this month.
const billable = leases.filter((l) => {
  if (!['active'].includes(l.status)) return false                       // excludes cancelled/terminated/expired
  if ((l.startDate ?? '9999') > end) return false                        // not started yet
  if (l.endDate && l.endDate < start) return false                       // already ended
  if (!(Number(l.monthlyRent) > 0)) return false                         // rent-free, excluded by request
  if (Number(l.rentFreeMonths) > 0 && (l.startDate ?? '') >= start) return false
  return true
})

const missing = [], covered = []
for (const l of billable) {
  const direct = byLease.get(l.id) ?? byLease.get(l.contractNumber) ?? []
  // Fall back to the tenant: combined invoices and hand-raised ones may not
  // carry the lease id, so only call it missing when the company has nothing.
  const viaTenant = byTenant.get(l.tenantId) ?? []
  ;(direct.length || viaTenant.length ? covered : missing).push({ l, direct, viaTenant })
}

const name = (l) => (tById.get(l.tenantId)?.businessName ?? l.companyName ?? l.tenantId)
console.log(`\n${'═'.repeat(92)}`)
console.log(`${MONTH}  —  ${billable.length} billable memberships (active, rent > $0)`)
console.log(`${'═'.repeat(92)}`)

console.log(`\n■ NO INVOICE AT ALL for ${MONTH}  (${missing.length})`)
if (!missing.length) console.log('   none — every billable membership was invoiced.')
let lost = 0
for (const { l } of missing.sort((a, z) => Number(z.l.monthlyRent) - Number(a.l.monthlyRent))) {
  lost += Number(l.monthlyRent) * 1.1
  console.log(`   ${String(l.contractNumber ?? l.id).padEnd(16)} $${(Number(l.monthlyRent) * 1.1).toFixed(2).padStart(9)}/mo  ` +
    `${(spById.get(l.spaceId)?.unitNumber ?? l.resource ?? '—').slice(0, 20).padEnd(20)} ${name(l).slice(0, 34)}`)
}
if (missing.length) console.log(`   ${'─'.repeat(80)}\n   $${lost.toFixed(2)} of monthly revenue not invoiced`)

// Covered only because the COMPANY has an invoice, not this contract — the
// shape a combined invoice takes, but also how a half-billed company looks.
const indirect = covered.filter((c) => !c.direct.length)
console.log(`\n■ Covered only via the company, no invoice line tied to the contract  (${indirect.length})`)
if (!indirect.length) console.log('   none')
for (const { l, viaTenant } of indirect.sort((a, z) => Number(z.l.monthlyRent) - Number(a.l.monthlyRent))) {
  const t = tById.get(l.tenantId)
  const sum = viaTenant.reduce((s, i) => s + inc(i), 0)
  const expect = Math.round(Number(l.monthlyRent) * 1.1 * 100) / 100
  const flag = t?.combineInvoices ? 'combined' : (sum + 0.05 < expect ? 'SHORT' : 'ok')
  console.log(`   ${String(l.contractNumber ?? l.id).padEnd(16)} needs $${expect.toFixed(2).padStart(9)}  company billed $${sum.toFixed(2).padStart(9)}  [${flag}]  ${name(l).slice(0, 30)}`)
  for (const i of viaTenant) console.log(`        ${i.number} ${i.status} $${inc(i).toFixed(2)}`)
}

console.log(`\n■ ${MONTH} invoices not yet in Xero  (of ${monthInv.length} live)`)
const notInXero = monthInv.filter((i) => !i.xeroInvoiceId)
if (!notInXero.length) console.log('   none — all linked.')
for (const i of notInXero) console.log(`   ${i.number} ${i.issueDate} ${String(i.status).padEnd(8)} $${inc(i).toFixed(2).padStart(9)}  ${(tById.get(i.tenantId)?.businessName ?? i.tenantId).slice(0, 34)}`)

// A period stamped from the day the run fired rather than the 1st. Harmless to
// the customer, but it files the invoice under the previous month in Xero's
// reports — which is why August charges surface in a July export.
const offBy = monthInv.filter((i) => (i.periodStart ?? '') < start && (i.periodStart ?? '').slice(0, 7) !== MONTH)
console.log(`\n■ Period stamped from the run date, not the 1st  (${offBy.length})`)
if (!offBy.length) console.log('   none')
for (const i of offBy) console.log(`   ${i.number} period=${i.periodStart}→${i.periodEnd}  should be ${start}→${end}  ${(tById.get(i.tenantId)?.businessName ?? '').slice(0, 32)}`)

const gross = monthInv.reduce((s, i) => s + inc(i), 0)
console.log(`\n${MONTH} live invoices: ${monthInv.length}, gross $${gross.toFixed(2)}`)
