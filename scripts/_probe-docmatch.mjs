import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
const [{data:dR},{data:tR},{data:lR}] = await Promise.all([
  sb.from('documents').select('id,data'), sb.from('tenants').select('data'), sb.from('leases').select('data')])
const docs=(dR??[]).map(r=>r.data), tenants=(tR??[]).map(r=>r.data), leases=(lR??[]).map(r=>r.data)
const tName=id=>tenants.find(t=>t.id===id)?.businessName??id
// Resolve each doc's CON number to the contract, and see whose contract it is.
console.log('doc filename → contract owner vs filed-under tenant\n')
for (const d of docs){
  const m = String(d.name??'').match(/CON[_-](\d+)/i); if(!m) continue
  const con = `CON-${m[1]}`
  const lease = leases.find(l => (l.contractNumber??'').toUpperCase() === con)
  if (!lease) { continue }
  const realOwner = lease.tenantId
  if (realOwner !== d.tenantId) {
    console.log(`  MISFILED  ${d.name}`)
    console.log(`            ${con} belongs to : ${tName(realOwner)}  (${realOwner})`)
    console.log(`            but filed under   : ${tName(d.tenantId)}  (${d.tenantId})`)
    console.log(`            doc.leaseId=${d.leaseId}  lease.id=${lease.id}\n`)
  }
}
console.log('done — anything listed above is a document sitting on the wrong company profile.')
