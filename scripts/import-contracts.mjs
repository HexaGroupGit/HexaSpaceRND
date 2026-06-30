// Imports an OfficeRND contracts CSV into the leases table, matched to the
// companies + members already imported. Classifies each into a membership type.
// Usage: node scripts/import-contracts.mjs "<contracts.csv>"
import fs from 'fs'

function parseEnv(p) { const o = {}; if (!fs.existsSync(p)) return o; for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue; const i = t.indexOf('='); o[t.slice(0, i).trim()] = t.slice(i + 1).trim() } return o }
function parseCSV(text) { const rows = []; let row = [], f = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c } else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = '' } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' } else if (c === '\r') {} else f += c } } if (f.length || row.length) { row.push(f); rows.push(row) } return rows }
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
function isoDate(s) { if (!s) return ''; const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/); if (!m) return ''; const mo = MONTHS[m[2].toLowerCase()]; if (!mo) return ''; return `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` }
const norm = (s) => (s || '').trim().toLowerCase()
function monthsBetween(a, b) { if (!a || !b) return 0; const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number); return (by * 12 + bm) - (ay * 12 + am) + 1 }

const env = parseEnv('.env.local'); const URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function fetchAll(table) { const res = await fetch(`${URL}/rest/v1/${table}?select=id,data&limit=2000`, { headers: H }); return res.ok ? res.json() : [] }
const tenants = await fetchAll('tenants'); const members = await fetchAll('members')
const tMap = new Map(tenants.map((t) => [norm(t.data.businessName), t.id]))
const mMap = new Map(members.map((m) => [norm(m.data.name), { id: m.id, type: m.data.membershipType || '' }]))
console.log(`Loaded ${tenants.length} companies, ${members.length} members for matching.`)

function classify(text) { const t = (text || '').toLowerCase(); if (t.includes('virtual')) return 'Virtual Office'; if (t.includes('flex')) return 'Flexible Desk'; if (t.includes('dedicated')) return 'Dedicated Desk'; if (t.includes('media') || t.includes('studio') || t.includes('podcast')) return 'Studio'; return 'Private Office' }
function mapStatus(s) { const x = norm(s); return x === 'signed' ? 'active' : x === 'not_signed' ? 'pending' : x === 'terminated' ? 'terminated' : x === 'canceled' ? 'cancelled' : x || 'active' }

const rows = parseCSV(fs.readFileSync(process.argv[2], 'utf8')); const head = rows.shift(); const ix = (n) => head.indexOf(n)
let matchedCo = 0, matchedMem = 0
const leases = []
for (const r of rows) {
  const num = r[ix('Number')]; if (!num) continue
  const team = (r[ix('Team')] || '').trim(); const memberName = (r[ix('Member')] || '').trim()
  const tenantId = tMap.get(norm(team)) || ''
  const mem = mMap.get(norm(memberName)); const memberId = mem?.id || ''
  if (tenantId) matchedCo++; if (memberId) matchedMem++
  const startDate = isoDate(r[ix('Start Date')]); const endDate = isoDate(r[ix('End Date')])
  const total = Number(r[ix('Total')] || 0)
  const months = monthsBetween(startDate, endDate)
  const monthlyRent = months > 0 ? Math.round(total / months) : total
  const resource = (r[ix('Resources')] || '').trim(); const recurring = (r[ix('Recurring Plans')] || '').trim()
  const membershipType = classify(`${recurring} ${resource} ${mem?.type || ''}`)
  leases.push({ id: num, data: {
    id: num, contractNumber: num, tenantId, memberId, memberName, companyName: team,
    spaceId: '', planName: resource || recurring || 'Membership', resource, recurringPlans: recurring,
    oneOffPlans: r[ix('One-off Plans')] || '', membershipType,
    startDate, endDate, signDate: isoDate(r[ix('Sign Date')]), status: mapStatus(r[ix('Status')]),
    total, monthlyRent, location: r[ix('Location')] || 'Hexa Space', source: 'officernd-import',
    createdAt: isoDate(r[ix('Sign Date')]) || startDate || new Date().toISOString().split('T')[0],
  } })
}
console.log(`Parsed ${leases.length} contracts · matched ${matchedCo} companies, ${matchedMem} members.`)

for (let i = 0; i < leases.length; i += 500) {
  const chunk = leases.slice(i, i + 500)
  const res = await fetch(`${URL}/rest/v1/leases`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(chunk) })
  if (!res.ok) { console.error('leases insert failed', res.status, (await res.text()).slice(0, 300)); process.exit(1) }
  console.log(`  leases: upserted ${Math.min(i + 500, leases.length)}/${leases.length}`)
}
console.log('Contracts import complete.')
