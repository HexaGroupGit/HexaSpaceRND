// 3 Jul 2026 — creates the six missing July invoices confirmed by Eric and
// cancels the CON-260 test lease. Writes a restore backup to Downloads\invocies
// BEFORE changing anything. Idempotent: skips any lease that already has a
// live July invoice.
import { readFileSync, writeFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const url = env.match(/^SUPABASE_URL=(.+)$/m)[1].trim()
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim()
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }
const get = (p) => fetch(`${url}/rest/v1/${p}`, { headers: h }).then((r) => r.json())
const upsert = (t, id, data) => fetch(`${url}/rest/v1/${t}`, { method: 'POST', headers: h, body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }) })

const [invRows, tRows, lRows] = await Promise.all([
  get('invoices?select=data'), get('tenants?select=data'), get('leases?select=data'),
])
const invoices = invRows.map((r) => r.data)
const tenants = tRows.map((r) => r.data)
const leases = lRows.map((r) => r.data)

const tenantByName = (frag) => tenants.find((t) => (t.businessName ?? '').toLowerCase().includes(frag.toLowerCase()))
const leaseByContract = (c) => leases.find((l) => l.contractNumber === c && l.status === 'active')

// [label, lease finder, amount]
const TARGETS = [
  ['Level Up',      () => leaseByContract('CON-187'), 2636.36],
  ['ZhenYu',        () => leaseByContract('CON-248'), 75],
  ['Simple Stacks Office 8', () => leases.find((l) => l.status === 'active' && l.tenantId === tenantByName('simple stacks')?.id && Number(l.monthlyRent) === 1800), 1800],
  ['Verge Legal',   () => leaseByContract('CON-29'), 150],
  ['DCOL Project',  () => leaseByContract('CON-242'), 545.45],
  ['TOP TRADING',   () => leaseByContract('CON-220'), 75],
]

let nextNum = invoices.map((i) => parseInt((i.number ?? '').replace(/\D/g, ''), 10)).filter((n) => !isNaN(n)).reduce((m, n) => Math.max(m, n), 0) + 1
const today = new Date().toISOString().split('T')[0]
const due = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

const backup = { createdInvoiceIds: [], leaseChanges: [], at: new Date().toISOString() }
const results = []

for (const [label, find, amount] of TARGETS) {
  const lease = find()
  if (!lease) { results.push(`SKIP ${label}: active lease not found`); continue }
  const exists = invoices.some((i) => i.leaseId === lease.id && i.status !== 'voided' && (i.periodStart ?? '').startsWith('2026-07'))
  if (exists) { results.push(`SKIP ${label}: already has a live July invoice`); continue }
  const tenant = tenants.find((t) => t.id === lease.tenantId)
  const inv = {
    id: `inv_fix_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    number: `INV-${String(nextNum++).padStart(4, '0')}`,
    tenantId: lease.tenantId, leaseId: lease.id,
    status: 'pending', sentStatus: 'not_sent', source: 'bill-run',
    issueDate: today, dueDate: due,
    periodStart: '2026-07-01', periodEnd: '2026-07-31',
    reference: '', paymentMethod: '', discountPct: 0,
    vatEnabled: true, xeroSync: false, isProrated: false,
    lineItems: [{
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      description: `${lease.contractNumber ?? 'Membership'} — July 2026 (migration gap fix)`,
      revenueAccount: 'Membership Fees', unitPrice: amount, qty: 1, discountPct: 0,
    }],
    payments: [], comments: [{ id: `cmt${Date.now()}`, text: 'Created 03/07/2026 — July billing gap fix (audit vs Xero)', createdAt: today }],
    creditNoteForId: null, createdAt: today,
  }
  const r = await upsert('invoices', inv.id, inv)
  if (!r.ok) { results.push(`ERROR ${label}: ${r.status} ${await r.text()}`); continue }
  backup.createdInvoiceIds.push(inv.id)
  results.push(`CREATED ${inv.number}  ${label}  ${tenant?.businessName ?? ''}  $${amount.toFixed(2)}`)
}

// Cancel the CON-260 test lease so August doesn't bill it.
const testLease = leaseByContract('CON-260')
if (testLease) {
  backup.leaseChanges.push({ id: testLease.id, before: JSON.parse(JSON.stringify(testLease)) })
  testLease.status = 'cancelled'
  testLease.notes = `${testLease.notes ?? ''} [Cancelled 03/07/2026 — test lease, never bill]`.trim()
  const r = await upsert('leases', testLease.id, testLease)
  results.push(r.ok ? 'CANCELLED test lease CON-260 (Hexa Space $2,800)' : `ERROR cancelling CON-260: ${r.status}`)
} else {
  results.push('SKIP CON-260: active lease not found')
}

writeFileSync('C:/Users/EricKuang/Downloads/invocies/AUDIT-julyfix2-backup.json', JSON.stringify(backup, null, 2))
console.log(results.join('\n'))
console.log('\nBackup: Downloads/invocies/AUDIT-julyfix2-backup.json')
