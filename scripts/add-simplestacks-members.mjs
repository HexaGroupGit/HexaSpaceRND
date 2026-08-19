// Add the Simple Stacks Accounting members (from the OfficeRND directory) as
// members of the "Simple stacks accounting service pty ltd" tenant/company.
//   node scripts/add-simplestacks-members.mjs           # dry run
//   node scripts/add-simplestacks-members.mjs --commit   # write
import fs from 'fs'

const COMMIT = process.argv.includes('--commit')
function parseEnv(p) { const o = {}; if (!fs.existsSync(p)) return o; for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue; const i = t.indexOf('='); o[t.slice(0, i).trim()] = t.slice(i + 1).trim() } return o }
const env = parseEnv('.env.local'); const URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1) }
const HDR = { apikey: KEY, Authorization: `Bearer ${KEY}` }
async function fetchAll(table) { const res = await fetch(`${URL}/rest/v1/${table}?select=id,data&limit=5000`, { headers: HDR }); return res.ok ? res.json() : [] }
async function bulkUpsert(table, rows) { for (let i = 0; i < rows.length; i += 500) { const res = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: { ...HDR, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) }); if (!res.ok) { console.error('fail', res.status, await res.text()); process.exit(1) } } }

// ── Members from the OfficeRND directory screenshot (name + mobile) ───────────
const PEOPLE = [
  { name: 'Andrea Han',   phone: '+61478513710' },
  { name: 'Anna Wang',    phone: '+61451726088' },
  { name: 'Daniel Shi',   phone: '+61432398845' },
  { name: 'Evie Gu',      phone: '+61404772445' },
  { name: 'Helen Yu',     phone: '+61431169060' },
  { name: 'Hazel Zhang',  phone: '+61414189239' },
  { name: 'Kitty Luo',    phone: '+61434265592' },
  { name: 'Sherry Lu',    phone: '+61402843580' },
  { name: 'Yolanda Jiang', phone: '+61466043023' },
  { name: 'Yuheng Xue',   phone: '+61459971957' },
]

// ── Find the Simple Stacks tenant (same normalise/contains logic as set-occupants) ─
const norm = (s) => (s || '').toLowerCase().replace(/\bpty\b|\bltd\b|\bp\/l\b|[.,&]/g, '').replace(/\s+/g, ' ').trim()
const tenants = await fetchAll('tenants')
const TARGET = 'Simple stacks accounting service pty ltd'
const nTarget = norm(TARGET)
let company = tenants.find((t) => norm(t.data.businessName) === nTarget)
  || tenants.find((t) => norm(t.data.businessName).includes(nTarget) || nTarget.includes(norm(t.data.businessName)))
  || tenants.find((t) => norm(t.data.businessName).startsWith('simple stack'))
if (!company) {
  console.error(`\n⚠ No tenant matched "${TARGET}". Existing tenants:`)
  for (const t of tenants) console.error('   -', t.data.businessName)
  process.exit(1)
}
console.log(`Company: ${company.data.businessName}  (id ${company.id})\n`)

// ── Build rows, skipping anyone already on this company (idempotent by name) ──
const members = await fetchAll('members')
const existingNames = new Set(members.filter((m) => m.data.companyId === company.id).map((m) => norm(m.data.name)))
const today = new Date().toISOString().split('T')[0]

const rows = []; const skipped = []
PEOPLE.forEach((p, i) => {
  if (existingNames.has(norm(p.name))) { skipped.push(p.name); return }
  // Unique, stable id (Date.now()+index so a re-run without --commit stays consistent within the run).
  const id = `m_ss_${norm(p.name).replace(/\s+/g, '_')}`
  const data = {
    id,
    name: p.name,
    companyId: company.id,
    email: '',
    phone: p.phone,
    twitter: '',
    bio: '',
    startDate: today,
    status: 'Auto',
    credits: 0,
    contactPerson: false,
    billingPerson: false,
    portalAccess: true,   // no email, so addMember/onboarding sends nothing until one is added
    hideFromPortal: false,
    createdAt: today,
    source: 'officernd-directory-import',
  }
  rows.push({ id, data })
  console.log(`  + ${p.name.padEnd(16)} ${p.phone}`)
})

if (skipped.length) console.log(`\nAlready on ${company.data.businessName}, skipped: ${skipped.join(', ')}`)
console.log(`\nMode: ${COMMIT ? 'COMMIT' : 'DRY RUN'}  ·  ${rows.length} member(s) to add`)
if (COMMIT && rows.length) {
  await bulkUpsert('members', rows)
  console.log(`Wrote ${rows.length} member(s) to "${company.data.businessName}".`)
}
