// Read-only: Stripe payments that succeeded but whose platform invoice is NOT
// marked paid. Every invoice payment path (checkout.js, pay-invoice.js,
// chargeInvoiceOffSession) stamps payment_intent metadata.invoiceId, so
// scanning PaymentIntents covers all of them.
//   node scripts/_probe-stripe-unmarked.mjs [SINCE-YYYY-MM-DD]   (default 2026-01-01)
// Writes nothing to Stripe or Supabase.
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()
const SUPABASE_URL = get('SUPABASE_URL')
const SERVICE_KEY = get('SUPABASE_SERVICE_ROLE_KEY')
const STRIPE_KEY = get('STRIPE_SECRET_KEY')
if (!STRIPE_KEY) throw new Error('STRIPE_SECRET_KEY missing from .env.local')

const SINCE = process.argv[2] ?? '2026-01-01'
const sinceTs = Math.floor(new Date(`${SINCE}T00:00:00Z`).getTime() / 1000)

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
async function sbGetAll(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=data&order=id.asc`, {
      headers: { ...sbHeaders, Range: `${from}-${from + 999}` },
    })
    if (!r.ok) throw new Error(`Supabase ${table}: ${r.status} ${await r.text()}`)
    const batch = await r.json()
    out.push(...batch.map((x) => x.data))
    if (batch.length < 1000) break
  }
  return out
}

async function stripe(path) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Stripe ${path}: ${r.status} ${JSON.stringify(j.error ?? j)}`)
  return j
}

// Paginate a Stripe list endpoint fully.
async function stripeList(path, extra = '') {
  const out = []
  let starting = null
  for (let page = 0; page < 100; page++) {
    const q = `${path}?limit=100&created[gte]=${sinceTs}${extra}${starting ? `&starting_after=${starting}` : ''}`
    const j = await stripe(q)
    out.push(...(j.data ?? []))
    if (!j.has_more || !j.data?.length) break
    starting = j.data[j.data.length - 1].id
  }
  return out
}

const aud = (n) => '$' + Number(n ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })
const day = (ts) => new Date(ts * 1000).toISOString().slice(0, 10)

const [tenants, invoices, pis] = await Promise.all([
  sbGetAll('tenants'),
  sbGetAll('invoices'),
  stripeList('/payment_intents'),
])

const succeeded = pis.filter((p) => p.status === 'succeeded' && Number(p.amount_received) > 0)
console.log(`\n═══ Stripe PaymentIntents since ${SINCE}: ${pis.length} total, ${succeeded.length} succeeded ═══`)

const invById = new Map(invoices.map((i) => [i.id, i]))
const invByNumber = new Map(invoices.filter((i) => i.number).map((i) => [String(i.number).trim(), i]))
const tenantName = (i) => tenants.find((t) => t.id === i?.tenantId)?.businessName ?? '?'
const paidSum = (i) => Math.round((i.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100
const invoiceTotal = (inv) => (inv.lineItems ?? []).reduce((s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0)
const gross = (i) => Math.round(invoiceTotal(i) * (i.vatEnabled !== false ? 1.1 : 1) * 100) / 100

const unmarked = [], noRef = [], okCount = { n: 0, amt: 0 }, missingInv = []

for (const p of succeeded) {
  const amt = Number(p.amount_received) / 100
  const invoiceId = p.metadata?.invoiceId
  const invNum = p.metadata?.invoiceNumber
  if (!invoiceId) {
    // Bookings, food orders, drop-ins and deposits have their own metadata —
    // only flag ones that look like an invoice payment with nothing to match.
    noRef.push({ id: p.id, amt, date: day(p.created), desc: p.description ?? '', meta: JSON.stringify(p.metadata ?? {}) })
    continue
  }
  const inv = invById.get(invoiceId) ?? (invNum ? invByNumber.get(String(invNum).trim()) : null)
  if (!inv) { missingInv.push({ id: p.id, amt, date: day(p.created), invoiceId, invNum }); continue }

  // Does the invoice already record THIS payment intent?
  const recorded = (inv.payments ?? []).some((pay) => String(pay.reference ?? '').includes(p.id) || String(pay.id ?? '').includes(p.id.slice(-10)))
  if (inv.status === 'paid' && recorded) { okCount.n++; okCount.amt += amt; continue }
  unmarked.push({
    pi: p.id, amt, date: day(p.created),
    number: inv.number, tenant: tenantName(inv), status: inv.status,
    total: gross(inv), recordedPaid: paidSum(inv), recorded,
    xeroInvoiceId: inv.xeroInvoiceId ?? null,
  })
}

console.log(`\n═══ A. Stripe SUCCEEDED but platform invoice not settled: ${unmarked.length} ═══`)
unmarked.sort((a, b) => String(a.date).localeCompare(String(b.date)))
for (const u of unmarked) {
  console.log(`   ${u.date}  ${String(u.number).padEnd(10)} ${String(u.tenant).slice(0, 30).padEnd(31)} stripe ${aud(u.amt).padStart(11)}  platform status=${String(u.status).padEnd(8)} total ${aud(u.total).padStart(11)} recorded ${aud(u.recordedPaid).padStart(11)}`)
  console.log(`       ${u.pi}   thisPaymentRecorded=${u.recorded}  xeroLink=${u.xeroInvoiceId ? 'yes' : 'NONE'}`)
}
console.log(`   Total unbanked on the platform: ${aud(unmarked.reduce((s, u) => s + u.amt, 0))}`)

console.log(`\n═══ B. Succeeded PIs with an invoiceId that matches NO platform invoice: ${missingInv.length} ═══`)
for (const m of missingInv) console.log(`   ${m.date}  ${aud(m.amt).padStart(11)}  ${m.id}  invoiceId=${m.invoiceId} number=${m.invNum ?? '-'}`)

console.log(`\n═══ C. Succeeded PIs with NO invoiceId metadata: ${noRef.length} ═══`)
console.log(`   (bookings / food / drop-ins / deposits carry their own metadata — listing for eyeballing)`)
for (const n of noRef.sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
  console.log(`   ${n.date}  ${aud(n.amt).padStart(11)}  ${n.id}  "${String(n.desc).slice(0, 50)}"  ${n.meta.slice(0, 90)}`)
}

console.log(`\n   OK (paid + payment recorded): ${okCount.n} intents, ${aud(okCount.amt)}`)
console.log('')
