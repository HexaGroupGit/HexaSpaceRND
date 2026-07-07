// Reconcile the platform's invoices against an OfficeRND invoices export —
// the export is the SOURCE OF TRUTH ahead of the full migration.
//
//   node scripts/reconcile-invoices-officernd.mjs "<invoices.csv>"            # dry run (report)
//   node scripts/reconcile-invoices-officernd.mjs "<invoices.csv>" --commit   # apply
//
// What it does, per export invoice (grouped from the line-level CSV):
//   1. Same number on file        → align in place (lines, totals, dates, status, tenant).
//   2. No number match            → adopt a leftover platform invoice for the same
//                                   tenant + total + month (renumber it), else create.
//   3. Extra copies of a number   → keep the aligned one, DELETE the duplicates.
//   4. Platform invoices whose number is NOT in the export → VOID (not delete:
//      function bookings / payments may reference them; voided invoices are
//      excluded from every dashboard, billing view and revenue metric).
//
// Writes AUDIT-invoice-reconcile-<ts>.json (full before-state) BEFORE any write.
// Idempotent: re-running against the same export is a no-op.
import fs from 'fs'

const COMMIT = process.argv.includes('--commit')
const FILE = process.argv[2]
if (!FILE) { console.error('Usage: node scripts/reconcile-invoices-officernd.mjs "<invoices.csv>" [--commit]'); process.exit(1) }

function parseEnv(p) { const o = {}; if (!fs.existsSync(p)) return o; for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue; const i = t.indexOf('='); o[t.slice(0, i).trim()] = t.slice(i + 1).trim() } return o }
function parseCSV(text) { const rows = []; let row = [], f = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c } else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = '' } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' } else if (c === '\r') {} else f += c } } if (f.length || row.length) { row.push(f); rows.push(row) } return rows }
const norm = (s) => (s || '').toLowerCase().replace(/\bpty\b|\bltd\b|\bp\/l\b|[.,&]/g, '').replace(/\s+/g, ' ').trim()
const num = (s) => { const n = Number(String(s || '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n }
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

const env = parseEnv('.env.local'); const URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1) }
const HDR = { apikey: KEY, Authorization: `Bearer ${KEY}` }
async function fetchAll(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL}/rest/v1/${table}?select=id,data&order=id.asc`, { headers: { ...HDR, Range: `${from}-${from + 999}` } })
    const batch = await r.json()
    if (!Array.isArray(batch)) { console.error(`${table} fetch failed`, batch); process.exit(1) }
    out.push(...batch)
    if (batch.length < 1000) break
  }
  return out
}
async function bulkUpsert(table, rows) { for (let i = 0; i < rows.length; i += 400) { const res = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: { ...HDR, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 400)) }); if (!res.ok) { console.error(`${table} upsert failed`, res.status, (await res.text()).slice(0, 300)); process.exit(1) } } }
async function del(table, id) { const res = await fetch(`${URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: HDR }); if (!res.ok) console.error(`delete ${id} failed`, res.status) }

const statusMap = (s) => { const x = (s || '').toLowerCase(); return ({ paid: 'paid', overdue: 'overdue', pending: 'pending', partially_paid: 'pending', voided: 'voided', failed: 'pending', refunded: 'voided' })[x] || 'pending' }

// ── Load platform data ──
const [tenantRows, invoiceRows] = await Promise.all([fetchAll('tenants'), fetchAll('invoices')])
const tenants = tenantRows.map((r) => r.data)
const invoices = invoiceRows.map((r) => r.data)
console.log(`Platform: ${invoices.length} invoices · ${tenants.length} companies.`)

const byName = new Map(tenants.map((t) => [norm(t.businessName), t.id]))
const byEmail = new Map(tenants.filter((t) => t.email).map((t) => [t.email.toLowerCase().trim(), t.id]))
const tenantName = new Map(tenants.map((t) => [t.id, t.businessName]))
const matchTenant = (name, email) => byName.get(norm(name)) || (email && byEmail.get(email.toLowerCase().trim())) || ''

// ── Parse export → canonical invoices ──
const rows = parseCSV(fs.readFileSync(FILE, 'utf8')); const H = rows.shift(); const ix = (n) => H.indexOf(n)
const lines = rows.filter((r) => r[ix('InvoiceNumber')])
const groups = new Map()
for (const r of lines) { const k = r[ix('InvoiceNumber')].trim(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r) }

