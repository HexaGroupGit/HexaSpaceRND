import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const TID = 'tc8'
const [{ data: m }, { data: l }, { data: inv }] = await Promise.all([
  sb.from('members').select('id,data'),
  sb.from('leases').select('id,data'),
  sb.from('invoices').select('id,data'),
])
console.log('===== MEMBERS (companyId=tc8) =====')
for (const mm of (m ?? [])) if (mm.data.companyId === TID) { console.log('id=' + mm.id); console.log(JSON.stringify(mm.data, null, 2)) }
console.log('\n===== LEASES (tenantId=tc8) =====')
for (const ll of (l ?? [])) if (ll.data.tenantId === TID) { console.log('id=' + ll.id); console.log(JSON.stringify(ll.data, null, 2)) }
console.log('\n===== INVOICES (tenantId=tc8) — recent 5 =====')
const mine = (inv ?? []).filter(x => x.data.tenantId === TID).sort((a,b)=>String(b.data.issueDate||b.data.date||'').localeCompare(String(a.data.issueDate||a.data.date||''))).slice(0,5)
for (const x of mine) { console.log('id=' + x.id + '  ' + (x.data.number||'') + '  ' + (x.data.issueDate||x.data.date||'') + '  status=' + (x.data.status||'')); for (const li of (x.data.lineItems||x.data.items||[])) console.log('    - ' + (li.description||li.name||'') + '  qty=' + (li.quantity??li.qty??'') + '  amt=' + (li.amount??li.unitAmount??li.price??'')) }
