// Read-only: why does one company's Documents panel list everyone's contracts?
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})

const { data: docRows } = await sb.from('documents').select('id, data, updated_at')
const docs = (docRows ?? []).map(r => ({ id: r.id, updated_at: r.updated_at, ...r.data }))
const { data: tenRows } = await sb.from('tenants').select('data')
const tenants = (tenRows ?? []).map(r => r.data)
const nameOf = (id) => tenants.find(t => t.id === id)?.businessName ?? null

console.log('documents rows:', docs.length, '· tenants:', tenants.length)

// 1. Scoping fields — the panel filters on data->>tenantId / data->>leaseId
const noTenant = docs.filter(d => !d.tenantId)
const noLease  = docs.filter(d => !d.leaseId)
console.log(`\nmissing tenantId: ${noTenant.length}/${docs.length}   missing leaseId: ${noLease.length}/${docs.length}`)

// 2. How many docs per tenantId, biggest first
const byTenant = {}
for (const d of docs) { const k = d.tenantId ?? '(null)'; (byTenant[k] ??= []).push(d) }
console.log('\ndocs per tenantId:')
for (const [k, list] of Object.entries(byTenant).sort((a,b)=>b[1].length-a[1].length).slice(0,12)) {
  const nm = k === '(null)' ? '—' : (nameOf(k) ?? '!! NO SUCH TENANT !!')
  console.log(`  ${String(list.length).padStart(4)}  ${k.padEnd(28)} ${nm}`)
}

// 3. Does the filename's company match the tenant it is filed under?
const slug = (s) => String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'')
let mismatch = 0, checked = 0
const examples = []
for (const d of docs) {
  if (!d.tenantId || !d.name) continue
  const owner = nameOf(d.tenantId); if (!owner) continue
  checked++
  const fileSlug = slug(d.name.replace(/[_-]?CON[_-]?\d+\.pdf$/i, ''))
  if (fileSlug && !slug(owner).startsWith(fileSlug.slice(0, 10)) && !fileSlug.startsWith(slug(owner).slice(0, 10))) {
    mismatch++
    if (examples.length < 12) examples.push(`  ${d.name.padEnd(52)} filed under: ${owner}`)
  }
}
console.log(`\nfilename vs owning tenant: ${mismatch}/${checked} look mismatched`)
examples.forEach(e => console.log(e))

// 4. Upload timestamps — one bulk batch?
const stamps = {}
for (const d of docs) { const k = (d.uploadedAt ?? d.updated_at ?? '?').slice(0,16); stamps[k] = (stamps[k]??0)+1 }
console.log('\nuploadedAt buckets (top 8):')
for (const [k,n] of Object.entries(stamps).sort((a,b)=>b[1]-a[1]).slice(0,8)) console.log(`  ${String(n).padStart(4)}  ${k}`)

// 5. Are there duplicate rows of the same file?
const byName = {}
for (const d of docs) (byName[d.name] ??= []).push(d)
const dupes = Object.entries(byName).filter(([,v]) => v.length > 1)
console.log(`\nfilenames appearing more than once: ${dupes.length}`)
for (const [n, v] of dupes.slice(0, 8)) console.log(`  ${String(v.length).padStart(3)}×  ${n}  → tenants: ${[...new Set(v.map(x=>nameOf(x.tenantId) ?? x.tenantId ?? 'null'))].join(', ')}`)
