// 4Corners Group and Level Up Consult are one company held as two tenant
// records, each with an active lease on the SAME space — so every bill run
// charges Suite 15 + 16 twice (August: INV-3300 paid, INV-3329 voided as the
// duplicate).
//
// Keeps tc40 — the signed contract CON-187, the ABN, 7 real members, the
// billing contact and the whole invoice history — renamed to the current
// trading name. The July record was an unsigned month-to-month duplicate with
// a placeholder $3,500 total and a nameless member, so it and its lease are
// removed rather than left terminated, where a billing or renewal cron could
// still find them. Everything deleted is written to a backup file first.
//
// Dry-run by default; pass --apply to write.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DUP = 't_mtm_4corners', KEEP = 'tc40'
const DUP_MEMBER = 'm_mtm_4corners', DUP_LEASE = 'CON-4CORNERS'
const KEEP_LEASE = 'CON-187', SPACE = 'hx_l2_suite1516'
const NEW_NAME = '4Corners Group Pty Ltd'
const BACKUP = 'C:/Hexa-Space-RND/4corners-merge-backup.json'

const [{ data: tn }, { data: ls }, { data: mem }, { data: inv }, { data: sp }] = await Promise.all([
  sb.from('tenants').select('id,data'), sb.from('leases').select('id,data'), sb.from('members').select('id,data'),
  sb.from('invoices').select('id,data'), sb.from('spaces').select('id,data'),
])
const dup = tn.find((t) => t.id === DUP), keep = tn.find((t) => t.id === KEEP)
if (!keep) { console.error(`Keeper ${KEEP} missing — aborting.`); process.exit(1) }
if (!dup) { console.log(`${DUP} already retired — nothing to do.`); process.exit(0) }

const dupLease = ls.find((l) => l.data.contractNumber === DUP_LEASE)
const keepLease = ls.find((l) => l.data.contractNumber === KEEP_LEASE)
const dupMember = mem.find((m) => m.id === DUP_MEMBER)
const space = sp.find((s) => s.id === SPACE)
const movingInv = inv.filter((i) => i.data.tenantId === DUP)

// Guard: never delete a lease that anything still owes against.
const liveOnDup = movingInv.filter((i) => !['voided'].includes(i.data.status) && (i.data.payments ?? []).length === 0 && i.data.status !== 'paid')
if (liveOnDup.length) {
  console.error(`${DUP} still has unresolved invoices: ${liveOnDup.map((i) => `${i.data.number} (${i.data.status})`).join(', ')} — resolve those first.`)
  process.exit(1)
}
if (!keepLease || keepLease.data.status !== 'active') { console.error(`${KEEP_LEASE} is not active — aborting.`); process.exit(1) }

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — merge ${DUP} → ${KEEP}\n`)
console.log(`Rename    ${KEEP}: "${keep.data.businessName}" → "${NEW_NAME}"`)
console.log(`Keep      ${KEEP_LEASE}  ${keepLease.data.startDate}→${keepLease.data.endDate}  $${keepLease.data.monthlyRent}/mo`)
console.log(`Delete    ${DUP_LEASE}  ${dupLease ? `${dupLease.data.startDate}→${dupLease.data.endDate} (unsigned duplicate)` : '(already gone)'}`)
console.log(`Delete    member ${DUP_MEMBER} "${dupMember?.data.name ?? '—'}" (placeholder, no email)`)
console.log(`Move      ${movingInv.length} invoice(s): ${movingInv.map((i) => `${i.data.number} [${i.data.status}]`).join(', ') || '—'}`)
console.log(`Repoint   space ${SPACE} → ${KEEP} / ${keepLease.data.memberId} (${keepLease.data.memberName})`)
console.log(`Delete    tenant ${DUP}`)
console.log(`\nKeeper retains: abn=${keep.data.abn} members=${mem.filter((m) => m.data.companyId === KEEP).length} xeroContact=${keep.data.xeroContactId}`)

if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

writeFileSync(BACKUP, JSON.stringify({ savedAt: new Date().toISOString(), tenant: dup, lease: dupLease, member: dupMember, space, invoices: movingInv }, null, 2))
console.log(`\nBacked up to ${BACKUP}`)

const stamp = new Date().toISOString()
const mark = { mergedFromTenantId: DUP, mergedAt: stamp }

for (const i of movingInv) {
  const { error } = await sb.from('invoices').upsert({ id: i.id, data: { ...i.data, tenantId: KEEP, ...mark }, updated_at: stamp })
  if (error) { console.error(`  !! ${i.data.number}: ${error.message} — stopping.`); process.exit(1) }
}
console.log(`Moved ${movingInv.length} invoice(s) to ${KEEP}.`)

const { error: sErr } = await sb.from('spaces').upsert({
  id: SPACE,
  data: { ...space.data, assignedCompanyId: KEEP, occupantTenantId: KEEP, assignedMemberId: keepLease.data.memberId },
  updated_at: stamp,
})
if (sErr) { console.error(`Space repoint failed: ${sErr.message} — stopping.`); process.exit(1) }
console.log(`Repointed ${SPACE}.`)

const { error: kErr } = await sb.from('tenants').upsert({
  id: KEEP,
  data: { ...keep.data, businessName: NEW_NAME, previousBusinessName: keep.data.businessName, ...mark },
  updated_at: stamp,
})
if (kErr) { console.error(`Rename failed: ${kErr.message} — stopping.`); process.exit(1) }
console.log(`Renamed ${KEEP} → "${NEW_NAME}".`)

if (dupLease) await sb.from('leases').delete().eq('id', dupLease.id)
if (dupMember) await sb.from('members').delete().eq('id', DUP_MEMBER)
await sb.from('tenants').delete().eq('id', DUP)
console.log('Removed the duplicate lease, member and tenant.')

const [{ data: l2 }, { data: t2 }] = await Promise.all([sb.from('leases').select('id,data'), sb.from('tenants').select('id,data')])
const activeOnSpace = l2.filter((l) => l.data.spaceId === SPACE && l.data.status === 'active')
console.log(`\nVerify: ${activeOnSpace.length} active lease on ${SPACE} (${activeOnSpace.map((l) => l.data.contractNumber).join(', ')}); ` +
  `${DUP} exists: ${t2.some((t) => t.id === DUP)}`)
