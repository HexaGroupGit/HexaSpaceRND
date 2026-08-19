// Merge the duplicate "I DO International Pty Ltd" company created by the admin
// function-booking form (t1783646448293, clientType=function, status=prospect)
// into the real member company tc30 (OfficeRND import, active, 8/8 credits).
//
// The function form has no company picker, so booking FN-433595 spawned a fresh
// client record instead of linking the existing one. That stranded Katie Sun's
// member record and the two live function invoices off the real company.
//
// Keeps tc30 (email, credits, lease, portal invite, billing/contact persons),
// moves the member + 3 invoices + the function booking onto it, carries the ABN
// and the Xero contact id across (tc30 has neither; INV-3366/3368 are already
// pushed to that Xero contact), then retires the duplicate.
// Dry-run by default; pass --apply to write.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DUP = 't1783646448293'
const KEEP = 'tc30'
const APPLY = process.argv.includes('--apply')
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const { data: tenants } = await sb.from('tenants').select('id,data').in('id', [DUP, KEEP])
const dup = tenants?.find((t) => t.id === DUP)
const keep = tenants?.find((t) => t.id === KEEP)
if (!keep) { console.error(`Keeper ${KEEP} is missing — aborting.`); process.exit(1) }
if (!dup) { console.log(`Duplicate ${DUP} already retired — nothing to do.`); process.exit(0) }
if (norm(dup.data.businessName) !== norm(keep.data.businessName)) {
  console.error(`Name mismatch ("${dup.data.businessName}" vs "${keep.data.businessName}") — aborting.`); process.exit(1)
}

const { data: allMem } = await sb.from('members').select('id,data')
const { data: allInv } = await sb.from('invoices').select('id,data')
const { data: allFn } = await sb.from('function_bookings').select('id,data')
const members = allMem.filter((m) => m.data.companyId === DUP)
const invoices = allInv.filter((i) => i.data.tenantId === DUP)
const fns = allFn.filter((f) => f.data.tenantId === DUP || f.data.companyId === DUP)

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — merge ${DUP} → ${KEEP} ("${keep.data.businessName}")\n`)
console.log(`Members (${members.length}):`)
for (const m of members) console.log(`  ${m.id}  ${m.data.name} <${m.data.email}> ${m.data.status}`)
console.log(`Invoices (${invoices.length}):`)
for (const i of invoices) console.log(`  ${i.data.number}  ${i.data.issueDate}  ${i.data.status}  xero=${i.data.xeroInvoiceId ? 'linked' : '—'}`)
console.log(`Function bookings (${fns.length}):`)
for (const f of fns) console.log(`  ${f.data.ref}  ${f.data.eventName}  stage=${f.data.stage}`)

// Only backfill fields the keeper is missing — never overwrite live tc30 data.
const patch = {}
if (!keep.data.abn && dup.data.abn) patch.abn = dup.data.abn
if (!keep.data.xeroContactId && dup.data.xeroContactId) patch.xeroContactId = dup.data.xeroContactId
console.log(`\nBackfilling onto ${KEEP}: ${Object.keys(patch).length ? JSON.stringify(patch) : '(nothing)'}`)
console.log(`Keeper retains: email=${keep.data.email} status=${keep.data.status} credits=${keep.data.creditsRemaining}/${keep.data.monthlyAllowance}`)

if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

const stamp = new Date().toISOString()
const mark = { mergedFromTenantId: DUP, mergedAt: stamp }
const move = async (table, rows, mut) => {
  let n = 0
  for (const r of rows) {
    const { error } = await sb.from(table).upsert({ id: r.id, data: { ...mut(r.data), ...mark }, updated_at: stamp })
    if (error) { console.error(`  !! ${table}/${r.id}: ${error.message}`); continue }
    n++
  }
  console.log(`Moved ${n}/${rows.length} ${table}.`)
  return n === rows.length
}

const ok = [
  await move('members', members, (d) => ({ ...d, companyId: KEEP })),
  await move('invoices', invoices, (d) => ({ ...d, tenantId: KEEP })),
  await move('function_bookings', fns, (d) => ({ ...d, tenantId: KEEP, companyId: KEEP })),
].every(Boolean)

if (!ok) { console.error('\nNot everything moved — leaving the duplicate in place for a retry.'); process.exit(1) }

const { error: kErr } = await sb.from('tenants').upsert({ id: KEEP, data: { ...keep.data, ...patch, ...mark }, updated_at: stamp })
if (kErr) { console.error(`Keeper update failed: ${kErr.message} — duplicate left in place.`); process.exit(1) }

const { error: dErr } = await sb.from('tenants').delete().eq('id', DUP)
console.log(dErr ? `Delete failed: ${dErr.message}` : `Deleted duplicate tenant ${DUP}.`)

const { data: cm } = await sb.from('members').select('id,data')
const { data: ci } = await sb.from('invoices').select('id,data')
const { data: cf } = await sb.from('function_bookings').select('id,data')
console.log(`\nVerify — on ${KEEP}: ${cm.filter(m => m.data.companyId === KEEP).length} members, ` +
  `${ci.filter(i => i.data.tenantId === KEEP).length} invoices, ${cf.filter(f => f.data.companyId === KEEP).length} function bookings.`)
console.log(`Stragglers on ${DUP}: ${cm.filter(m => m.data.companyId === DUP).length + ci.filter(i => i.data.tenantId === DUP).length + cf.filter(f => f.data.companyId === DUP).length}`)