const exportInvoices = []
const unmatchedCompanies = new Map()
for (const [number, ls] of groups) {
  const r0 = ls[0]
  const contact = (r0[ix('ContactName')] || '').trim()
  const email = (r0[ix('EmailAddress')] || '').trim()
  const tenantId = matchTenant(contact, email)
  if (!tenantId) unmatchedCompanies.set(contact || email, (unmatchedCompanies.get(contact || email) || 0) + 1)

  const lineItems = ls.map((r, i) => ({
    id: `li_${number}_${i}`,
    description: (r[ix('Description')] || '').trim(),
    revenueAccount: (r[ix('AccountName')] || '').trim() || 'Membership Fees',
    unitPrice: num(r[ix('UnitPriceWithoutTax')]),
    qty: num(r[ix('Quantity')]) || 1,
    discountPct: num(r[ix('Discount')]),
    ...(String(r[ix('TaxRate')]).toUpperCase() !== 'GST' ? { vatExempt: true } : {}),
  }))
  const vatEnabled = ls.some((r) => String(r[ix('TaxRate')]).toUpperCase() === 'GST')
  const payable = num(r0[ix('PayableAmount')])
  const paidAmt = num(r0[ix('PaidAmount')])
  const status = statusMap(r0[ix('Status')])

  exportInvoices.push({
    number, tenantId, contact, email,
    status, vatEnabled, lineItems,
    issueDate: r0[ix('InvoiceDate')] || '', dueDate: r0[ix('DueDate')] || '',
    periodStart: r0[ix('StartDate')] || '', periodEnd: r0[ix('EndDate')] || '',
    monthKey: (r0[ix('InvoiceMonth')] || r0[ix('StartDate')] || '').slice(0, 7),
    total: payable, paidAmt,
  })
}
console.log(`Export:   ${exportInvoices.length} invoices (${lines.length} line rows).`)

// Total from platform-style lines (net + GST on non-exempt) — to sanity-check.
const calcTotal = (inv) => {
  let taxable = 0, exempt = 0
  for (const li of inv.lineItems ?? []) {
    const net = (li.unitPrice ?? 0) * (li.qty ?? 1) * (1 - (li.discountPct ?? 0) / 100)
    if (li.vatExempt) exempt += net; else taxable += net
  }
  return round2(taxable + exempt + (inv.vatEnabled ? taxable * 0.1 : 0))
}

// ── Reconcile ──
const platByNumber = new Map()
for (const inv of invoices) {
  const k = (inv.number || '').trim()
  if (!k) continue
  if (!platByNumber.has(k)) platByNumber.set(k, [])
  platByNumber.get(k).push(inv)
}

const updates = []          // aligned in place
const renumbered = []       // adopted by content-match
const created = []          // brand new
const dupDeletes = []       // extra copies of a number
const claimed = new Set()   // platform invoice ids consumed by the export

const applyExport = (plat, ex) => {
  const next = {
    ...plat,
    number: ex.number,
    tenantId: ex.tenantId || plat.tenantId,
    status: ex.status,
    vatEnabled: ex.vatEnabled,
    lineItems: ex.lineItems,
    issueDate: ex.issueDate || plat.issueDate,
    dueDate: ex.dueDate || plat.dueDate,
    periodStart: ex.periodStart || plat.periodStart,
    periodEnd: ex.periodEnd || plat.periodEnd,
    reconciledAt: new Date().toISOString().split('T')[0],
    reconcileSource: 'officernd-07-07-2026',
  }
  // Paid in the export but no payment on file → record a migration payment.
  if (ex.status === 'paid' && !(plat.payments || []).length) {
    next.payments = [{ id: `pay_ornd_${ex.number}`, amount: ex.paidAmt || ex.total, date: ex.issueDate, method: 'OfficeRND import', reference: ex.number }]
  }
  return next
}

for (const ex of exportInvoices) {
  const cands = platByNumber.get(ex.number) || []
  if (cands.length) {
    // Prefer the copy already on the right company.
    const keep = cands.find((c) => ex.tenantId && c.tenantId === ex.tenantId) || cands[0]
    claimed.add(keep.id)
    const next = applyExport(keep, ex)
    if (JSON.stringify(next) !== JSON.stringify({ ...keep, reconciledAt: next.reconciledAt, reconcileSource: next.reconcileSource })) updates.push(next)
    for (const dup of cands) if (dup.id !== keep.id) { dupDeletes.push(dup); claimed.add(dup.id) }
  } else {
    ex._pending = true
  }
}

