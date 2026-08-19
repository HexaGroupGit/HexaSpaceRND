import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env=Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const {data:l}=await sb.from('leases').select('id,data')
console.log('ABPA (tc8) leases:')
for(const x of (l??[]).filter(r=>r.data.tenantId==='tc8'))
  console.log(`  ${x.id.padEnd(18)} status=${(x.data.status||'').padEnd(8)} rent=${x.data.monthlyRent} space=${x.data.spaceId||'—'} ${x.data.mergedIntoLeaseId?('-> merged into '+x.data.mergedIntoLeaseId):''}`)
const active=(l??[]).filter(r=>r.data.tenantId==='tc8'&&r.data.status==='active')
console.log(`\nActive $350 desk leases now: ${active.filter(a=>a.data.monthlyRent===350).length}`)
const {data:inv}=await sb.from('invoices').select('id,data')
console.log('INV-3087 leaseId now:', (inv??[]).find(x=>x.id==='inv_auto_1782864045043_hiyld')?.data.leaseId)
