import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const norm = (s) => (s || '').toLowerCase().replace(/\bpty\b|\bltd\b|\bp\/l\b|[.,&]/g, '').replace(/\s+/g, ' ').trim()
const [{ data: t }, { data: m }, { data: l }] = await Promise.all([
  sb.from('tenants').select('id,data'),
  sb.from('members').select('id,data'),
  sb.from('leases').select('id,data'),
])
const tenants = t ?? [], members = m ?? [], leases = l ?? []

const abpa = tenants.filter(x => norm(x.data.businessName).includes('abpa') || (x.data.businessName || '').toUpperCase().includes('ABPA'))
console.log('── Tenants matching ABPA ──')
for (const x of abpa) console.log(`  id=${x.id}  name="${x.data.businessName}"  email=${x.data.email || ''}`)
const ids = new Set(abpa.map(x => x.id))

console.log('\n── Members under those tenants ──')
for (const mm of members) {
  if (!ids.has(mm.data.companyId)) continue
  console.log(`  id=${mm.id}`)
  console.log(`     name="${mm.data.name}" email="${mm.data.email || ''}" plan="${mm.data.plan || mm.data.membershipType || mm.data.planName || ''}" status="${mm.data.status || ''}"`)
  console.log(`     rate=${mm.data.rate ?? mm.data.monthlyRate ?? mm.data.price ?? '?'}  companyId=${mm.data.companyId}`)
}

console.log('\n── Leases under those tenants ──')
for (const ll of leases) {
  if (!ids.has(ll.data.tenantId)) continue
  console.log(`  id=${ll.id}  desc="${ll.data.planName || ll.data.description || ll.data.spaceType || ''}" rent=${ll.data.monthlyRent ?? '?'} status="${ll.data.status || ''}"`)
}
