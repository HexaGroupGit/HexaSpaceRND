import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})

const hit = (s) => /nova\s*med|novamed/i.test(String(s ?? ''))

const { data: tenants } = await sb.from('tenants').select('id,data')
const tn = (tenants ?? []).filter(r => hit(r.data?.businessName) || hit(r.data?.email) || hit(r.data?.contactName))
console.log('=== TENANTS ===')
for (const r of tn) {
  const d = r.data
  console.log(JSON.stringify({ id: r.id, businessName: d.businessName, contactName: d.contactName, email: d.email, phone: d.phone, abn: d.abn, status: d.status, createdAt: d.createdAt, combineInvoices: d.combineInvoices, directoryName: d.directoryName }, null, 1))
}
const ids = new Set(tn.map(r => r.id))

const { data: members } = await sb.from('members').select('id,data')
console.log('\n=== MEMBERS ===')
for (const r of (members ?? [])) {
  const d = r.data ?? {}
  if (!ids.has(d.companyId) && !hit(d.email) && !hit(d.company)) continue
  console.log(JSON.stringify({ id: r.id, name: d.name, email: d.email, companyId: d.companyId, status: d.status, portalAccess: d.portalAccess, saltoUserId: d.saltoUserId, createdAt: d.createdAt, accessGroupIds: d.accessGroupIds }, null, 1))
}

for (const table of ['leases', 'invoices', 'bookings', 'fees', 'contracts', 'proposals', 'leads']) {
  const { data, error } = await sb.from(table).select('id,data')
  if (error) { console.log(`\n=== ${table} === (no table: ${error.message})`); continue }
  const rows = (data ?? []).filter(r => {
    const d = r.data ?? {}
    return ids.has(d.tenantId) || ids.has(d.companyId) || hit(d.businessName) || hit(d.company) || hit(d.email)
  })
  console.log(`\n=== ${table.toUpperCase()} (${rows.length}) ===`)
  for (const r of rows) {
    const d = r.data
    console.log(' ', JSON.stringify({ id: r.id, tenantId: d.tenantId ?? d.companyId, spaceId: d.spaceId, number: d.number, status: d.status, total: d.total, amount: d.amount, monthlyRent: d.monthlyRent, startDate: d.startDate, endDate: d.endDate, date: d.date, memberId: d.memberId, createdAt: d.createdAt }))
  }
}
