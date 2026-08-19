// Reconcile Simple Stacks members:
//   1. Delete the 10 email-less duplicates I created (source officernd-directory-import, ids m_ss_*).
//   2. Repoint the 10 original members (with real emails, orphaned on deleted tenant tc71)
//      onto the active tenant t_mtm_1782796539118.
//   node scripts/fix-simplestacks-members.mjs           # dry run
//   node scripts/fix-simplestacks-members.mjs --commit   # write
import fs from 'fs'

const COMMIT = process.argv.includes('--commit')
function parseEnv(p) { const o = {}; if (!fs.existsSync(p)) return o; for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue; const i = t.indexOf('='); o[t.slice(0, i).trim()] = t.slice(i + 1).trim() } return o }
const env = parseEnv('.env.local'); const URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
const HDR = { apikey: KEY, Authorization: `Bearer ${KEY}` }
async function fetchAll(table) { const res = await fetch(`${URL}/rest/v1/${table}?select=id,data&limit=5000`, { headers: HDR }); return res.ok ? res.json() : [] }
async function bulkUpsert(table, rows) { for (let i = 0; i < rows.length; i += 500) { const res = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: { ...HDR, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) }); if (!res.ok) { console.error('upsert fail', res.status, await res.text()); process.exit(1) } } }
async function del(table, id) { const res = await fetch(`${URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: HDR }); if (!res.ok) { console.error('delete fail', res.status, await res.text()); process.exit(1) } }

const ACTIVE = 't_mtm_1782796539118'   // active "Simple stacks accounting service pty ltd"
const DEAD = 'tc71'                     // removed duplicate tenant
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const NAMES = new Set(['Andrea Han','Anna Wang','Daniel Shi','Evie Gu','Helen Yu','Hazel Zhang','Kitty Luo','Sherry Lu','Yolanda Jiang','Yuheng Xue'].map(norm))

const members = await fetchAll('members')

// 1. Duplicates I created — delete.
const dupes = members.filter((m) => m.id.startsWith('m_ss_'))
// 2. Originals orphaned on the dead tenant, among the 10 names — repoint to active.
const orphans = members.filter((m) => m.data.companyId === DEAD && NAMES.has(norm(m.data.name)))
const repoints = orphans.map((m) => ({ id: m.id, data: { ...m.data, companyId: ACTIVE } }))

console.log('── Delete duplicates (email-less, m_ss_*) ──')
for (const m of dupes) console.log(`  ✗ ${m.id}  "${m.data.name}"`)
console.log('\n── Repoint originals tc71 → active company (keep name/email/phone) ──')
for (const m of orphans) console.log(`  → ${m.data.name.padEnd(16)} ${m.data.email.padEnd(34)} ${m.data.phone}`)

// Flag any other members still stranded on the dead tenant (not in our 10).
const otherOnDead = members.filter((m) => m.data.companyId === DEAD && !NAMES.has(norm(m.data.name)))
if (otherOnDead.length) { console.log(`\n⚠ Other members still on deleted tenant ${DEAD} (left untouched):`); for (const m of otherOnDead) console.log(`    ${m.data.name} <${m.data.email || 'no email'}>`) }

console.log(`\nMode: ${COMMIT ? 'COMMIT' : 'DRY RUN'}  ·  delete ${dupes.length} · repoint ${repoints.length}`)
if (COMMIT) {
  for (const m of dupes) await del('members', m.id)
  if (repoints.length) await bulkUpsert('members', repoints)
  console.log(`Deleted ${dupes.length} duplicates · repointed ${repoints.length} originals to ${ACTIVE}.`)
}
