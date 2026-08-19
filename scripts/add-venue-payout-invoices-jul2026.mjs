// 16 Jul 2026 — creates 3 paid invoices for venue-platform payouts received in the bank:
//   7 Jul  TAGVENUE30062-1EKB   $510.00 inc GST  -> Tagvenue (tc_inv_6)
//   14 Jul TAGVENUERAFAE-YTOZ   $340.00 inc GST  -> Tagvenue (tc_inv_6)
//   16 Jul SPACETOCOHOST-ROVX   $15.71  inc GST  -> SpacetoCoHost (tc_inv_12)
// Amounts on the statement are GST-inclusive; line unitPrice is stored ex-GST
// (vatEnabled adds 10% — see src/app/lib/invoiceTotal.js).
// Idempotent: skips any invoice whose reference already exists.
//
// Run: node scripts/add-venue-payout-invoices-jul2026.mjs
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const url = env.match(/^SUPABASE_URL=(.+)$/m)[1].trim()
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim()
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }

const PAYOUTS = [
  { tenantId: 'tc_inv_6', date: '2026-07-07', incGst: 510.0, exGst: 463.64, ref: 'TAGVENUE30062-1EKB', desc: 'Tagvenue booking 30062' },
  { tenantId: 'tc_inv_6', date: '2026-07-14', incGst: 340.0, exGst: 309.09, ref: 'TAGVENUERAFAE-YTOZ', desc: 'Tagvenue booking RAFAE' },
  { tenantId: 'tc_inv_12', date: '2026-07-16', incGst: 15.71, exGst: 14.28, ref: 'SPACETOCOHOST-ROVX', desc: 'SpacetoCoHost booking ROVX' },
]

const existing = await (await fetch(`${url}/rest/v1/invoices?select=data`, { headers: { ...h, Range: '0-9999' } })).json()
const nums = existing.map((x) => parseInt((x.data.number ?? '').replace(/\D/g, ''), 10)).filter((n) => !isNaN(n))
let nextNum = Math.max(...nums) + 1
const refs = new Set(existing.map((x) => x.data.reference).filter(Boolean))

for (const p of PAYOUTS) {
  if (refs.has(p.ref)) {
    console.log(`SKIP ${p.ref} — invoice with this reference already exists`)
    continue
  }
  const number = `INV-${nextNum++}`
  const id = `inv_vp_${p.date.replaceAll('-', '')}_${p.ref.slice(-4).toLowerCase()}`
  const inv = {
    id, number,
    tenantId: p.tenantId, leaseId: null,
    status: 'paid', sentStatus: 'not_sent', source: 'manual',
    issueDate: p.date, dueDate: p.date,
    periodStart: '2026-07-01', periodEnd: '2026-07-31',
    reference: p.ref, paymentMethod: '', discountPct: 0,
    vatEnabled: true, xeroSync: false, isProrated: false, currency: 'AUD',
    lineItems: [{
      id: `${id}_li0`, description: p.desc, revenueAccount: 'One-off Fees',
      unitPrice: p.exGst, qty: 1, discountPct: 0,
    }],
    payments: [{
      id: `${id}_p0`, date: p.date, amount: p.incGst, method: 'Bank Transfer',
      note: `Payout received in bank (${p.ref})`,
    }],
    comments: [],
    creditNoteForId: null, createdAt: '2026-07-16',
  }
  const r = await fetch(`${url}/rest/v1/invoices`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ id, data: inv, updated_at: new Date().toISOString() }),
  })
  console.log(`${r.ok ? 'CREATED' : 'FAILED ' + r.status} ${number} ${p.desc} — $${p.incGst.toFixed(2)} inc GST (${p.exGst} ex) paid ${p.date}`)
  if (!r.ok) console.log(await r.text())
}
