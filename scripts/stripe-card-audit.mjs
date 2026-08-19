// READ-ONLY audit: which Stripe customers in OUR account have saved cards,
// where they came from (OfficeRND vs platform), and whether we can match them
// to a tenant row. Writes nothing. Run: node scripts/stripe-card-audit.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n')
  .filter(l => l && !l.trimStart().startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))

const SK = env.STRIPE_SECRET_KEY
async function stripe(path) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${SK}` } })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || `GET ${path} failed`)
  return j
}

console.log('Stripe key mode:', SK.startsWith('sk_live') ? 'LIVE' : 'TEST')
const acct = await stripe('/account')
console.log('Account:', acct.id, '—', acct.settings?.dashboard?.display_name || acct.business_profile?.name || '(unnamed)')

// Page through all customers.
const customers = []
let starting_after = null
do {
  const page = await stripe(`/customers?limit=100${starting_after ? `&starting_after=${starting_after}` : ''}`)
  customers.push(...page.data)
  starting_after = page.has_more ? page.data[page.data.length - 1].id : null
} while (starting_after)
console.log(`\nCustomers in account: ${customers.length}`)

// Which have at least one saved card?
const withCards = []
for (const c of customers) {
  const pms = await stripe(`/payment_methods?customer=${c.id}&type=card&limit=10`)
  if (pms.data.length) withCards.push({ c, pms: pms.data })
}
console.log(`Customers with >=1 saved card: ${withCards.length}`)

// Provenance: our own code stamps metadata.tenantId. OfficeRND stamps its own keys.
const provenance = {}
for (const { c } of withCards) {
  const keys = Object.keys(c.metadata || {}).sort().join(',') || '(no metadata)'
  provenance[keys] = (provenance[keys] || 0) + 1
}
console.log('\nMetadata key signatures on card-holding customers (provenance clue):')
for (const [k, n] of Object.entries(provenance).sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)}  ${k}`)

// Match against our tenants.
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: tRows } = await sb.from('tenants').select('id,data')
const tenants = (tRows ?? []).map(r => ({ id: r.id, ...r.data }))
const byEmail = new Map(tenants.filter(t => t.email).map(t => [t.email.trim().toLowerCase(), t]))
const linked = new Set(tenants.filter(t => t.stripeCustomerId).map(t => t.stripeCustomerId))

console.log(`\nTenants: ${tenants.length} · already have stripeCustomerId: ${linked.size} · have stripePaymentMethodId: ${tenants.filter(t => t.stripePaymentMethodId).length}`)

const rows = []
for (const { c, pms } of withCards) {
  const email = (c.email || '').trim().toLowerCase()
  const t = byEmail.get(email)
  const pm = pms[0]
  rows.push({
    customer: c.id,
    name: c.name || '',
    email: c.email || '',
    card: `${pm.card.brand} ••${pm.card.last4} ${pm.card.exp_month}/${pm.card.exp_year}`,
    expired: pm.card.exp_year < 2026 || (pm.card.exp_year === 2026 && pm.card.exp_month < 7),
    tenant: t ? `${t.id} (${t.businessName || t.contactName})` : '',
    state: linked.has(c.id) ? 'ALREADY LINKED' : t ? 'MATCHED by email — backfillable' : 'NO TENANT MATCH',
  })
}

const tally = rows.reduce((a, r) => (a[r.state] = (a[r.state] || 0) + 1, a), {})
console.log('\nMatch summary:', tally)
console.log('Expired cards among these:', rows.filter(r => r.expired).length)

console.log('\n--- detail ---')
for (const r of rows.sort((a, b) => a.state.localeCompare(b.state))) {
  console.log(`${r.state.padEnd(28)} ${r.customer} ${r.card}${r.expired ? ' [EXPIRED]' : ''}  ${r.email}  ${r.name}${r.tenant ? `  ->  ${r.tenant}` : ''}`)
}
