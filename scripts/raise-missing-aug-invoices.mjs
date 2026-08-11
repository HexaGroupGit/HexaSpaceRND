// Raises the August 2026 invoices the bill run never produced.
//
//   CON-254  JC Partners Lawyers  Suite 416  $150 + GST
//     The contract starts 1 Jul 2026 and has never been billed by anything.
//     Xero kept billing their OLD suite (411, contract CON-190, cancelled)
//     through July, so the move to 416 was invoiced by neither system.
//
//   CON-203  RIO GROUP  Suite 29  $900 + GST      [--include-rio]
//     Runs to 31 Aug 2026 but is already flagged `expired`, so the bill run
//     skipped it; the renewal CON-267 only starts 1 Sep. August fell in the
//     gap between the two contracts. Off by default — pass --include-rio.
//
// Numbers continue the shared platform/Xero sequence from the current maximum.
// Raised as `pending` / `not_sent` so nothing reaches the customer until you
// send it; the hourly push will place them in Xero.
// Dry-run by default; pass --apply.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const WITH_RIO = process.argv.includes('--include-rio')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const token = () => Array.from({ length: 24 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[Math.floor(Math.random() * 64)]).join('')
const [{ data: invR }, { data: lsR }, { data: tnR }] = await Promise.all([
  sb.from('invoices').select('id,data'), sb.from('leases').select('id,data'), sb.from('tenants').select('id,data'),
])
const leases = lsR.map((r) => r.data)
const tById = new Map(tnR.map((t) => [t.id, t.data]))

const WANT = [{ con: 'CON-254', space: 'Suite 416' }]
if (WITH_RIO) WANT.push({ con: 'CON-203', space: 'Suite 29' })

let next = Math.max(...invR.map((r) => Number(String(r.data.number).replace(/\D/g, ''))).filter((n) => !isNaN(n)))
const planned = []
for (const w of WANT) {
  const l = leases.find((x) => x.contractNumber === w.con)
  if (!l) { console.error(`${w.con}: lease not found — skipped.`); continue }
  // Never double-raise: bail if anything live already covers August for them.
  const clash = invR.find((r) => r.data.tenantId === l.tenantId && r.data.status !== 'voided' &&
    (r.data.periodStart ?? '') >= '2026-07-25' && (r.data.periodStart ?? '') <= '2026-08-31')
  if (clash) { console.error(`${w.con}: ${clash.data.number} already covers August — skipped.`); continue }

  const rent = Number(l.monthlyRent)
  const number = `INV-${++next}`
  planned.push({
    l,
    row: {
      id: `inv_fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      number,
      source: 'auto-bill',
      status: 'pending',
      issueDate: '2026-08-01',
      dueDate: '2026-08-15',
      createdAt: '2026-08-01',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      tenantId: l.tenantId,
      leaseId: l.id,
      comments: [],
      payments: [],
      payToken: token(),
      reference: '',
      isProrated: false,
      sentStatus: 'not_sent',
      vatEnabled: true,
      discountPct: 0,
      paymentMethod: '',
      creditNoteForId: null,
      lineItems: [{
        id: `li_${l.contractNumber}_2026-08_m`,
        qty: 1,
        unitPrice: rent,
        description: `${w.space} · 1 Aug – 31 Aug 2026`,
        discountPct: 0,
        revenueAccount: 'Membership Fees',
      }],
      raisedBy: 'missing-august-backfill',
    },
  })
}

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'}\n`)
for (const { l, row } of planned) {
  console.log(`  ${row.number}  ${(tById.get(l.tenantId)?.businessName ?? l.tenantId).padEnd(24)} ${l.contractNumber.padEnd(9)} ` +
    `$${row.lineItems[0].unitPrice.toFixed(2)} + GST = $${(row.lineItems[0].unitPrice * 1.1).toFixed(2)}   "${row.lineItems[0].description}"`)
}
if (!planned.length) { console.log('  nothing to raise.'); process.exit(0) }
if (!WITH_RIO) console.log('\n  (RIO GROUP CON-203 not included — pass --include-rio to add it)')
if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

const stamp = new Date().toISOString()
for (const { row } of planned) {
  const { error } = await sb.from('invoices').upsert({ id: row.id, data: row, updated_at: stamp })
  console.log(error ? `  !! ${row.number}: ${error.message}` : `  raised ${row.number}`)
}
console.log('\nRaised as pending / not_sent — send them from the invoice screen when you are ready.')
