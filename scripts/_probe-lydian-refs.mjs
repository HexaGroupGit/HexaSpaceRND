import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DUP = 'tc_inv_2'                 // record to retire
const KEEP = 't_mtm_1782796539117'     // record to keep

// Exact value match at any depth — NOT substring, because tc_inv_2 is a prefix
// of tc_inv_20..tc_inv_26 (seven other real companies).
function pathsEqualTo(obj, target, base = '') {
  const out = []
  if (obj === target) return [base || '(root)']
  if (Array.isArray(obj)) obj.forEach((v, i) => out.push(...pathsEqualTo(v, target, `${base}[${i}]`)))
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) out.push(...pathsEqualTo(v, target, base ? `${base}.${k}` : k))
  return out
}

const TABLES = ['tenants', 'members', 'spaces', 'leases', 'invoices', 'bookings', 'fees', 'discounts', 'fobs', 'settings', 'templates', 'leads']

const backup = {}
console.log('── Exact references ──')
for (const t of TABLES) {
  const { data, error } = await sb.from(t).select('id,data')
  if (error) { console.log(`  (skip ${t}: ${error.message})`); continue }
  const dup = [], keep = []
  for (const r of data ?? []) {
    const dp = pathsEqualTo(r.data, DUP), kp = pathsEqualTo(r.data, KEEP)
    if (dp.length) dup.push({ ...r, _paths: dp })
    if (kp.length) keep.push({ ...r, _paths: kp })
  }
  if (dup.length || keep.length) {
    console.log(`${t.padEnd(12)} dup=${String(dup.length).padStart(3)}  keep=${String(keep.length).padStart(3)}`)
    for (const r of dup) console.log(`    DUP  ${r.id}  @ ${r._paths.join(', ')}`)
    for (const r of keep) console.log(`    KEEP ${r.id}  @ ${r._paths.join(', ')}`)
  }
  if (dup.length) backup[t] = dup
}

const { data: trows } = await sb.from('tenants').select('id,data').in('id', [DUP, KEEP])
backup._tenants = trows
writeFileSync('C:/Hexa-Space-RND/lydian-merge-backup.json', JSON.stringify(backup, null, 2))
console.log('\nBackup → lydian-merge-backup.json')
