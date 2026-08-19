import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const [{ data: t }, { data: m }] = await Promise.all([
  sb.from('tenants').select('id,data'),
  sb.from('members').select('id,data'),
])
const tenants = t ?? [], members = m ?? []
const tById = new Map(tenants.map(x => [x.id, x.data]))

console.log('── Tenants whose name/email mentions "abpa" ──')
for (const x of tenants) {
  const blob = JSON.stringify(x.data).toLowerCase()
  if (blob.includes('abpa')) console.log(`  id=${x.id}  name="${x.data.businessName}"  email=${x.data.email || ''}`)
}

console.log('\n── Members mentioning "abpa" anywhere ──')
for (const mm of members) {
  if (JSON.stringify(mm.data).toLowerCase().includes('abpa'))
    console.log(`  id=${mm.id} name="${mm.data.name}" company="${tById.get(mm.data.companyId)?.businessName || mm.data.companyId}"`)
}

console.log('\n── All members with a "flexible" / "flex" desk plan ──')
const planOf = (d) => d.plan || d.membershipType || d.planName || d.spaceType || ''
for (const mm of members) {
  const p = String(planOf(mm.data)).toLowerCase()
  if (p.includes('flex')) {
    const rate = mm.data.rate ?? mm.data.monthlyRate ?? mm.data.price ?? '?'
    console.log(`  id=${mm.id} name="${mm.data.name}" plan="${planOf(mm.data)}" rate=${rate} status="${mm.data.status||''}" company="${tById.get(mm.data.companyId)?.businessName || mm.data.companyId}"`)
  }
}
