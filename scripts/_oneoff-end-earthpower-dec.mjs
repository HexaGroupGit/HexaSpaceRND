// Earth Power Co (Tiani O'Neill) leaves Suite 18 on 09/12/2026; a new member
// takes it from January. CON-227 already reads endDate 2026-12-09, but
// autoRenew is unset, so reconcile step (a) would roll it forward on 10/12 and
// keep billing. autoRenew: false makes the end date stick: reconcile 3b expires
// it on 10/12 and the offboarding cascade frees the suite and revokes access.
// It also lets the contract picker offer Suite 18 as "free after 09/12/2026".
//
// Dry-run by default; pass --apply to write.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildMonthlyInvoiceForLease } from '../src/lib/billingEngine.js'

const APPLY = process.argv.includes('--apply')
const END = '2026-12-09'
const NL = String.fromCharCode(10)
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(NL)
  .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: row, error } = await sb.from('leases').select('data').eq('id', 'CON-227').single()
if (error) throw error
const lease = row.data
if (lease.status !== 'active' || lease.endDate !== END || lease.noticeGiven) {
  throw new Error(`GUARD: CON-227 changed: ${lease.status} ${lease.endDate} notice=${lease.noticeGiven}`)
}
const note = '[10/11/2026 — ends 09/12/2026 per Eric; autoRenew off so it expires instead of rolling]'
const patch = { autoRenew: false, notes: [lease.notes, note].filter(Boolean).join(' ') }

console.log(`CON-227 Earth Power Co  ${lease.startDate}..${lease.endDate}  autoRenew ${lease.autoRenew ?? '(unset - would renew)'} -> false`)
const { data: inv } = await sb.from('invoices').select('data')
const invoices = (inv ?? []).map((r) => r.data)
for (const m of ['2026-12-01', '2027-01-01']) {
  const r = buildMonthlyInvoiceForLease({ ...lease, ...patch }, m, { invoices })
  console.log(`  ${m.slice(0, 7)}  ${r.reason ?? (r.invoice.lineItems ?? []).map((x) => `${x.description} $${x.unitPrice}`).join('; ')}`)
}
if (!APPLY) { console.log('DRY RUN - pass --apply to write.'); process.exit(0) }

writeFileSync('con-227-end-backup.json', JSON.stringify(lease, null, 2))
const { error: upErr } = await sb.from('leases').update({ data: { ...lease, ...patch }, updated_at: new Date().toISOString() }).eq('id', 'CON-227')
if (upErr) throw upErr
console.log('Applied. Previous row saved to con-227-end-backup.json')
process.exit(0)
