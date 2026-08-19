// Find member/tenant emails that Supabase GoTrue would reject with
// "Unable to validate email address: invalid format".
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})

// Deliberately strict, close to what GoTrue accepts: single @, no spaces,
// ASCII only, dotted TLD of 2+ letters.
const OK = /^[^\s@,;<>()[\]\\"]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/
const why = (e) => {
  const out = []
  if (e !== e.trim()) out.push('leading/trailing whitespace')
  if (/\s/.test(e.trim())) out.push('space inside')
  if (/[^\x20-\x7E]/.test(e)) out.push('non-ASCII char')
  if ((e.match(/@/g) || []).length !== 1) out.push(`${(e.match(/@/g)||[]).length} "@" signs`)
  if (/[,;]/.test(e)) out.push('comma/semicolon (two addresses?)')
  if (/[<>]/.test(e)) out.push('angle brackets / display name')
  if (/\.\./.test(e)) out.push('double dot')
  if (/^\./.test(e) || /\.$/.test(e)) out.push('starts/ends with a dot')
  if (!/\.[A-Za-z]{2,}$/.test(e.trim())) out.push('no valid TLD')
  return out.length ? out.join(', ') : 'fails strict format check'
}

for (const table of ['members', 'tenants']) {
  const { data, error } = await sb.from(table).select('id,data')
  if (error) { console.log(table, 'ERROR', error.message); continue }
  const rows = []
  for (const r of data ?? []) {
    const d = r.data ?? {}
    const fields = table === 'members'
      ? [['email', d.email]]
      : [['email', d.email], ['billingEmail', d.billingEmail], ['contactEmail', d.contactEmail]]
    for (const [field, val] of fields) {
      if (!val || typeof val !== 'string') continue
      if (!OK.test(val)) rows.push({ id: r.id, name: d.name ?? d.businessName ?? '(no name)', field, val, why: why(val) })
    }
  }
  console.log(`\n=== ${table}: ${rows.length} bad ===`)
  for (const x of rows) console.log(`  ${String(x.name).padEnd(30)} ${x.field}=${JSON.stringify(x.val)}  -> ${x.why}   [${x.id}]`)
}
