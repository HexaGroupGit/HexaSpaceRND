// Repair tenants whose `data` JSON is missing its `id`.
//
// The store loads tenants with select('data') only, so a record without
// data.id yields tenant.id === undefined. That fed an unscoped query in
// DocumentsPanel, which then listed every company's documents.
//
// The row id is the source of truth (data.id === row.id everywhere else),
// so the repair is simply data.id = row.id.
//
//   node scripts/fix-tenant-missing-id.mjs           # dry run — shows changes
//   node scripts/fix-tenant-missing-id.mjs --apply   # writes
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8')
  .split('\n').filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const APPLY = process.argv.includes('--apply')

const { data: rows, error } = await sb.from('tenants').select('id, data')
if (error) { console.error('read failed:', error.message); process.exit(1) }

// Safety: confirm the invariant we are relying on before touching anything.
const disagree = (rows ?? []).filter((r) => r.data?.id && String(r.data.id) !== String(r.id))
if (disagree.length) {
  console.error(`ABORT — ${disagree.length} tenant(s) have data.id !== row.id, so row.id is not a safe source:`)
  for (const r of disagree.slice(0, 10)) console.error(`   row.id=${r.id}  data.id=${r.data.id}  ${r.data.businessName ?? ''}`)
  process.exit(1)
}

const broken = (rows ?? []).filter((r) => !r.data?.id)
console.log(`tenants: ${rows.length} · missing data.id: ${broken.length}\n`)
if (!broken.length) { console.log('Nothing to repair.'); process.exit(0) }

for (const r of broken) {
  console.log(`  ${String(r.id).padEnd(8)} ${r.data?.businessName ?? '(no name)'}`)
  console.log(`           before: data.id = undefined`)
  console.log(`           after : data.id = "${r.id}"`)
}

if (!APPLY) {
  console.log(`\nDRY RUN — nothing written. Re-run with --apply to repair these ${broken.length}.`)
  process.exit(0)
}

let ok = 0
for (const r of broken) {
  const next = { ...r.data, id: r.id }
  const { error: e } = await sb.from('tenants').update({ data: next }).eq('id', r.id)
  if (e) console.error(`  ! ${r.id} failed: ${e.message}`)
  else { ok++; console.log(`  ✓ ${r.id} repaired`) }
}
console.log(`\n${ok}/${broken.length} repaired.`)

// Verify
const { data: after } = await sb.from('tenants').select('id, data')
const still = (after ?? []).filter((r) => !r.data?.id)
console.log(`remaining tenants missing data.id: ${still.length}`)
