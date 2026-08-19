// Which active contracts end soon, and which of those will auto-renew?
// Mirrors the roll-forward rule in api/reconcile.js step (a) exactly.
//   node scripts/renewals-report.mjs [days]      (default 90)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DAYS = Number(process.argv[2] || 90)
const TODAY = '2026-07-29'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const g = async (t) => ((await sb.from(t).select('id,data')).data ?? []).map(r => ({ ...r.data, id: r.id }))
const [leases, tenants, spaces] = await Promise.all([g('leases'), g('tenants'), g('spaces')])
const { data: st } = await sb.from('settings').select('data').eq('id', 'global').single()
const autoApprove = st?.data?.billingRules?.autoApproveRenewals ?? st?.data?.autoApproveRenewals ?? false

const dmy = (d) => { const [y, m, dd] = String(d || '').split('-'); return dd ? `${dd}/${m}/${y}` : '—' }
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000)
const money = (v) => `$${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
const co = (l) => tenants.find(t => t.id === l.tenantId)?.businessName || l.companyName || l.tenantId

const hasActiveSuccessor = (l) => leases.some(x => x.previousContractId === l.id && x.status === 'active')

// Exactly the reconcile.js (a) gate, minus the endDate<today part so we can
// answer "will this renew when it gets there?" ahead of time.
function renewalState(l) {
  if (l.noticeGiven) return { renews: false, why: 'notice given' }
  if (l.renewalDeclined) return { renews: false, why: 'renewal declined' }
  if (l.autoRenew === false) return { renews: false, why: 'autoRenew = false' }
  if (l.terminationScheduledFor) return { renews: false, why: `termination scheduled ${dmy(l.terminationScheduledFor)}` }
  if (l.needsOffboard || l.offboardedAt) return { renews: false, why: 'offboarding' }
  if (hasActiveSuccessor(l)) return { renews: false, why: 'successor contract already signed' }
  if (l.pendingRenewalApproval) return { renews: false, why: 'AWAITING YOUR APPROVAL' }
  return { renews: true, why: autoApprove ? 'auto-renews (auto-approved)' : 'auto-renews (then needs your approval)' }
}
// Renewal term = the same length as the current term (reconcile.js line 527).
function nextEnd(l) {
  if (!l.endDate) return '—'
  const end = new Date(`${l.endDate}T00:00:00Z`)
  const start = new Date(`${l.startDate ?? l.endDate}T00:00:00Z`)
  const ms = end - start
  return new Date(end.getTime() + (ms > 0 ? ms : 365 * 86400000)).toISOString().split('T')[0]
}

const active = leases.filter(l => l.status === 'active' && l.endDate)
const soon = active.filter(l => { const d = daysBetween(TODAY, l.endDate); return d <= DAYS })
  .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)))

console.log(`Today ${dmy(TODAY)} · ${active.length} active contracts · ${soon.length} ending within ${DAYS} days`)
console.log(`Renewals auto-approve setting: ${autoApprove ? 'ON — renewals go straight through' : 'OFF — each renewal waits for your approval'}\n`)

const overdue = soon.filter(l => daysBetween(TODAY, l.endDate) < 0)
const upcoming = soon.filter(l => daysBetween(TODAY, l.endDate) >= 0)

function table(rows, title) {
  if (!rows.length) return
  console.log(`\n${title}`)
  console.log('  ' + 'END'.padEnd(12) + 'DAYS'.padStart(5) + '  ' + 'CONTRACT'.padEnd(11) + 'COMPANY'.padEnd(34) + 'RENT'.padStart(11) + '  RENEWS?')
  for (const l of rows) {
    const d = daysBetween(TODAY, l.endDate)
    const s = renewalState(l)
    const tag = s.renews ? `YES → ${dmy(nextEnd(l))}` : `NO — ${s.why}`
    console.log('  ' + dmy(l.endDate).padEnd(12) + String(d).padStart(5) + '  ' +
      String(l.contractNumber ?? l.id).slice(0, 10).padEnd(11) + String(co(l)).slice(0, 33).padEnd(34) +
      money(l.monthlyRent).padStart(11) + '  ' + tag)
  }
}

table(overdue, `PAST TERM END — should already have rolled (${overdue.length})`)
table(upcoming, `ENDING IN THE NEXT ${DAYS} DAYS (${upcoming.length})`)

const willRenew = soon.filter(l => renewalState(l).renews)
const wont = soon.filter(l => !renewalState(l).renews)
console.log(`\nSUMMARY`)
console.log(`  auto-renewing : ${willRenew.length}  (${money(willRenew.reduce((s, l) => s + Number(l.monthlyRent || 0), 0))}/mo)`)
console.log(`  NOT renewing  : ${wont.length}  (${money(wont.reduce((s, l) => s + Number(l.monthlyRent || 0), 0))}/mo at risk)`)
for (const l of wont) console.log(`      ${dmy(l.endDate)}  ${co(l)} — ${renewalState(l).why}`)
const awaiting = active.filter(l => l.pendingRenewalApproval)
if (awaiting.length) {
  console.log(`\n  ⚠ ALREADY ROLLED, AWAITING YOUR APPROVAL: ${awaiting.length}`)
  for (const l of awaiting) console.log(`      ${co(l)} (${l.contractNumber ?? l.id}) → now ends ${dmy(l.endDate)}, renewed ${dmy(String(l.autoRenewedAt || '').split('T')[0])}`)
}
