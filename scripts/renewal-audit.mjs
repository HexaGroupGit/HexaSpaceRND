// Will every expiring lease actually auto-renew when it gets there?
// Replicates the roll-forward gate in api/reconcile.js step 4c exactly, and
// flags the dangerous middle ground: leases that neither roll NOR expire, which
// sit "active" past their end date and get skipped by the bill run.
//   node scripts/renewal-audit.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const g = async (t) => ((await sb.from(t).select('id,data')).data ?? []).map(r => ({ ...r.data, id: r.id }))

const [leases, tenants] = await Promise.all([g('leases'), g('tenants')])
const co = (l) => tenants.find(t => t.id === l.tenantId)?.businessName || l.companyName || l.tenantId
const dmy = (d) => { const [y, m, dd] = String(d || '').split('-'); return dd ? `${dd}/${m}/${y}` : '(none)' }
const active = leases.filter(l => l.status === 'active')
const hasActiveSuccessor = (l) => leases.some(x => x.previousContractId === l.id && x.status === 'active')

// Exactly the reconcile gates, minus the endDate<today part (we're asking
// "what happens WHEN it gets there", not "what happens today").
function fate(l) {
  if (!l.endDate) return { k: 'NEVER',  why: 'no end date — never rolls and never expires' }
  if (l.noticeGiven) return { k: 'END',   why: 'notice given' }
  if (l.renewalDeclined) return { k: 'END', why: 'renewal declined' }
  if (l.autoRenew === false) return { k: 'END', why: 'autoRenew = false' }
  if (hasActiveSuccessor(l)) return { k: 'END', why: 'successor contract already active' }
  // Roll-forward blockers that do NOT also trigger the expiry path (3b only
  // expires leases that are explicitly non-renewing) → silent limbo.
  if (l.pendingRenewalApproval) return { k: 'STUCK', why: 'pendingRenewalApproval — waits for an admin, meanwhile no roll and no expiry' }
  if (l.needsOffboard || l.offboardedAt) return { k: 'STUCK', why: 'flagged for offboarding — will neither roll nor expire' }
  return { k: 'ROLL', why: 'auto-renews' }
}

const groups = { ROLL: [], END: [], STUCK: [], NEVER: [] }
for (const l of active) groups[fate(l).k].push(l)

console.log(`Active leases: ${active.length}\n`)
console.log(`  will AUTO-RENEW at term end : ${groups.ROLL.length}`)
console.log(`  will END (notice/declined/superseded): ${groups.END.length}`)
console.log(`  STUCK — neither rolls nor expires   : ${groups.STUCK.length}`)
console.log(`  NO END DATE — never rolls, never ends: ${groups.NEVER.length}`)

const show = (list, title) => {
  if (!list.length) return
  console.log(`\n${title}`)
  for (const l of list.sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))) {
    console.log(`  ${dmy(l.endDate).padEnd(12)} ${String(l.contractNumber ?? l.id).padEnd(14)} ${co(l).slice(0, 34).padEnd(35)} $${String(l.monthlyRent ?? 0).padStart(8)}  ${fate(l).why}`)
  }
}
show(groups.STUCK, '⚠ STUCK — no notice given, but these will NOT auto-renew')
show(groups.NEVER, '⚠ NO END DATE — outside the renewal lifecycle entirely')
show(groups.END, 'Ending by design (notice / declined / superseded)')

// Anything already past its end date and still active is a live symptom.
const today = new Date().toISOString().split('T')[0]
const overdue = active.filter(l => l.endDate && l.endDate < today)
console.log(`\nActive leases ALREADY past their end date: ${overdue.length}`)
for (const l of overdue) console.log(`  ${dmy(l.endDate)} ${l.contractNumber} ${co(l)} — ${fate(l).why}`)

// Next 120 days of renewals, so the ones about to roll are visible.
const soon = groups.ROLL.filter(l => l.endDate && (new Date(l.endDate) - new Date(today)) / 86400000 <= 120)
console.log(`\nAuto-renewing within 120 days: ${soon.length}`)
for (const l of soon.sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))) {
  console.log(`  ${dmy(l.endDate)}  ${String(l.contractNumber).padEnd(12)} ${co(l).slice(0, 34).padEnd(35)} $${l.monthlyRent}`)
}
