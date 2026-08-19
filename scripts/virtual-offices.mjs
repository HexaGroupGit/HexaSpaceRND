// All virtual offices, in chronological order of when the client started.
//   node scripts/virtual-offices.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const g = async (t) => ((await sb.from(t).select('id,data')).data ?? []).map(r => ({ ...r.data, id: r.id }))

const [spaces, leases, tenants] = await Promise.all([g('spaces'), g('leases'), g('tenants')])
const dmy = (d) => { const [y, m, dd] = String(d || '').split('-'); return dd ? `${dd}/${m}/${y}` : '—' }
const money = (v) => Number(v || 0) ? `$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'
const co = (l) => tenants.find(t => t.id === l.tenantId)?.businessName || l.companyName || l.tenantId

// Virtual offices come in two shapes: a dedicated `virtual` space (Suite 4xx),
// and a lease whose membership type is Virtual Office with no space attached.
const voSpaces = spaces.filter(s => s.type === 'virtual')
const isVoLease = (l) => {
  if (/virtual/i.test(l.membershipType || '')) return true
  const sp = spaces.find(s => s.id === l.spaceId)
  return sp?.type === 'virtual'
}
const voLeases = leases.filter(isVoLease)

console.log(`Virtual office spaces in inventory: ${voSpaces.length}`)
console.log(`Leases that are Virtual Office:     ${voLeases.length}  (active ${voLeases.filter(l => l.status === 'active').length})\n`)

const rows = voLeases.map(l => ({
  start: l.startDate || '', end: l.endDate || '',
  suite: spaces.find(s => s.id === l.spaceId)?.unitNumber || l.resource || '(no suite)',
  company: co(l), contract: l.contractNumber || l.id, status: l.status,
  rent: l.monthlyRent,
})).sort((a, b) => String(a.start).localeCompare(String(b.start)) || a.company.localeCompare(b.company))

const show = (list, title) => {
  if (!list.length) return
  console.log(`\n${title} (${list.length})`)
  console.log('  ' + 'STARTED'.padEnd(12) + 'ENDS'.padEnd(12) + 'SUITE'.padEnd(12) + 'COMPANY'.padEnd(36) + 'RENT'.padStart(10) + '  CONTRACT')
  for (const r of list) {
    console.log('  ' + dmy(r.start).padEnd(12) + dmy(r.end).padEnd(12) + String(r.suite).slice(0, 11).padEnd(12) +
      String(r.company).slice(0, 35).padEnd(36) + money(r.rent).padStart(10) + '  ' + r.contract)
  }
}

show(rows.filter(r => r.status === 'active'), 'ACTIVE — oldest first')
show(rows.filter(r => r.status !== 'active'), 'PAST / OTHER')

const active = rows.filter(r => r.status === 'active')
console.log(`\nActive VO revenue: $${active.reduce((s, r) => s + Number(r.rent || 0), 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}/mo ex GST`)

// Suites with no active lease against them.
const takenSpaceIds = new Set(voLeases.filter(l => l.status === 'active').map(l => l.spaceId))
const vacant = voSpaces.filter(s => !takenSpaceIds.has(s.id))
console.log(`\nVO suites with no active lease: ${vacant.length}`)
if (vacant.length) console.log('  ' + vacant.map(s => s.unitNumber).sort().join(', '))
