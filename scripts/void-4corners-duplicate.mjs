// 4Corners Group and Level Up Consult are one company held as two tenant
// records, each with an active lease on the SAME space (hx_l2_suite1516), so the
// August bill run raised the same charge twice:
//   INV-3300  tc40             $2,900  PAID (Stripe, 7 Aug)
//   INV-3329  t_mtm_4corners   $2,900  pending  ← the duplicate
// Void the unpaid one. Once deployed, the push cron voids its Xero copy too
// (issued 1 Aug, so it clears the syncFrom gate, and nothing is allocated to it).
//
// This does NOT merge the companies or retire the duplicate lease — without
// that, September bills twice again. Dry-run by default; pass --apply.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DUP = 'INV-3329', TWIN = 'INV-3300'
const { data: inv } = await sb.from('invoices').select('id,data')
const dup = inv.find((x) => x.data.number === DUP)
const twin = inv.find((x) => x.data.number === TWIN)
if (!dup || !twin) { console.error('One of the two invoices is missing — aborting.'); process.exit(1) }

const paidOn = (i) => (i.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
// Refuse if the facts moved: only void an unpaid duplicate whose twin is settled.
if (dup.data.status === 'voided') { console.log(`${DUP} is already voided — nothing to do.`); process.exit(0) }
if (paidOn(dup.data) > 0) { console.error(`${DUP} has $${paidOn(dup.data).toFixed(2)} against it — refusing to void.`); process.exit(1) }
if (twin.data.status !== 'paid') { console.error(`${TWIN} is ${twin.data.status}, not paid — refusing to void the twin.`); process.exit(1) }
if (dup.data.periodStart !== twin.data.periodStart || dup.data.periodEnd !== twin.data.periodEnd) {
  console.error('The two invoices cover different periods — not a duplicate. Aborting.'); process.exit(1)
}

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'}\n`)
for (const [label, r] of [[`keep  ${TWIN}`, twin], [`VOID  ${DUP}`, dup]]) {
  const d = r.data
  console.log(`  ${label}  tenant=${d.tenantId}  ${d.periodStart}→${d.periodEnd}  ${d.status}  paid=$${paidOn(d).toFixed(2)}  xero=${d.xeroInvoiceId ? 'linked' : '—'}`)
}
if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

const stamp = new Date().toISOString()
const next = {
  ...dup.data,
  status: 'voided',
  voidedAt: stamp,
  voidReason: `Duplicate of ${TWIN} — same space and period billed on both the 4Corners and Level Up records`,
}
const { error } = await sb.from('invoices').upsert({ id: dup.id, data: next, updated_at: stamp })
if (error) { console.error(error.message); process.exit(1) }
console.log(`\nVoided ${DUP}. The next Xero push will void its copy there (${dup.data.xeroInvoiceId}).`)
