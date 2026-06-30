// Import an OfficeRND bookings CSV into the bookings table, mapped to the right
// room (space), the booking company, and member. Companies/members not already
// on file are created as stubs so the calendar + company filter are complete.
//
//   node scripts/import-bookings.mjs "<bookings.csv>"            # dry run (report)
//   node scripts/import-bookings.mjs "<bookings.csv>" --commit   # write
//
// Reads keys from .env.local.
import fs from 'fs'

const COMMIT = process.argv.includes('--commit')
const TODAY = '2026-06-30'

function parseEnv(p) { const o = {}; if (!fs.existsSync(p)) return o; for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue; const i = t.indexOf('='); o[t.slice(0, i).trim()] = t.slice(i + 1).trim() } return o }
function parseCSV(text) { const rows = []; let row = [], f = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c } else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = '' } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' } else if (c === '\r') {} else f += c } } if (f.length || row.length) { row.push(f); rows.push(row) } return rows }
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
// "30 Jun 2026 15:00" -> { date:'2026-06-30', time:'15:00' }
function parseDT(s) { if (!s) return null; const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/); if (!m) return null; const mo = MONTHS[m[2].toLowerCase()]; if (!mo) return null; const date = `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; const time = m[4] ? `${m[4].padStart(2, '0')}:${m[5]}` : ''; return { date, time } }
const norm = (s) => (s || '').trim().toLowerCase()
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

const env = parseEnv('.env.local'); const URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env'); process.exit(1) }
const HDR = { apikey: KEY, Authorization: `Bearer ${KEY}` }
async function fetchAll(table) { const res = await fetch(`${URL}/rest/v1/${table}?select=id,data&limit=5000`, { headers: HDR }); return res.ok ? res.json() : [] }
async function bulkUpsert(table, rows) { for (let i = 0; i < rows.length; i += 500) { const res = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: { ...HDR, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) }); if (!res.ok) { console.error(`${table} upsert failed`, res.status, (await res.text()).slice(0, 300)); process.exit(1) } } }

// ── Load existing data ──
const tenants = await fetchAll('tenants'); const members = await fetchAll('members'); const spacesRows = await fetchAll('spaces')
const tMap = new Map(tenants.map((t) => [norm(t.data.businessName), t.id]))
const mMap = new Map(members.map((m) => [norm(m.data.name), m.id]))
const spaces = spacesRows.map((s) => s.data)
console.log(`Loaded ${tenants.length} companies, ${members.length} members, ${spaces.length} spaces.`)

// Resource keyword -> room (by unitNumber match against the bookable spaces)
const findRoom = (kw) => spaces.find((s) => ['meeting', 'studio', 'podcast'].includes(s.type) && norm(s.unitNumber).includes(kw))
function roomFor(resource) {
  const t = norm(resource)
  if (t.includes('central')) return findRoom('central')
  if (t.includes('earth') || t.includes('(di)')) return findRoom('earth')
  if (t.includes('north') || t.includes('bei')) return findRoom('north')
  if (t.includes('sky') || t.includes('tian')) return findRoom('sky')
  if (t.includes('south') || t.includes('nan')) return findRoom('south')
  if (t.includes('west') || t.includes('xi')) return findRoom('west')
  if (t.includes('east') || t.includes('dong')) return findRoom('east')
  if (t.includes('media') || t.includes('studio')) return findRoom('studio')
  if (t.includes('podcast')) return findRoom('podcast')
  if (t.includes('function')) return spaces.find((s) => norm(s.unitNumber) === 'function') || findRoom('function')
  return null
}

const rows = parseCSV(fs.readFileSync(process.argv[2], 'utf8')); const head = rows.shift(); const ix = (n) => head.indexOf(n)
const data = rows.filter((r) => r[ix('Reference Number')] || r[ix('Start')])

const newCompanies = [], newMembers = [], bookings = []
let matchedCo = 0, matchedMem = 0, noRoom = 0
const stubCo = new Map(), stubMem = new Map()
const resCount = new Map()

for (const r of data) {
  const coName = (r[ix('Company')] || '').trim(); const memName = (r[ix('Member')] || '').trim()
  const ref = (r[ix('Reference Number')] || '').trim()
  const start = parseDT(r[ix('Start')]); const end = parseDT(r[ix('End')])
  if (!start) continue
  const resource = (r[ix('Resource')] || '').trim()
  const room = roomFor(resource); if (!room) { noRoom++; resCount.set(resource, (resCount.get(resource) || 0) + 1) }

  // resolve company (stub if needed so the calendar/company filter is complete)
  let tenantId = ''
  if (coName) {
    tenantId = tMap.get(norm(coName)) || stubCo.get(norm(coName)) || ''
    if (tenantId) { if (tMap.get(norm(coName))) matchedCo++ } else {
      tenantId = `tcb_${slug(coName)}`; stubCo.set(norm(coName), tenantId)
      newCompanies.push({ id: tenantId, data: { id: tenantId, businessName: coName, status: 'Active', source: 'bookings-import', createdAt: TODAY } })
    }
  }
  // resolve member (stub if needed)
  let memberId = ''
  if (memName) {
    memberId = mMap.get(norm(memName)) || stubMem.get(norm(memName)) || ''
    if (memberId) { if (mMap.get(norm(memName))) matchedMem++ } else {
      memberId = `mb_${slug(memName)}`; stubMem.set(norm(memName), memberId)
      newMembers.push({ id: memberId, data: { id: memberId, name: memName, companyId: tenantId, status: 'Active', credits: 0, source: 'bookings-import', createdAt: TODAY } })
    }
  }

  // Day bookings (e.g. Media Studio hired for the day) come through as 00:00 -> next-day 00:00.
  const allDay = start.time === '00:00' && (!end || end.date !== start.date || end.time === '00:00')
  const startTime = allDay ? '08:00' : start.time
  const endTime = allDay ? '19:00' : (end?.time || start.time)

  const credits = Number(r[ix('Credits')] || 0); const coins = Number(r[ix('Coins')] || 0); const fee = Number(r[ix('Fee')] || 0)
  const creditsUsed = credits || coins || 0
  const paidBy = fee > 0 ? 'paid' : creditsUsed > 0 ? 'credits' : 'free'
  const created = parseDT(r[ix('Created At')])
  // A reference number repeats across recurring occurrences — key by ref + slot so each instance is kept.
  const id = `bk_${ref || slug(resource)}_${start.date}_${(start.time || '').replace(':', '')}`

  bookings.push({ id, data: {
    id, reference: ref, resourceId: room?.id || '', resourceName: resource,
    memberId, memberName: memName, companyId: tenantId, companyName: coName,
    date: start.date, startTime, endTime, allDay,
    title: (r[ix('Summary')] || '').trim() || coName, status: 'Confirmed', source: 'Portal', repeat: 'none',
    creditsUsed, coins, fee, paidBy, source2: 'officernd-import',
    createdAt: created ? `${created.date}` : TODAY,
  } })
}

// Dedupe by id (a reference number can repeat across rows) — keep the last.
const dedup = [...new Map(bookings.map((b) => [b.id, b])).values()]
const dupes = bookings.length - dedup.length
bookings.length = 0; bookings.push(...dedup)

// ── Report ──
console.log(`\nParsed ${bookings.length} bookings${dupes ? ` (${dupes} duplicate refs collapsed)` : ''}.`)
console.log(`  Companies: ${matchedCo} matched on file · ${newCompanies.length} new stubs created`)
console.log(`  Members:   ${matchedMem} matched on file · ${newMembers.length} new stubs created`)
const byRoom = new Map()
for (const b of bookings) { const k = b.data.resourceName || '(none)'; byRoom.set(k, (byRoom.get(k) || 0) + 1) }
console.log('\n  By resource:')
;[...byRoom.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { const room = roomFor(k); console.log(`    ${String(v).padStart(3)}  ${k.padEnd(26)} -> ${room ? room.unitNumber : '*** NO ROOM ***'}`) })
if (noRoom) console.log(`\n  ${noRoom} bookings had no matching room.`)
console.log(`\nMode: ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)

if (COMMIT) {
  if (newCompanies.length) await bulkUpsert('tenants', newCompanies)
  if (newMembers.length) await bulkUpsert('members', newMembers)
  await bulkUpsert('bookings', bookings)
  console.log(`\nWrote ${bookings.length} bookings · +${newCompanies.length} companies · +${newMembers.length} members.`)
}
