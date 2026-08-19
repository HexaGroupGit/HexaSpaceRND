import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const {data:inv}=await sb.from('invoices').select('id,data')
const byLease=(lid)=>(inv??[]).filter(x=>x.data.leaseId===lid).map(x=>`${x.data.number||x.id} period=${x.data.periodStart||''} status=${x.data.status||''} total=${x.data.total??x.data.amount??''}`)
console.log('Invoices linked to CON-66:'); console.log('  '+(byLease('CON-66').join('\n  ')||'(none)'))
console.log('\nInvoices linked to l_xa_constellali:'); console.log('  '+(byLease('l_xa_constellali').join('\n  ')||'(none)'))
