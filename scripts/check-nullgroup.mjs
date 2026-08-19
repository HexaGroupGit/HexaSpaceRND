import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
const [{data:bk},{data:sp},{data:tn}] = await Promise.all([sb.from('bookings').select('data'),sb.from('spaces').select('data'),sb.from('tenants').select('data')])
const spaces=(sp??[]).map(r=>r.data), tenants=(tn??[]).map(r=>r.data)
const roomName=(id)=>spaces.find(s=>s.id===id)?.unitNumber??id, coName=(id)=>tenants.find(t=>t.id===id)?.businessName??id
const rows=(bk??[]).map(r=>r.data).filter(b=>Array.isArray(b.roomAccessTargets))
console.log('Bookings whose stored grant targets have a NULL accessGroupId (lock):\n')
let n=0
for(const b of rows){
  for(const t of b.roomAccessTargets){
    if(t.subject==='lock' && !t.accessGroupId){
      n++
      console.log(`${(b.reference??b.id).padEnd(12)} ${roomName(b.resourceId).padEnd(10)} co=${coName(b.companyId)} · group="${t.accessGroup}" · sentAt=${(b.roomAccessSentAt??'').slice(0,16)}`)
    }
  }
}
console.log(`\n${n} lock target(s) with a null accessGroupId`)
