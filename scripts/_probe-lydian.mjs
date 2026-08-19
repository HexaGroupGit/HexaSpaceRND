import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TABLES = ['tenants', 'members', 'leases', 'invoices', 'bookings', 'fees', 'spaces']
const got = await Promise.all(TABLES.map(t => sb.from(t).select('id,data').then(r => [t, r.data ?? [], r.error])))
const db = Object.fromEntries(got.map(([t, rows]) => [t, rows]))
for (const [t, , err] of got) if (err) console.log(`!! ${t}: ${err.message}`)

const tenants = db.tenants
const tById = new Map(tenants.map(x => [x.id, x.data]))

console.log('── Tenants mentioning "lydian" ──')
const hits = tenants.filter(x => JSON.stringify(x.data).toLowerCase().includes('lydian'))
for (const x of hits) {
  const d = x.data
  console.log(`\n  id=${x.id}`)
  console.log(`    businessName : "${d.businessName}"`)
  console.log(`    contactName  : "${d.contactName || ''}"   phone: ${d.phone || ''}`)
  console.log(`    email        : ${d.email || ''}`)
  console.log(`    abn          : ${d.abn || ''}   industry: ${d.industry || ''}`)
  console.log(`    createdAt    : ${d.createdAt || ''}`)
  console.log(`    card         : ${d.cardBrand || ''} ****${d.cardLast4 || ''} pm=${d.stripePaymentMethodId ? 'yes' : 'no'}  stripeCustomer=${d.stripeCustomerId || '—'}`)
  console.log(`    xero         : ${d.xeroContactId || '—'}`)
  const otherKeys = Object.keys(d).filter(k => !['businessName','contactName','phone','email','abn','industry','createdAt','cardBrand','cardLast4','stripePaymentMethodId','stripeCustomerId','xeroContactId','id'].includes(k))
  console.log(`    other keys   : ${otherKeys.join(', ')}`)
}

const ids = new Set(hits.map(h => h.id))
console.log('\n── Attached records per tenant id ──')
for (const id of ids) {
  const name = tById.get(id)?.businessName
  const members = db.members.filter(m => m.data.companyId === id)
  const leases = db.leases.filter(l => l.data.tenantId === id)
  const invoices = db.invoices.filter(i => i.data.tenantId === id)
  const bookings = db.bookings.filter(b => b.data.companyId === id || b.data.tenantId === id)
  const fees = db.fees.filter(f => f.data.companyId === id || f.data.tenantId === id)
  console.log(`\n  ${id}  "${name}"`)
  console.log(`    members : ${members.length}  ${members.map(m => `${m.data.name}<${m.data.email || 'no-email'}>${m.data.status ? `[${m.data.status}]` : ''}`).join(', ')}`)
  console.log(`    leases  : ${leases.length}`)
  for (const l of leases) {
    const sp = db.spaces.find(s => s.id === l.data.spaceId)?.data
    console.log(`        ${l.id} status=${l.data.status} ${l.data.startDate}→${l.data.endDate || '—'} rent=${l.data.monthlyRent} space=${sp?.unitNumber || l.data.spaceId}`)
  }
  console.log(`    invoices: ${invoices.length}`)
  const byStatus = {}
  for (const i of invoices) byStatus[i.data.status] = (byStatus[i.data.status] || 0) + 1
  console.log(`        by status: ${JSON.stringify(byStatus)}`)
  for (const i of invoices.sort((a, b) => (a.data.issueDate || '').localeCompare(b.data.issueDate || '')).slice(-8)) {
    console.log(`        ${i.data.number} ${i.data.issueDate} due=${i.data.dueDate} status=${i.data.status} xero=${i.data.xeroInvoiceId ? 'y' : 'n'}`)
  }
  console.log(`    bookings: ${bookings.length}   fees: ${fees.length}`)
}
