// NovaMed Health Australia: Benny Zhao shows up three times.
//
// Only ONE tenant record survives (t1786494577063 — holds the lease, the
// invoice and the directory listing). The other two member records point at
// companyIds whose tenant rows were deleted, so they render as orphaned
// "companies" in the members list. Nothing anywhere else in the DB references
// them (checked across members/tenants/leases/invoices/bookings/fees/spaces/
// settings/announcements), so they can just go.
//
// Also strips the trailing spaces that were typed into the surviving records —
// " " on the email is what made Supabase reject the portal invite with
// "Unable to validate email address: invalid format".
//
// Dry-run by default; pass --apply to write. Backs up to novamed-merge-backup.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const KEEP_TENANT = 't1786494577063'
const KEEP_MEMBER = 'm1786494587641'          // the one the lease's memberId points at
const DROP_MEMBERS = ['m1786493437318', 'm1786493669841']
const DEAD_TENANTS = ['t1786493423054', 't1786493659722']
const APPLY = process.argv.includes('--apply')

const { data: members } = await sb.from('members').select('id,data')
const { data: tenants } = await sb.from('tenants').select('id,data')

const keepMember = (members ?? []).find(m => m.id === KEEP_MEMBER)
const keepTenant = (tenants ?? []).find(t => t.id === KEEP_TENANT)
if (!keepMember || !keepTenant) { console.error('Keeper record missing — aborting.'); process.exit(1) }

// Guard: never delete a member that some tenant row actually still backs.
const live = DROP_MEMBERS.filter(id => {
  const m = (members ?? []).find(x => x.id === id)
  return m && (tenants ?? []).some(t => t.id === m.data?.companyId)
})
if (live.length) { console.error(`These still belong to a live company: ${live.join(', ')} — aborting.`); process.exit(1) }

const trimAll = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))
const nextMember = trimAll(keepMember.data)
const nextTenant = trimAll(keepTenant.data)

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — NovaMed Health Australia cleanup\n`)
console.log(`Keeping  member ${KEEP_MEMBER} on tenant ${KEEP_TENANT} (lease l1786494657707, INV-3380)`)
for (const id of DROP_MEMBERS) {
  const m = (members ?? []).find(x => x.id === id)
  console.log(`Deleting member ${id}  "${m?.data?.name}"  companyId=${m?.data?.companyId} (tenant deleted: ${DEAD_TENANTS.includes(m?.data?.companyId)})`)
}
console.log('\nWhitespace fixes:')
for (const [label, before, after] of [['member', keepMember.data, nextMember], ['tenant', keepTenant.data, nextTenant]]) {
  for (const k of Object.keys(after)) {
    if (before[k] !== after[k]) console.log(`  ${label}.${k}: ${JSON.stringify(before[k])} -> ${JSON.stringify(after[k])}`)
  }
}

if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

writeFileSync('novamed-merge-backup.json', JSON.stringify({
  members: (members ?? []).filter(m => [KEEP_MEMBER, ...DROP_MEMBERS].includes(m.id)),
  tenant: keepTenant,
}, null, 2))
console.log('\nBacked up to novamed-merge-backup.json')

const stamp = new Date().toISOString()
const { error: mErr } = await sb.from('members').upsert({ id: KEEP_MEMBER, data: nextMember, updated_at: stamp })
if (mErr) { console.error(`Member update failed: ${mErr.message} — nothing deleted.`); process.exit(1) }
const { error: tErr } = await sb.from('tenants').upsert({ id: KEEP_TENANT, data: nextTenant, updated_at: stamp })
if (tErr) { console.error(`Tenant update failed: ${tErr.message} — nothing deleted.`); process.exit(1) }

for (const id of DROP_MEMBERS) {
  const { error } = await sb.from('members').delete().eq('id', id)
  console.log(error ? `  !! ${id}: ${error.message}` : `  deleted ${id}`)
}

const { data: after } = await sb.from('members').select('id,data')
const bennys = (after ?? []).filter(m => String(m.data?.email ?? '').trim().toLowerCase() === 'benny.z.1742@novamedhealth.com.au')
console.log(`\nVerify: ${bennys.length} Benny Zhao member record(s) remain — ${bennys.map(b => `${b.id} -> ${b.data.companyId}`).join(', ')}`)
