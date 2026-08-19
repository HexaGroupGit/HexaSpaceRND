// One-off cleanup: strip stray whitespace from stored email addresses.
// Supabase auth rejects "a@b.com " outright ("Unable to validate email
// address: invalid format"), which broke portal invites for those members.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})

const APPLY = process.argv.includes('--apply')
const FIELDS = ['email', 'billingEmail', 'contactEmail']

for (const table of ['members', 'tenants']) {
  const { data, error } = await sb.from(table).select('id,data')
  if (error) { console.log(table, 'ERROR', error.message); continue }
  for (const row of data ?? []) {
    const d = row.data ?? {}
    const patch = {}
    for (const f of FIELDS) {
      const v = d[f]
      if (typeof v === 'string' && v !== v.trim()) patch[f] = v.trim()
    }
    if (!Object.keys(patch).length) continue
    const who = d.name ?? d.businessName ?? row.id
    console.log(`${table}: ${who} — ${Object.entries(patch).map(([k, v]) => `${k} ${JSON.stringify(d[k])} -> ${JSON.stringify(v)}`).join(', ')}`)
    if (APPLY) {
      const { error: e } = await sb.from(table).update({ data: { ...d, ...patch } }).eq('id', row.id)
      if (e) console.log('   FAILED:', e.message)
    }
  }
}
console.log(APPLY ? '\nApplied.' : '\nDry run — re-run with --apply to write.')
