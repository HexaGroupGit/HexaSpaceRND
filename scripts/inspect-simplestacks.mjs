// Inspect Simple Stacks tenants + the 10 member names, to see duplicates.
import fs from 'fs'
function parseEnv(p) { const o = {}; if (!fs.existsSync(p)) return o; for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue; const i = t.indexOf('='); o[t.slice(0, i).trim()] = t.slice(i + 1).trim() } return o }
const env = parseEnv('.env.local'); const URL = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
const HDR = { apikey: KEY, Authorization: `Bearer ${KEY}` }
async function fetchAll(table) { const res = await fetch(`${URL}/rest/v1/${table}?select=id,data&limit=5000`, { headers: HDR }); return res.ok ? res.json() : [] }
const norm = (s) => (s || '').toLowerCase().replace(/\bpty\b|\bltd\b|\bp\/l\b|[.,&]/g, '').replace(/\s+/g, ' ').trim()

const tenants = await fetchAll('tenants')
console.log('── Tenants matching "simple stack" ──')
const ss = tenants.filter((t) => norm(t.data.businessName).includes('simple stack'))
for (const t of ss) console.log(`  id=${t.id}  name="${t.data.businessName}"  email=${t.data.email || ''}`)
const ssIds = new Set(ss.map((t) => t.id))

const NAMES = ['Andrea Han','Anna Wang','Daniel Shi','Evie Gu','Helen Yu','Hazel Zhang','Kitty Luo','Sherry Lu','Yolanda Jiang','Yuheng Xue'].map(norm)
const members = await fetchAll('members')
console.log('\n── Members matching those 10 names ──')
for (const m of members) {
  if (!NAMES.includes(norm(m.data.name))) continue
  const co = tenants.find((t) => t.id === m.data.companyId)
  console.log(`  id=${m.id}\n     name="${m.data.name}" email="${m.data.email || ''}" phone="${m.data.phone || ''}"\n     companyId=${m.data.companyId || '(none)'} -> ${co ? co.data.businessName : (m.data.companyId ? '⚠ MISSING TENANT' : '—')}  source=${m.data.source || ''}`)
}
