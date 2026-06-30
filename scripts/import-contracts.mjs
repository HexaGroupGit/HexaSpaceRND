// Import an OfficeRND contracts CSV into the leases table, matched to the
// already-imported companies/members AND linked to the right space (suite),
// so each office shows the company leasing it.
//
//   node scripts/import-contracts.mjs "<contracts.csv>"            # dry run (report only)
//   node scripts/import-contracts.mjs "<contracts.csv>" --commit   # write leases + occupancy
//
// Floor mapping (confirmed): Level 4 = bare "N" / "Office N";  Level 2 = "Suite N".
// "188 Office" is skipped (deleted from the layout). Reads keys from .env.local.
import fs from 'fs'

const COMMIT = process.argv.includes('--commit')
const TODAY = '2026-06-30'

function parseEnv(p) { const o = {}; if (!fs.existsSync(p)) return o; for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue; const i = t.indexOf('='); o[t.slice(0, i).trim()] = t.slice(i + 1).trim() } return o }
function parseCSV(text) { const rows = []; let row = [], f = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c } else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = '' } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' } else if (c === '\r') {} else f += c } } if (f.length || row.length) { row.push(f); rows.push(row) } return rows }
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
function isoDate(s) { if (!s) return ''; const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/); if (!m) return ''; const mo = MONTHS[m[2].toLowerCase()]; if (!mo) return ''; return `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` }
function monthsBetween(a, b) { if (!a || !b) return 0; const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number); return (by * 12 + bm) - (ay * 12 + am) + 1 }
const norm = (s) => (s || '').trim().toLowerCase()

const env = parseEnv('.env.local'); const URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env'); process.exit(1) }
const HDR = { apikey: KEY, Authorization: `Bearer ${KEY}` }
async function fetchAll(table) { const res = await fetch(`${URL}/rest/v1/${table}?select=id,data&limit=5000`, { headers: HDR }); return res.ok ? res.json() : [] }
async function bulkUpsert(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: { ...HDR, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) })
    if (!res.ok) { console.error(`${table} upsert failed`, res.status, (await res.text()).slice(0, 300)); process.exit(1) }
  }
}

// resource token → target { kind, floor, n }  (null = ignore / skip)
function classify(tok) {
  const t = tok.trim(); if (!t) return null
  let m
  if (/^188/i.test(t)) return { kind: 'skip' }                                  // 188 Office — deleted
  if ((m = t.match(/^(\d{1,3})$/))) return { kind: 'office', floor: 'l4', n: +m[1] }
  if ((m = t.match(/^office\s*(\d+)/i))) return { kind: 'office', floor: 'l4', n: +m[1] }
  if ((m = t.match(/^suite\s*(\d+)/i))) { const n = +m[1]; return (n === 88 || n >= 200) ? { kind: 'virtual', n } : { kind: 'office', floor: 'l2', n } }
  if (/^vo\s*\d+/i.test(t)) return { kind: 'virtual' }
  if (/dedicated desk/i.test(t)) { m = t.match(/(\d+)/); return { kind: 'desk', n: m ? +m[1] : null } }
  if (/studio|media|podcast/i.test(t)) return { kind: 'studio' }
  if (/flex/i.test(t)) return { kind: 'flex' }
  if (/parking/i.test(t)) return { kind: 'parking' }
  return { kind: 'other' }
}
const splitResources = (s) => (s || '').split(/[,+]/).map((x) => x.trim()).filter(Boolean)
const KIND_TYPE = { office: 'Private Office', virtual: 'Virtual Office', desk: 'Dedicated Desk', flex: 'Flexible Desk', studio: 'Studio', parking: 'Parking', other: 'Private Office' }
const fname = (f) => f === 'l4' ? 'Level 4 & 5' : f === 'l2' ? 'Level 2' : f === 'virtual' ? 'Level 2' : ''
const mapStatus = (s) => { const x = norm(s); return x === 'signed' ? 'active' : x === 'not_signed' ? 'pending' : x === 'terminated' ? 'terminated' : (x === 'canceled' || x === 'cancelled') ? 'cancelled' : x || 'active' }

// ── Load ──
const tenants = await fetchAll('tenants'); const members = await fetchAll('members'); const spacesRows = await fetchAll('spaces')
const tMap = new Map(tenants.map((t) => [norm(t.data.businessName), t.id]))
const mMap = new Map(members.map((m) => [norm(m.data.name), m.id]))
const spaces = spacesRows.map((s) => s.data)
const officeByFloorN = new Map(spaces.filter((s) => s.type === 'office').map((s) => [`${s.floor}:${parseInt(String(s.unitNumber).replace(/\D/g, ''), 10)}`, s]))
const deskByN = new Map(spaces.filter((s) => s.type === 'desk').map((s) => [parseInt(String(s.unitNumber).replace(/\D/g, ''), 10), s]))
console.log(`Loaded ${tenants.length} companies, ${members.length} members, ${spaces.length} spaces.`)

const rows = parseCSV(fs.readFileSync(process.argv[2], 'utf8')); const head = rows.shift(); const ix = (n) => head.indexOf(n)
const data = rows.filter((r) => r[ix('Number')])

const ACTIVE = new Set(['active', 'pending'])
const leases = []
const officeOccupant = new Map()    // spaceId -> lease meta (latest active)
const deskAssign = new Map()
const unmatched = []
let matchedCo = 0

