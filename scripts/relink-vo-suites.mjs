// Re-point virtual-office suites at the contract that actually holds them.
//
// The same repair the Spaces → Virtual Office "Relink" button performs, in
// bulk: a suite whose company tag is missing or stale is invisible to the
// directory, the mail board and the getting-started pack, even though a signed
// contract names it. Uses relinkVirtualSuitePatch(), so the UI and this script
// cannot disagree about what "linked" means.
//
// Suites with a contested or mismatched number are skipped — those need a
// human, because the member registered one of the two with ASIC.
//
// Dry-run by default; pass --apply to write.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { virtualSuiteHolding, relinkVirtualSuitePatch } from '../src/lib/virtualSuites.js'

const APPLY = process.argv.includes('--apply')
const ONLY = process.argv.find((a) => a.startsWith('--suite='))?.split('=')[1]
const NL = String.fromCharCode(10)
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(NL)
  .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const get = async (table) => {
  const out = []
  for (let offset = 0;; offset += 1000) {
    const { data, error } = await sb.from(table).select('id,data').range(offset, offset + 999)
    if (error) throw error
    out.push(...data.map((r) => ({ ...r.data, id: r.id })))
    if (data.length < 1000) return out
  }
}

const [spaces, leases, tenants, members] = await Promise.all(['spaces', 'leases', 'tenants', 'members'].map(get))
const edits = []
for (const s of spaces.filter((x) => x.type === 'virtual')) {
  if (ONLY && s.unitNumber !== ONLY) continue
  const h = virtualSuiteHolding(s, { leases, tenants, members, spaces })
  if (!h.lease) continue
  if (h.suiteMismatch || h.rivals.length) {
    console.log(`SKIP  ${String(s.unitNumber).padEnd(11)} needs a human — ${h.suiteMismatch ? `space says ${h.suite}, contract says ${h.contractSuite}` : `contested by ${h.rivals.map((r) => r.contractNumber ?? r.id).join(', ')}`}`)
    continue
  }
  const patch = relinkVirtualSuitePatch(s, h)
  if (!Object.keys(patch).length) continue
  edits.push({ space: s, patch, label: `${s.unitNumber} -> ${h.tenant?.businessName ?? h.companyId} (${h.lease.contractNumber ?? h.lease.id})` })
}

for (const e of edits) console.log(`${e.label.padEnd(64)} ${Object.entries(e.patch).map(([k, v]) => `${k}=${v}`).join('  ')}`)
console.log(`${NL}${edits.length} suite${edits.length === 1 ? '' : 's'} to relink`)
if (!edits.length) process.exit(0)
if (!APPLY) { console.log(`${NL}DRY RUN - pass --apply to write.`); process.exit(0) }

writeFileSync('vo-relink-backup.json', JSON.stringify(edits.map((e) => e.space), null, 2))
for (const e of edits) {
  const { id: _rowId, ...data } = { ...e.space, ...e.patch }
  const { error } = await sb.from('spaces').update({ data, updated_at: new Date().toISOString() }).eq('id', e.space.id)
  if (error) { console.error(`FAILED ${e.label}: ${error.message}`); process.exitCode = 1; continue }
  console.log(`relinked ${e.label}`)
}
console.log(`${NL}Applied. Previous rows saved to vo-relink-backup.json`)
