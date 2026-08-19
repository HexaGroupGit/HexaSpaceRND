// Allocate suite numbers to virtual-office leases that have none.
// Points the lease at an existing, unlet VO space record (one record per physical
// suite is the correct model — the duplicated 406/410/411/603 records are a bug,
// not the pattern) and sets the lease's own `resource` label to match.
//
//   node scripts/allocate-vo-suites.mjs            # dry run
//   node scripts/allocate-vo-suites.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

// contractNumber → suite name to allocate.
const PLAN = {
  'CON-253': 'Suite 415', // Aurora Migration Services Pty Ltd
  'CON-254': 'Suite 416', // JC Partners Lawyers
  'MTM':     'Suite 418', // Lau Wen Qiu  (matched by lease id below — MTM is not unique)
  'CON-255': 'Suite 422', // LM Yarra Conveyancing PTY LTD
}
// 'MTM' is the contract number on 9 active leases, so pin Lau Wen Qiu by tenant.
const BY_TENANT_NAME = { 'Lau Wen Qiu': 'Suite 418' }

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const g = async (t) => ((await sb.from(t).select('id,data')).data ?? []).map(r => ({ ...r.data, id: r.id }))

const [spaces, leases, tenants] = await Promise.all([g('spaces'), g('leases'), g('tenants')])
const co = (l) => tenants.find(t => t.id === l.tenantId)?.businessName || l.companyName || l.tenantId

// Suite names already claimed by an active lease (via spaceId or the text label).
const claimed = new Set()
for (const l of leases.filter(l => l.status === 'active')) {
  const sp = spaces.find(s => s.id === l.spaceId)
  if (sp?.unitNumber) claimed.add(sp.unitNumber)
  const txt = String(l.resource || '').trim()
  if (/^(suite|vo|virtual)/i.test(txt)) claimed.add(txt)
}

// The leases needing a suite: active, virtual office, no resolvable space.
const needy = leases.filter((l) => {
  if (l.status !== 'active') return false
  const sp = spaces.find(s => s.id === l.spaceId)
  const isVo = /virtual/i.test(l.membershipType || '') || sp?.type === 'virtual'
  return isVo && !sp?.unitNumber
})

console.log(`Leases needing a suite: ${needy.length}\n`)
const writes = []
for (const l of needy) {
  const name = BY_TENANT_NAME[co(l)] ?? PLAN[l.contractNumber]
  if (!name) { console.log(`  SKIP ${l.contractNumber} ${co(l)} — not in the plan`); continue }
  if (claimed.has(name)) { console.log(`  SKIP ${co(l)} → ${name} — already claimed by an active lease`); continue }
  const space = spaces.find(s => s.type === 'virtual' && s.unitNumber === name)
  if (!space) { console.log(`  SKIP ${co(l)} → ${name} — no space record with that name`); continue }
  console.log(`  ${co(l).padEnd(36)} → ${name.padEnd(12)} (space ${space.id})`)
  console.log(`      lease ${l.id}: spaceId ${l.spaceId || '(empty)'} -> ${space.id}, resource "${l.resource ?? ''}" -> "${name}"`)
  claimed.add(name)
  writes.push({ lease: l, space, name })
}

if (!writes.length) { console.log('\nNothing to do.'); process.exit(0) }
if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); process.exit(0) }

let ok = 0
for (const w of writes) {
  const data = { ...w.lease, spaceId: w.space.id, resource: w.name, suiteAllocatedAt: new Date().toISOString() }
  delete data.id
  const { error } = await sb.from('leases').upsert({ id: w.lease.id, data, updated_at: new Date().toISOString() })
  if (error) console.error(`  FAILED ${w.lease.id}: ${error.message}`)
  else ok++
}
console.log(`\nAPPLIED: ${ok}/${writes.length} leases allocated a suite.`)
