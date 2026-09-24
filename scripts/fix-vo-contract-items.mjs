// Repair virtual-office contracts whose pricing line points at ANOTHER
// company's suite.
//
// Three live VO contracts carry items[0].spaceId for a suite a different
// company holds, while their own spaceId and resource line agree on the right
// one. items[] is what the billing engine names on the invoice
// (billingEngine.js reads items[].spaceId for unitNames), so each of these
// members has been invoiced under someone else's registered address — and the
// suite they were told was theirs reads as contested in Spaces.
//
// Only contracts whose spaceId and resource already agree are touched: that
// agreement is what makes the correct suite unambiguous. Anything else is left
// for a human, because a suite number is an ASIC registration, not a label.
//
// Reads and writes through the service-role client rather than scripts/_sql.mjs:
// the Management API token in .env.local is expired (401).
//
// Dry-run by default; pass --apply to write.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildingSuiteNumber } from '../src/lib/virtualSuites.js'

const APPLY = process.argv.includes('--apply')
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

const [spaces, leases, tenants] = await Promise.all(['spaces', 'leases', 'tenants'].map(get))
const tn = (id) => tenants.find((t) => t.id === id)?.businessName ?? id
const spaceById = Object.fromEntries(spaces.map((s) => [s.id, s]))
const suiteOf = (id) => buildingSuiteNumber(spaceById[id])
const resourceSuite = (l) => {
  const m = String(l?.resource ?? '').match(/suite\s*#?\s*(\d{2,4})/i)
  return m ? Number.parseInt(m[1], 10) : null
}
const live = (l) => ['active', 'pending'].includes(l?.status) && !l?.offboardedAt

const edits = new Map()
for (const l of leases) {
  if (!live(l)) continue
  const own = spaceById[l.spaceId]
  if (own?.type !== 'virtual') continue
  // The contract's own pointer and the number the member was told must agree
  // before we trust either of them over items[].
  const ownSuite = buildingSuiteNumber(own)
  if (ownSuite == null || resourceSuite(l) !== ownSuite) continue
  const items = l.items ?? []
  const wrong = items.filter((i) => i?.spaceId && i.spaceId !== l.spaceId && spaceById[i.spaceId]?.type === 'virtual')
  if (!wrong.length) continue
  edits.set(l.id, {
    patch: { items: items.map((i) => (wrong.includes(i) ? { ...i, spaceId: l.spaceId } : i)) },
    label: `${l.contractNumber ?? l.id}  ${tn(l.tenantId)}`,
    why: wrong.map((i) => {
      const heldBy = leases.find((x) => x.spaceId === i.spaceId && live(x))
      const holder = heldBy ? `${tn(heldBy.tenantId)}, ${heldBy.contractNumber ?? heldBy.id}` : 'unheld'
      return `items[] pointed at Suite ${suiteOf(i.spaceId)} (${holder}) -> Suite ${ownSuite}`
    }).join('; '),
  })
}

for (const [, e] of edits) console.log(`${e.label.padEnd(52)} ${e.why}`)
console.log(`${NL}${edits.size} lease row${edits.size === 1 ? '' : 's'} to update`)
if (!edits.size) process.exit(0)
if (!APPLY) { console.log(`${NL}DRY RUN - pass --apply to write.`); process.exit(0) }

writeFileSync('vo-contract-items-backup.json', JSON.stringify(
  [...edits.keys()].map((id) => leases.find((l) => l.id === id)), null, 2))

for (const [id, e] of edits) {
  const { id: _rowId, ...data } = { ...leases.find((l) => l.id === id), ...e.patch }
  const { error } = await sb.from('leases').update({ data, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error(`FAILED ${e.label}: ${error.message}`); process.exitCode = 1; continue }
  console.log(`updated ${e.label}`)
}
console.log(`${NL}Applied. Previous rows saved to vo-contract-items-backup.json`)
