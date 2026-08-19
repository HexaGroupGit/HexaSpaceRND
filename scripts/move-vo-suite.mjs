// Move a virtual-office lease to a different suite.
// Refuses if the target suite already has an active lease, so a fix can't create
// a second clash. Note there can be SEVERAL space records per suite name (a
// record was created per contract rather than per physical suite), so the check
// is by suite NAME, not by space id.
//
//   node scripts/move-vo-suite.mjs CON-269 "Suite 423"            # dry run
//   node scripts/move-vo-suite.mjs CON-269 "Suite 423" --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const [REF, TARGET] = process.argv.slice(2)
const APPLY = process.argv.includes('--apply')
if (!REF || !TARGET) { console.error('usage: move-vo-suite.mjs <contractNumber> "<Suite name>" [--apply]'); process.exit(1) }

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const g = async (t) => ((await sb.from(t).select('id,data')).data ?? []).map(r => ({ ...r.data, id: r.id }))

const [spaces, leases, tenants] = await Promise.all([g('spaces'), g('leases'), g('tenants')])
const co = (l) => tenants.find(t => t.id === l.tenantId)?.businessName || l.companyName || l.tenantId
const suiteOf = (l) => spaces.find(s => s.id === l.spaceId)?.unitNumber || l.resource || '(none)'

const matches = leases.filter(l => l.contractNumber === REF && l.status === 'active')
if (matches.length !== 1) { console.error(`Expected 1 active lease for "${REF}", found ${matches.length}`); process.exit(1) }
const lease = matches[0]

// Every space record carrying the target name; prefer one with no lease history.
const candidates = spaces.filter(s => s.type === 'virtual' && s.unitNumber === TARGET)
if (!candidates.length) { console.error(`No virtual-office space record named "${TARGET}".`); process.exit(1) }

const activeOnTarget = leases.filter(l => l.status === 'active' && l.id !== lease.id && suiteOf(l) === TARGET)
if (activeOnTarget.length) {
  console.error(`"${TARGET}" is not free — active: ${activeOnTarget.map(l => `${co(l)} (${l.contractNumber})`).join(', ')}`)
  process.exit(1)
}
const pendingOnTarget = leases.filter(l => l.status === 'pending' && suiteOf(l) === TARGET)
if (pendingOnTarget.length) console.warn(`  NOTE: ${TARGET} also has PENDING lease(s): ${pendingOnTarget.map(l => `${co(l)} (${l.contractNumber})`).join(', ')}`)

const space = candidates[0]
console.log(`${lease.contractNumber} — ${co(lease)}`)
console.log(`  ${suiteOf(lease)}  ->  ${TARGET}`)
console.log(`  spaceId ${lease.spaceId || '(empty)'} -> ${space.id}`)
console.log(`  resource "${lease.resource ?? ''}" -> "${TARGET}"`)
console.log(`  term ${lease.startDate} → ${lease.endDate} · rent $${lease.monthlyRent}`)
if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); process.exit(0) }

const data = {
  ...lease,
  spaceId: space.id,
  resource: TARGET,
  suiteMovedFrom: suiteOf(lease),
  suiteMovedAt: new Date().toISOString(),
}
delete data.id
const { error } = await sb.from('leases').upsert({ id: lease.id, data, updated_at: new Date().toISOString() })
console.log(error ? `FAILED: ${error.message}` : `APPLIED — ${co(lease)} is now in ${TARGET}.`)
