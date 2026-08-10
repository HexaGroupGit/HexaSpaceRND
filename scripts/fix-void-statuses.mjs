// Repairs the 37 invoices the July-2026 migration audit stamped with
// voidedAt/voidReason while leaving `status` alone. See audit-void-statuses.mjs
// for the classification this acts on.
//
//   A (9)  unpaid + overdue/pending → really were scrapped: set status=voided,
//          which also stops the overdue reminders (102 sent across the batch).
//   B (28) a real payment is recorded → the void was superseded by the customer
//          paying. Retire the misleading flags (keeping the reason as history)
//          so nothing reads them as voided later.
//
// Dry-run by default; pass --apply to write.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: invR } = await sb.from('invoices').select('id,data')
const rows = invR.filter(r => r.data.voidedAt && r.data.status !== 'voided')

const toVoid = [], toClear = [], unexpected = []
for (const r of rows) {
  const i = r.data
  const hasRealPayment = (i.payments ?? []).some(p => Number(p.amount ?? 0) > 0)
  if (hasRealPayment) toClear.push(r)
  else if (['overdue', 'pending'].includes(i.status)) toVoid.push(r)
  else unexpected.push(r)
}

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${rows.length} invoices carry voidedAt with a non-voided status\n`)
console.log(`A. set status=voided (${toVoid.length}):`)
for (const r of toVoid) console.log(`   ${r.data.number}  ${r.data.issueDate}  ${r.data.status} → voided   (reminders sent: ${r.data.remindersSent ?? 0})`)
console.log(`\nB. retire the stale void flags, status untouched (${toClear.length}):`)
for (const r of toClear) console.log(`   ${r.data.number}  ${r.data.issueDate}  stays ${r.data.status}`)
if (unexpected.length) {
  console.log(`\n!! ${unexpected.length} did not match either rule — left alone, review by hand:`)
  for (const r of unexpected) console.log(`   ${r.data.number} status=${r.data.status}`)
}

if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

const stamp = new Date().toISOString()
let a = 0, b = 0
for (const r of toVoid) {
  const next = { ...r.data, status: 'voided', voidConfirmedAt: stamp }
  const { error } = await sb.from('invoices').upsert({ id: r.id, data: next, updated_at: stamp })
  if (error) { console.error(`  !! ${r.data.number}: ${error.message}`); continue }
  a++
}
for (const r of toClear) {
  // Keep the reason as history under a name nothing reads as "this is void".
  const { voidedAt, voidReason, ...rest } = r.data
  const next = { ...rest, voidSupersededAt: stamp, priorVoidReason: voidReason ?? null, priorVoidedAt: voidedAt }
  const { error } = await sb.from('invoices').upsert({ id: r.id, data: next, updated_at: stamp })
  if (error) { console.error(`  !! ${r.data.number}: ${error.message}`); continue }
  b++
}
console.log(`\nVoided ${a}/${toVoid.length}. Cleared flags on ${b}/${toClear.length}.`)

const { data: check } = await sb.from('invoices').select('id,data')
console.log(`Verify: ${check.filter(x => x.data.voidedAt && x.data.status !== 'voided').length} still mismatched (expect 0).`)
