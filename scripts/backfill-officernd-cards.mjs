// Backfill OfficeRND-era saved cards onto tenant rows.
//
// The cards already live in OUR Stripe account (acct_1Lq87cF2rWzvoc2n) — OfficeRND
// was connected to it, so nothing is migrated here; we only record which Stripe
// customer + payment method belongs to which company so the existing charge paths
// (api/_stripe.js, api/overdue-reminders.js, portal pay, food) can see them.
//
// Scope: companies that are actually billable — a tenant with an active or pending
// lease — and cards that have not expired. Never clobbers a card already on file.
//
//   node scripts/backfill-officernd-cards.mjs           # dry run + CSV, writes nothing
//   node scripts/backfill-officernd-cards.mjs --apply    # commits to Supabase
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const TODAY = new Date('2026-07-27')

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n')
  .filter(l => l && !l.trimStart().startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))

const SK = env.STRIPE_SECRET_KEY
async function stripe(path) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${SK}` } })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || `GET ${path}`)
  return j
}
const norm = (s) => (s || '').trim().toLowerCase()

// ---- Stripe side: every customer and its cards -----------------------------
const customers = []
let after = null
do {
  const p = await stripe(`/customers?limit=100${after ? `&starting_after=${after}` : ''}`)
  customers.push(...p.data); after = p.has_more ? p.data.at(-1).id : null
} while (after)

const cards = []
for (const c of customers) {
  const pms = await stripe(`/payment_methods?customer=${c.id}&type=card&limit=10`)
  for (const pm of pms.data) {
    const exp = new Date(pm.card.exp_year, pm.card.exp_month, 0)
    cards.push({
      customerId: c.id, email: norm(c.email), name: c.name || c.description || '',
      created: c.created, provenance: c.metadata?.source || (c.metadata?.tenantId ? 'platform' : 'legacy'),
      pmId: pm.id, brand: pm.card.brand, last4: pm.card.last4,
      expMonth: pm.card.exp_month, expYear: pm.card.exp_year, expired: exp < TODAY,
    })
  }
}
console.log(`Stripe: ${customers.length} customers, ${cards.length} cards (${cards.filter(c => c.expired).length} expired)`)

// ---- Our side --------------------------------------------------------------
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: tRows } = await sb.from('tenants').select('id,data')
const { data: mRows } = await sb.from('members').select('id,data')
const { data: lRows } = await sb.from('leases').select('id,data')
const { data: iRows } = await sb.from('invoices').select('data')
const tenants = (tRows ?? []).map(r => ({ ...r.data, id: r.id }))
const members = (mRows ?? []).map(r => ({ ...r.data, id: r.id }))
const leases = (lRows ?? []).map(r => ({ ...r.data, id: r.id }))
const invoices = (iRows ?? []).map(r => r.data)

const tenantById = new Map(tenants.map(t => [t.id, t]))
// Billable = an active/pending lease, OR invoiced in the last ~3 months. The second
// arm matters: virtual-office and month-to-month members are invoiced with no lease
// row at all, and they are exactly who a card on file saves chasing.
const RECENT = '2026-05-01'
const billable = new Set([
  ...leases.filter(l => ['active', 'pending'].includes(l.status)).map(l => l.tenantId),
  ...invoices.filter(i => (i.issueDate || i.date || '') >= RECENT).map(i => i.tenantId),
].filter(Boolean))
const tenantByEmail = new Map()
for (const t of tenants) if (t.email) tenantByEmail.set(norm(t.email), t)
const membersByEmail = new Map()
for (const m of members) if (m.email) membersByEmail.set(norm(m.email), m)

// ---- Resolve each card to a company ---------------------------------------
const candidates = [], rejected = []
for (const card of cards) {
  const reject = (why) => rejected.push({ ...card, why })
  if (card.expired) { reject('card expired'); continue }
  if (!card.email) { reject('stripe customer has no email'); continue }

  let tenant = tenantByEmail.get(card.email), via = 'tenant email', member = null
  if (!tenant) {
    member = membersByEmail.get(card.email)
    if (member) { tenant = tenantById.get(member.companyId); via = 'member email' }
  }
  if (!tenant) { reject(member ? 'member has no company' : 'no tenant or member match'); continue }
  if (tenant.status === 'Former') { reject(`company "${tenant.businessName}" is a Former member`); continue }
  if (!billable.has(tenant.id)) { reject(`company "${tenant.businessName}" has no active lease and no recent invoice`); continue }
  if (tenant.stripePaymentMethodId) { reject(`company "${tenant.businessName}" already has a card on file`); continue }

  // Prefer the company's billing contact, then its contact person, then newest card.
  const rank = member?.billingPerson ? 0 : member?.contactPerson ? 1 : 2
  candidates.push({ ...card, tenantId: tenant.id, businessName: tenant.businessName, via, memberName: member?.name || '', rank })
}

// ---- Collisions: one card per company --------------------------------------
const byTenant = new Map()
for (const c of candidates) {
  const prev = byTenant.get(c.tenantId)
  if (!prev || c.rank < prev.rank || (c.rank === prev.rank && c.created > prev.created)) byTenant.set(c.tenantId, c)
}
const chosen = [...byTenant.values()]
const losers = candidates.filter(c => byTenant.get(c.tenantId) !== c)

console.log(`\nResolved: ${chosen.length} companies to link`)
console.log(`Collisions (extra cards for an already-covered company, left alone): ${losers.length}`)
const whyTally = rejected.reduce((a, r) => (a[r.why.replace(/"[^"]*"/, '…')] = (a[r.why.replace(/"[^"]*"/, '…')] || 0) + 1, a), {})
console.log('Skipped:', whyTally)

const csv = [
  'action,stripe_customer,payment_method,brand,last4,expiry,provenance,matched_via,member,tenant_id,business_name,note',
  ...chosen.map(c => `LINK,${c.customerId},${c.pmId},${c.brand},${c.last4},${c.expMonth}/${c.expYear},${c.provenance},${c.via},"${c.memberName}",${c.tenantId},"${c.businessName}",`),
  ...losers.map(c => `SKIP-DUP,${c.customerId},${c.pmId},${c.brand},${c.last4},${c.expMonth}/${c.expYear},${c.provenance},${c.via},"${c.memberName}",${c.tenantId},"${c.businessName}",another card chosen for this company`),
  ...rejected.map(c => `SKIP,${c.customerId},${c.pmId},${c.brand},${c.last4},${c.expMonth}/${c.expYear},${c.provenance},,,,"${(c.name || '').replace(/"/g, "'")}","${c.why.replace(/"/g, "'")}"`),
].join('\n')
writeFileSync('C:/Hexa-Space-RND/officernd-card-backfill.csv', csv)
console.log('\nCSV -> officernd-card-backfill.csv')

console.log('\n--- companies that would be linked ---')
for (const c of chosen.sort((a, b) => a.businessName.localeCompare(b.businessName))) {
  console.log(`${c.businessName.padEnd(38).slice(0, 38)} ${c.brand} ••${c.last4} ${c.expMonth}/${c.expYear}  via ${c.via.padEnd(12)} ${c.provenance.padEnd(9)} ${c.memberName}`)
}

if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.'); process.exit(0) }

let ok = 0
for (const c of chosen) {
  const tenant = tenantById.get(c.tenantId)
  const updated = {
    ...tenant,
    stripeCustomerId: c.customerId,
    stripePaymentMethodId: c.pmId,
    cardBrand: c.brand,
    cardLast4: c.last4,
    cardExpMonth: c.expMonth,
    cardExpYear: c.expYear,
    cardSource: c.provenance === 'OfficeRnD' ? 'officernd-migration' : 'legacy-stripe-migration',
  }
  delete updated.id
  const { error } = await sb.from('tenants').upsert({ id: c.tenantId, data: updated, updated_at: new Date().toISOString() })
  if (error) console.error(`FAILED ${c.tenantId} ${c.businessName}: ${error.message}`)
  else ok++
}
console.log(`\nAPPLIED: ${ok}/${chosen.length} tenant rows updated.`)
