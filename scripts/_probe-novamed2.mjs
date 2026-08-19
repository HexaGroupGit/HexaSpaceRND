import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})

const IDS = ['t1786493423054', 't1786493659722', 't1786494577063']

const { data: tenants } = await sb.from('tenants').select('id,data')
console.log('=== THE THREE TENANTS ===')
for (const id of IDS) {
  const r = (tenants ?? []).find(x => x.id === id)
  console.log('\n---', id, r ? '' : 'NOT FOUND')
  if (r) console.log(JSON.stringify(r.data, null, 1))
}

for (const table of ['leases', 'invoices', 'bookings', 'fees', 'documents', 'messages', 'notes']) {
  const { data, error } = await sb.from(table).select('id,data')
  if (error) { console.log(`\n${table}: (no table)`); continue }
  const rows = (data ?? []).filter(r => IDS.includes(r.data?.tenantId) || IDS.includes(r.data?.companyId))
  console.log(`\n=== ${table.toUpperCase()} (${rows.length}) ===`)
  for (const r of rows) console.log(' ', r.data?.tenantId ?? r.data?.companyId, JSON.stringify(r.data).slice(0, 300))
}
