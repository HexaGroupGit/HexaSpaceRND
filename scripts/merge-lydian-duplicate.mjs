// Merge the two "Lydian GBS Pty Ltd" company records created by the OfficeRND
// migration: invoice history landed on tc_inv_2 (invoice-import), the live
// contract + contact details on t_mtm_1782796539117 (mtm-import).
//
// Keeps the mtm record (email, contact, country, 8/8 credits, portal invite,
// active lease CON-1782796539117), repoints the 10 invoices onto it, retires
// the empty duplicate. Dry-run by default; pass --apply to write.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DUP = 'tc_inv_2'
const KEEP = 't_mtm_1782796539117'
const APPLY = process.argv.includes('--apply')

const { data: tenants } = await sb.from('tenants').select('id,data').in('id', [DUP, KEEP])
const dup = tenants?.find(t => t.id === DUP)
const keep = tenants?.find(t => t.id === KEEP)
if (!dup || !keep) { console.error('One of the two records is already gone — aborting.'); process.exit(1) }
if (dup.data.businessName !== keep.data.businessName) {
  console.error(`Name mismatch ("${dup.data.businessName}" vs "${keep.data.businessName}") — aborting.`); process.exit(1)
}

const { data: allInv } = await sb.from('invoices').select('id,data')
const moving = (allInv ?? []).filter(i => i.data.tenantId === DUP)   // exact match, not substring

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — merge ${DUP} → ${KEEP} ("${keep.data.businessName}")`)
console.log(`\nRepointing ${moving.length} invoice(s):`)
for (const i of moving) console.log(`  ${i.data.number ?? i.id}  ${i.data.issueDate}  ${i.data.status}`)
console.log(`\nRetiring tenant ${DUP} (source=${dup.data.source}, no leases/members/bookings).`)
console.log(`Keeper keeps: email=${keep.data.email} credits=${keep.data.creditsRemaining}/${keep.data.monthlyAllowance}`)

if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

const stamp = new Date().toISOString()
let moved = 0
for (const i of moving) {
  const next = { ...i.data, tenantId: KEEP, mergedFromTenantId: DUP, mergedAt: stamp }
  const { error } = await sb.from('invoices').upsert({ id: i.id, data: next, updated_at: stamp })
  if (error) { console.error(`  !! ${i.id}: ${error.message}`); continue }
  moved++
}
console.log(`\nRepointed ${moved}/${moving.length} invoices.`)

if (moved !== moving.length) { console.error('Not all invoices moved — leaving the duplicate in place.'); process.exit(1) }

// Record the merge on the survivor, then drop the empty duplicate.
const { error: kErr } = await sb.from('tenants').upsert({
  id: KEEP,
  data: { ...keep.data, mergedFromTenantId: DUP, mergedAt: stamp },
  updated_at: stamp,
})
if (kErr) { console.error(`Keeper update failed: ${kErr.message} — duplicate left in place.`); process.exit(1) }

const { error: dErr } = await sb.from('tenants').delete().eq('id', DUP)
console.log(dErr ? `Delete failed: ${dErr.message}` : `Deleted duplicate tenant ${DUP}.`)

const { data: check } = await sb.from('invoices').select('id,data')
console.log(`\nVerify: ${(check ?? []).filter(i => i.data.tenantId === KEEP).length} invoices now on the keeper, ` +
  `${(check ?? []).filter(i => i.data.tenantId === DUP).length} left on the retired id.`)
