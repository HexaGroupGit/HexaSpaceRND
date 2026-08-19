import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
const { data } = await sb.from('members').select('data')
const members = (data??[]).map(r=>r.data)
const hasSalto = members.filter(m => m.saltoAccess === true || m.saltoUserId)
const saltoNoEmail = hasSalto.filter(m => !m.email)
console.log('Total members:', members.length)
console.log('With saltoAccess/saltoUserId:', hasSalto.length)
console.log('...of those with NO email:', saltoNoEmail.length)
console.log('\nSample of salto members with no email:')
for (const m of saltoNoEmail.slice(0,10)) console.log(`  ${(m.name??'(no name)').padEnd(28)} status=${m.status??'?'} saltoUserId=${m.saltoUserId??'—'} companyId=${m.companyId??'—'}`)
