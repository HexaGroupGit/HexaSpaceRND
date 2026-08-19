// Every space label held by more than one ACTIVE lease. Intentional co-occupancy
// (sharedSpace) and same-tenant renewal handovers are not clashes.
//   node scripts/space-clashes.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env=Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const g=async t=>((await sb.from(t).select('id,data')).data??[]).map(r=>({...r.data,id:r.id}))
const [spaces,leases,tenants]=await Promise.all([g('spaces'),g('leases'),g('tenants')])
const co=l=>tenants.find(t=>t.id===l.tenantId)?.businessName||l.companyName||l.tenantId
const label=l=>spaces.find(s=>s.id===l.spaceId)?.unitNumber||l.resource||'(none)'
const active=leases.filter(l=>l.status==='active')
const by={}; for(const l of active){const k=label(l); if(k==='(none)')continue; (by[k]??=[]).push(l)}
let clashes=0, ok=0
for(const [name,list] of Object.entries(by).filter(([,v])=>v.length>1).sort()){
  const sameTenant=new Set(list.map(l=>l.tenantId)).size===1
  const shared=list.every(l=>l.sharedSpace)
  const handover=sameTenant&&list.some(l=>list.some(x=>x.previousContractId===l.id))
  if(shared||handover){ ok++; console.log(`OK  ${name} — ${shared?'shared by design':'same-tenant renewal handover'}: ${list.map(co).join(', ')}`); continue }
  clashes++
  console.log(`\nCLASH ${name}`)
  for(const l of list) console.log(`      ${l.startDate} → ${l.endDate||'(none)'}  ${co(l)} (${l.contractNumber})`)
}
console.log(`\nGenuine clashes: ${clashes} · accepted co-occupancy: ${ok}`)
