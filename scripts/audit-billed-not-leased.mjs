// The gap a lease-walk can't see: someone Xero was billing for a membership who
// has no active lease on the platform. They'd simply never be invoiced again,
// and nothing would flag it — the audit that walks leases never looks at them.
//
// Reads the Xero "Account Transactions" exports (June + July 2026) and asks, for
// every customer billed for membership there: do they still have an active,
// paying contract here, and were they invoiced in August?
//
// Usage: node scripts/audit-billed-not-leased.mjs <dir-of-extracted-xlsx>
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const BASE = process.argv[2]
if (!BASE) { console.error('Pass the directory holding the extracted xlsx folders.'); process.exit(1) }

// ── minimal xlsx reader ─────────────────────────────────────────────────────
function readSheet(dir) {
  const ss = []
  try {
    for (const m of readFileSync(`${dir}/xl/sharedStrings.xml`, 'utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      ss.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
    }
  } catch { /* none */ }
  const rows = []
  for (const rm of readFileSync(`${dir}/xl/worksheets/sheet1.xml`, 'utf8').matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {}
    for (const cm of rm[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const t = /t="([^"]+)"/.exec(cm[2])?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(cm[3])?.[1]
      const inline = [...cm[3].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')
      cells[cm[1]] = String(t === 's' ? (ss[Number(v)] ?? '') : t === 'inlineStr' ? inline : (v ?? inline ?? '')).trim()
    }
    rows.push(cells)
  }
  return rows
}

// "Trafficon - Office 4 - 188 - 188 Office, $350.00, Jul 1…" → "Trafficon"
const customerOf = (desc) => String(desc).split(' - ')[0].trim()
const norm = (s) => String(s ?? '').toLowerCase()
  .replace(/\b(pty\.? ?ltd\.?|p\/l|limited|ltd\.?|australia|group|the)\b/g, '')
  .replace(/[^a-z0-9]/g, '')

const xero = new Map() // norm name → { name, gross, months:Set }
for (const d of readdirSync(BASE)) {
  const dir = path.join(BASE, d)
  let rows
  try { rows = readSheet(dir) } catch { continue }
  const period = (rows.find((r) => /^For the period/.test(Object.values(r)[0] || '')) ?? {}).A ?? '?'
  const month = /June/.test(period) ? '2026-06' : /July/.test(period) ? '2026-07' : '?'
  for (const r of rows) {
    if (!/^\d+$/.test(r.A || '') || !r.D) continue
    const name = customerOf(r.C)
    if (!name || /^To Recognise/i.test(name)) continue          // manual accrual journals
    const k = norm(name)
    if (!k) continue
    const cur = xero.get(k) ?? { name, gross: 0, months: new Set() }
    cur.gross += Number(r.H || 0)
    cur.months.add(month)
    xero.set(k, cur)
  }
}

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const [{ data: tnR }, { data: lsR }, { data: invR }] = await Promise.all([
  sb.from('tenants').select('id,data'), sb.from('leases').select('id,data'), sb.from('invoices').select('id,data'),
])
const tenants = tnR.map((r) => r.data), leases = lsR.map((r) => r.data), invoices = invR.map((r) => r.data)
const tByNorm = new Map()
for (const t of tenants) { const k = norm(t.businessName); if (k && !tByNorm.has(k)) tByNorm.set(k, t) }

const inc = (i) => Math.round((i.lineItems ?? []).reduce((s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0) * (i.vatEnabled !== false ? 1.1 : 1) * 100) / 100
const augInv = invoices.filter((i) => i.status !== 'voided' && (i.periodStart ?? '') >= '2026-07-25' && (i.periodStart ?? '') <= '2026-08-31')
const augByTenant = new Map()
for (const i of augInv) augByTenant.set(i.tenantId, [...(augByTenant.get(i.tenantId) ?? []), i])

const noTenant = [], noLease = [], noAug = [], fine = []
for (const [k, x] of xero) {
  const t = tByNorm.get(k)
  if (!t) { noTenant.push(x); continue }
  const live = leases.filter((l) => l.tenantId === t.id && l.status === 'active' && Number(l.monthlyRent) > 0)
  const aug = augByTenant.get(t.id) ?? []
  if (!live.length) { noLease.push({ x, t, aug }); continue }
  if (!aug.length) { noAug.push({ x, t, live }); continue }
  fine.push(x)
}

console.log(`\n${xero.size} distinct customers billed for membership in the June/July Xero exports.\n`)
console.log(`■ Billed in Xero, NO matching company on the platform  (${noTenant.length})`)
console.log('   (mostly name drift between the two systems — worth eyeballing, not necessarily lost)')
for (const x of noTenant.sort((a, b) => b.gross - a.gross)) console.log(`   $${x.gross.toFixed(2).padStart(10)}  ${[...x.months].join(',').padEnd(16)} ${x.name.slice(0, 44)}`)

console.log(`\n■ Billed in Xero, company exists, but NO active paying lease  (${noLease.length})`)
console.log('   (left, or the contract never made it across the migration — check each)')
let sum = 0
for (const { x, t, aug } of noLease.sort((a, b) => b.x.gross - a.x.gross)) {
  sum += x.gross
  console.log(`   $${x.gross.toFixed(2).padStart(10)}  ${[...x.months].join(',').padEnd(16)} ${x.name.slice(0, 34).padEnd(34)} ${t.id}  aug-invoices=${aug.length}`)
}
if (noLease.length) console.log(`   ${'─'.repeat(76)}\n   $${sum.toFixed(2)} billed across Jun+Jul to companies with no live contract`)

console.log(`\n■ Active paying lease, but NOTHING invoiced for August  (${noAug.length})`)
let lost = 0
for (const { x, t, live } of noAug.sort((a, b) => b.x.gross - a.x.gross)) {
  const mo = live.reduce((s, l) => s + Number(l.monthlyRent) * 1.1, 0)
  lost += mo
  console.log(`   $${mo.toFixed(2).padStart(9)}/mo  ${x.name.slice(0, 34).padEnd(34)} ${t.id}  ${live.map((l) => l.contractNumber).join(', ')}`)
}
if (noAug.length) console.log(`   ${'─'.repeat(76)}\n   $${lost.toFixed(2)}/mo not invoiced`)
console.log(`\n■ Billed in Xero and invoiced in August: ${fine.length}`)
