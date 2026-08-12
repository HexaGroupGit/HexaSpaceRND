// Retires the OfficeRND-import contracts left sitting at status 'pending' with
// an end date that has already passed.
//
// Nothing ever expires a 'pending' contract — reconcile's term-end sweep only
// looks at 'active' ones — so these ghosts read as live forever. They hid L2
// Suite 8 from the contract picker after Victor Group's early termination
// (CON-108 ended 30/06/2025, CON-127 ended 31/12/2024, both still 'pending'),
// and stopped offboardLease from freeing the suite.
//
// Only past-dated pendings are touched. A pending contract with no end date, or
// one whose term is still running (CON-197, CON-239, CON-250), is a genuine
// awaiting-signature contract and is left alone.
//
// NOT flagged needsOffboard: these are historical records, and the offboarding
// cascade sends emails, raises bond refunds and revokes Salto access. This is a
// status correction only.
//
// Dry-run by default; pass --apply to write.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const today = new Date().toISOString().slice(0, 10)
const { data: leaseR } = await sb.from('leases').select('id,data')
const { data: tenantR } = await sb.from('tenants').select('id,data')
const { data: spaceR } = await sb.from('spaces').select('id,data')
const nameOf = (id) => tenantR.find(t => t.id === id)?.data?.businessName ?? id ?? '—'
const unitOf = (id) => spaceR.find(s => s.id === id)?.data?.unitNumber ?? (id || '—')

const pending = leaseR.filter(r => r.data.status === 'pending')
const stale = pending.filter(r => r.data.endDate && r.data.endDate < today)
const keep = pending.filter(r => !stale.includes(r))

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${pending.length} contracts at 'pending'; ${stale.length} have a term that ended before ${today}\n`)
console.log('Expiring (status → expired, no offboarding cascade):')
for (const r of stale.sort((a, b) => String(a.data.endDate).localeCompare(String(b.data.endDate)))) {
  console.log(`   ${r.id.padEnd(8)} ${String(r.data.startDate).padEnd(10)} → ${String(r.data.endDate).padEnd(10)}  ${unitOf(r.data.spaceId).padEnd(16)} ${nameOf(r.data.tenantId)}`)
}
console.log(`\nLeaving alone — still live or no end date (${keep.length}):`)
for (const r of keep) {
  console.log(`   ${r.id.padEnd(8)} ends ${r.data.endDate || '(none)'}  ${unitOf(r.data.spaceId).padEnd(16)} ${nameOf(r.data.tenantId)}`)
}

if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

const stamp = new Date().toISOString()
let n = 0
for (const r of stale) {
  const next = { ...r.data, status: 'expired', expiredReason: 'legacy_pending_term_ended', expiredAt: stamp }
  const { error } = await sb.from('leases').upsert({ id: r.id, data: next, updated_at: stamp })
  if (error) { console.error(`  !! ${r.id}: ${error.message}`); continue }
  n++
}
console.log(`\nExpired ${n}/${stale.length}.`)

const { data: check } = await sb.from('leases').select('id,data')
const left = check.filter(x => x.data.status === 'pending' && x.data.endDate && x.data.endDate < today)
console.log(`Verify: ${left.length} past-dated pendings remain (expect 0).`)