for (const r of data) {
  const num = r[ix('Number')]
  const team = (r[ix('Team')] || '').trim(); const memberName = (r[ix('Member')] || '').trim()
  const tenantId = tMap.get(norm(team)) || ''; const memberId = mMap.get(norm(memberName)) || ''
  if (tenantId) matchedCo++
  const startDate = isoDate(r[ix('Start Date')]); const endDate = isoDate(r[ix('End Date')])
  const status = mapStatus(r[ix('Status')])
  const total = Number(r[ix('Total')] || 0); const months = monthsBetween(startDate, endDate)
  const monthlyRent = months > 0 ? Math.round(total / months) : total
  const resource = (r[ix('Resources')] || '').trim(); const recurring = (r[ix('Recurring Plans')] || '').trim()

  // resolve the primary space this contract sits on
  let spaceId = '', spaceLabel = '', primaryKind = '', primaryFloor = ''
  for (const tok of splitResources(resource)) {
    const c = classify(tok); if (!c || c.kind === 'skip') continue
    if (!primaryKind) { primaryKind = c.kind; primaryFloor = c.floor || (c.kind === 'virtual' ? 'virtual' : '') }
    let space = null
    if (c.kind === 'office') { space = officeByFloorN.get(`${c.floor}:${c.n}`); if (!space) { unmatched.push({ team, resource: tok, floor: c.floor, n: c.n }); continue } }
    else if (c.kind === 'desk') space = deskByN.get(c.n)
    else if (c.kind === 'virtual') space = spaces.find((s) => s.type === 'virtual')
    if (!space) continue
    spaceId = space.id; spaceLabel = `${space.unitNumber} (${space.floor})`
    if (c.kind === 'office' && ACTIVE.has(status)) {
      const cur = officeOccupant.get(space.id)
      if (!cur || (startDate || '') >= (cur.startDate || '')) officeOccupant.set(space.id, { num, team, tenantId, status, startDate })
    }
    if (c.kind === 'desk' && ACTIVE.has(status)) deskAssign.set(space.id, { memberId, tenantId })
    break // primary resource only
  }
  // No usable resource token — fall back to the recurring plan name for the type.
  if (!primaryKind) {
    const rt = recurring.toLowerCase()
    if (rt.includes('virtual') || /\bvo\s*\d/.test(rt)) primaryKind = 'virtual'
    else if (rt.includes('flex')) primaryKind = 'flex'
    else if (rt.includes('dedicated')) primaryKind = 'desk'
    else if (rt.includes('media') || rt.includes('studio') || rt.includes('podcast')) primaryKind = 'studio'
  }

  leases.push({ id: num, data: {
    id: num, contractNumber: num, tenantId, memberId, memberName, companyName: team,
    spaceId, resource, planName: resource || recurring || 'Membership', recurringPlans: recurring, oneOffPlans: r[ix('One-off Plans')] || '',
    membershipType: KIND_TYPE[primaryKind] || 'Private Office', level: fname(primaryFloor),
    startDate, endDate, signDate: isoDate(r[ix('Sign Date')]), status,
    total, monthlyRent, location: r[ix('Location')] || 'Hexa Space', source: 'officernd-import',
    createdAt: isoDate(r[ix('Sign Date')]) || startDate || TODAY,
  } })
}

// ── Report ──
const occ = [...officeOccupant.entries()].map(([sid, v]) => ({ space: spaces.find((s) => s.id === sid), ...v }))
  .sort((a, b) => a.space.floor.localeCompare(b.space.floor) || (parseInt(a.space.unitNumber.replace(/\D/g, '')) - parseInt(b.space.unitNumber.replace(/\D/g, ''))))
console.log(`\nParsed ${leases.length} contracts · ${matchedCo} matched to a company.`)
console.log(`\n===== OFFICE OCCUPANCY (${occ.length} suites) =====`)
let lf = ''
for (const o of occ) { if (o.space.floor !== lf) { console.log(`\n-- ${fname(o.space.floor)} --`); lf = o.space.floor } console.log(`  ${o.space.unitNumber.padEnd(9)} ${o.team.slice(0, 44).padEnd(45)} ${o.num}  ${o.status}`) }
if (unmatched.length) {
  console.log(`\n===== UNMATCHED OFFICE RESOURCES (${unmatched.length}) =====`)
  const seen = new Set()
  for (const u of unmatched) { const k = `${u.floor}:${u.n}`; if (seen.has(k)) continue; seen.add(k); console.log(`  ${fname(u.floor)} #${u.n} ← ${u.team}`) }
}
console.log(`\nDesk assignments: ${deskAssign.size}`)
console.log(`\nMode: ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)

// ── Commit ──
if (COMMIT) {
  await bulkUpsert('leases', leases)
  const spacePatch = []
  for (const o of occ) spacePatch.push({ id: o.space.id, data: { ...spaces.find((s) => s.id === o.space.id), status: 'occupied' } })
  for (const [sid, a] of deskAssign) { const sp = spaces.find((s) => s.id === sid); spacePatch.push({ id: sid, data: { ...sp, assignedMemberId: a.memberId, assignedCompanyId: a.tenantId, status: 'occupied' } }) }
  if (spacePatch.length) await bulkUpsert('spaces', spacePatch)
  console.log(`\nWrote ${leases.length} leases · updated ${spacePatch.length} spaces.`)
}
