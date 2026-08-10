// The July-2026 migration audit stamped voidedAt/voidReason on a batch of
// invoices but left `status` as paid/overdue, so they still count as owing and
// kept chasing customers. This classifies each one; it writes nothing.
//
// The app's own void only sets status:'voided' (useStore.js) and never writes
// voidedAt, so these fields can only have come from the audit scripts.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const [{ data: invR }, { data: tnR }, { data: lsR }] = await Promise.all([
  sb.from('invoices').select('id,data'), sb.from('tenants').select('id,data'), sb.from('leases').select('id,data'),
])
const tById = new Map(tnR.map(t => [t.id, t.data]))
const lById = new Map(lsR.map(l => [l.id, l.data]))
const total = (i) => (i.lineItems ?? []).reduce((s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0)

const rows = invR.map(r => r.data).filter(i => i.voidedAt && i.status !== 'voided')
const buckets = { void_it: [], paid_for_real: [], review: [] }

for (const i of rows) {
  const paid = (i.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const hasRealPayment = (i.payments ?? []).some(p => Number(p.amount ?? 0) > 0)
  const rec = { i, paid, hasRealPayment, inc: Math.round(total(i) * (i.vatEnabled !== false ? 1.1 : 1) * 100) / 100 }
  if (hasRealPayment) buckets.paid_for_real.push(rec)          // money actually received — do NOT void
  else if (['overdue', 'pending'].includes(i.status)) buckets.void_it.push(rec)
  else buckets.review.push(rec)                                 // status 'paid' but no payment recorded
}

const show = (label, list, note) => {
  console.log(`\n${'═'.repeat(78)}\n${label}  (${list.length})\n${note}\n${'═'.repeat(78)}`)
  let sum = 0
  for (const { i, inc, paid } of list.sort((a, z) => (a.i.number > z.i.number ? 1 : -1))) {
    sum += inc
    const t = tById.get(i.tenantId)
    const lease = lById.get(i.leaseId)
    console.log(`  ${i.number}  ${i.issueDate}  ${String(i.status).padEnd(8)} $${inc.toFixed(2).padStart(9)}` +
      `  paid=$${paid.toFixed(2).padStart(8)}  xero=${i.xeroInvoiceId ? 'y' : '—'}  rem=${String(i.remindersSent ?? 0).padStart(2)}` +
      `  lease=${lease?.status ?? '—'}  "${(t?.businessName ?? '?').slice(0, 28)}"`)
  }
  console.log(`  ${'─'.repeat(74)}\n  total $${sum.toFixed(2)}`)
}

show('A. VOID THEM — unpaid, still chasing', buckets.void_it,
  '   status is overdue/pending with no payment recorded. These are the ones still\n   counted as owing and still sending reminders. Set status=voided.')
show('B. DO NOT VOID — money actually received', buckets.paid_for_real,
  '   a real payment is recorded against these, so the audit void was superseded.\n   The stale voidedAt/voidReason should be cleared instead.')
show('C. REVIEW — marked paid but no payment recorded', buckets.review,
  '   status says paid yet no payment line exists. Needs a human decision:\n   genuinely settled (clear voidedAt) or never billed (void).')

console.log(`\n${rows.length} invoices carry voidedAt with a non-voided status.`)
console.log(`Reminders already sent across all of them: ${rows.reduce((s, i) => s + (i.remindersSent ?? 0), 0)}`)
