import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})

// The two member records that point at tenants which no longer exist, plus
// their dead companyIds — check nothing else in the DB references them.
const NEEDLES = ['m1786493437318', 'm1786493669841', 't1786493423054', 't1786493659722']

const TABLES = ['members','tenants','leases','invoices','bookings','fees','spaces','settings','events','announcements','messages','tours','enquiries']
for (const table of TABLES) {
  const { data, error } = await sb.from(table).select('id,data')
  if (error) { console.log(`${table}: skipped (${error.message.slice(0,40)})`); continue }
  const hits = []
  for (const r of data ?? []) {
    const s = JSON.stringify(r.data ?? {})
    for (const n of NEEDLES) if (s.includes(n)) hits.push(`${r.id} <- ${n}`)
  }
  console.log(`${table}: ${hits.length ? hits.join(' | ') : 'clean'}`)
}

// Also: is there a tenants row whose id matches the dead companyIds under a
// different key (soft-deleted / archived)?
const { data: t } = await sb.from('tenants').select('id,data')
console.log('\nTotal tenants:', (t ?? []).length)
console.log('Dead ids present as tenant rows:', (t ?? []).filter(r => NEEDLES.includes(r.id)).length)