// Second pass: adopt content-matches (same tenant + total + month) for export
// invoices whose number wasn't found — this renumbers instead of void+create.
const leftovers = () => invoices.filter((i) => !claimed.has(i.id) && i.status !== 'voided')
for (const ex of exportInvoices.filter((e) => e._pending)) {
  const cand = leftovers().find((i) =>
    ex.tenantId && i.tenantId === ex.tenantId &&
    Math.abs(calcTotal(i) - ex.total) < 0.011 &&
    (i.periodStart || i.issueDate || '').slice(0, 7) === ex.monthKey)
  if (cand) {
    claimed.add(cand.id)
    renumbered.push({ from: cand.number, ...applyExport(cand, ex) })
    ex._pending = false
  }
}

// Remaining pending → create fresh records.
for (const ex of exportInvoices.filter((e) => e._pending)) {
  created.push(applyExport({
    id: `inv_ornd_${ex.number.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
    payments: [], comments: [], sentStatus: 'not_sent', source: 'officernd-import',
    createdAt: new Date().toISOString().split('T')[0],
  }, ex))
}

// Platform invoices not claimed by the export → void, but ONLY inside the
// export's issue-date window: the export is a period slice (e.g. June+July),
// not the whole history — pre-window invoices and anything issued after the
// export was taken are none of its business. Unclaimed PAID invoices carry
// payment records, so they're flagged for manual review, never auto-voided.
const winStart = exportInvoices.map((e) => e.issueDate).filter(Boolean).sort()[0]
const winEnd = exportInvoices.map((e) => e.issueDate).filter(Boolean).sort().at(-1)
const inWindow = (i) => { const d = i.issueDate || ''; return d >= winStart && d <= winEnd }
const unclaimed = invoices.filter((i) => !claimed.has(i.id) && i.status !== 'voided')
const toVoid = unclaimed.filter((i) => inWindow(i) && i.status !== 'paid')
const paidReview = unclaimed.filter((i) => inWindow(i) && i.status === 'paid')
const outOfWindow = unclaimed.filter((i) => !inWindow(i))

// ── Report ──
const label = (i) => `${(i.number || i.id).padEnd(12)} ${(tenantName.get(i.tenantId) || i.clientName || '—').slice(0, 34).padEnd(35)} $${String(calcTotal(i).toFixed(2)).padStart(10)} ${i.status}`
console.log(`\n── Plan ────────────────────────────────────────────────`)
console.log(`  Align in place:   ${updates.length}`)
console.log(`  Renumbered:       ${renumbered.length}${renumbered.length ? '\n' + renumbered.map((r) => `      ${r.from || '(no number)'} → ${r.number} · ${tenantName.get(r.tenantId) || ''}`).join('\n') : ''}`)
console.log(`  Created:          ${created.length}${created.length ? '\n' + created.map((c) => `      ${label(c)}`).join('\n') : ''}`)
console.log(`  Duplicates DELETED: ${dupDeletes.length}${dupDeletes.length ? '\n' + dupDeletes.map((d) => `      ${label(d)} (id ${d.id})`).join('\n') : ''}`)
console.log(`  Export window: ${winStart} → ${winEnd} (only this window is reconciled)`)
console.log(`  VOIDED (in-window, unpaid, not in export): ${toVoid.length}${toVoid.length ? '\n' + toVoid.map((v) => `      ${label(v)}`).join('\n') : ''}`)
console.log(`  ⚠ PAID but not in export (left alone — review manually): ${paidReview.length}${paidReview.length ? '\n' + paidReview.map((v) => `      ${label(v)}`).join('\n') : ''}`)
console.log(`  Untouched (outside window): ${outOfWindow.length}`)
if (unmatchedCompanies.size) {
  console.log(`\n  ⚠ Export companies with no tenant match (invoices still processed, unassigned):`)
  for (const [n, c] of unmatchedCompanies) console.log(`      ${n} (${c} invoice${c > 1 ? 's' : ''})`)
}
console.log(`\nMode: ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)

if (COMMIT) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = { at: stamp, invoices: invoiceRows }
  const backupFile = `AUDIT-invoice-reconcile-${stamp}.json`
  fs.writeFileSync(backupFile, JSON.stringify(backup))
  console.log(`\nBackup written: ${backupFile} (${invoiceRows.length} invoices)`)

  const nowIso = new Date().toISOString()
  const writes = [
    ...updates, ...renumbered.map(({ from, ...r }) => r), ...created,
    ...toVoid.map((v) => ({ ...v, status: 'voided', voidedReason: 'Not in OfficeRND export 07-07-2026 (pre-migration reconcile)', reconciledAt: nowIso.split('T')[0] })),
  ].map((d) => ({ id: d.id, data: d, updated_at: nowIso }))
  await bulkUpsert('invoices', writes)
  for (const d of dupDeletes) await del('invoices', d.id)
  console.log(`Wrote ${writes.length} invoices · deleted ${dupDeletes.length} duplicates · voided ${toVoid.length}.`)
}
