// Desk/office allocation clean-up, per Eric's answers (30 Jul 2026):
//  1. Inventory only had Dedicated Desks 1-6, yet leases reference "Desk 10" —
//     the floor really has more, so create the missing records (7-10).
//  2. Lydian GBS and GOMA sat on the bare label "Dedicated Desk" with no number:
//     provisionally allocate the next free desks (correctable — nothing here is
//     a claim about where they physically sit).
//  3. Suite 15 + 16 is a SHARED space (the dividing wall was removed), so Level Up
//     and 4Corners both occupying it is intentional. Flag it so it stops being
//     reported as a clash instead of "fixing" something that isn't broken.
//
//   node scripts/fix-desk-suite-dupes.mjs            # dry run
//   node scripts/fix-desk-suite-dupes.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const NEW_DESKS = [7, 8, 9, 10]
const DESK_ALLOCATIONS = [            // contractNumber matched together with tenant name
  { tenant: 'Lydian GBS Pty Ltd',              desk: 'Dedicated Desk 1' },
  { tenant: 'GOMA COMMERCIAL SERVICES PTY LTD', desk: 'Dedicated Desk 2' },
]
const SHARED = ['CON-187', 'CON-4CORNERS']   // Suite 15 + 16, wall removed

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const g = async (t) => ((await sb.from(t).select('id,data')).data ?? []).map(r => ({ ...r.data, id: r.id }))

const [spaces, leases, tenants] = await Promise.all([g('spaces'), g('leases'), g('tenants')])
const co = (l) => tenants.find(t => t.id === l.tenantId)?.businessName || l.companyName || l.tenantId
const nowIso = () => new Date().toISOString()
const writes = []

// ── 1. Missing desk records ────────────────────────────────────────────────
const template = spaces.find(s => s.id === 'hx_desk_1')
console.log('1. Missing desk records')
for (const n of NEW_DESKS) {
  const name = `Dedicated Desk ${n}`
  if (spaces.some(s => s.unitNumber === name)) { console.log(`   ${name} — already exists, skipping`); continue }
  const rec = {
    id: `hx_desk_${n}`, type: 'desk', unitNumber: name,
    rate: template?.rate ?? 650, monthlyRate: 0,
    floor: template?.floor ?? 'l4', status: 'vacant',
    address: template?.address ?? '830 Whitehorse Rd, Box Hill',
    location: template?.location ?? 'whitehorse', attributes: '',
  }
  console.log(`   CREATE ${rec.id} "${name}"`)
  writes.push({ table: 'spaces', id: rec.id, data: rec })
}

// ── 2. Provisional desk numbers for the bare "Dedicated Desk" leases ───────
console.log('\n2. Allocate the unnumbered desk leases')
for (const a of DESK_ALLOCATIONS) {
  const lease = leases.find(l => l.status === 'active' && co(l) === a.tenant && /^dedicated desk$/i.test(String(l.resource || '').trim()))
  if (!lease) { console.log(`   SKIP ${a.tenant} — no active lease on the bare "Dedicated Desk" label`); continue }
  const space = spaces.find(s => s.unitNumber === a.desk) || writes.find(w => w.data?.unitNumber === a.desk)?.data
  if (!space) { console.log(`   SKIP ${a.tenant} — ${a.desk} not found`); continue }
  const taken = leases.filter(l => l.status === 'active' && l.id !== lease.id &&
    (spaces.find(s => s.id === l.spaceId)?.unitNumber === a.desk || String(l.resource || '').trim() === a.desk))
  if (taken.length) { console.log(`   SKIP ${a.tenant} → ${a.desk} — already held by ${taken.map(co).join(', ')}`); continue }
  console.log(`   ${a.tenant.padEnd(34)} → ${a.desk}  (space ${space.id})`)
  writes.push({ table: 'leases', id: lease.id, data: { ...lease, spaceId: space.id, resource: a.desk, deskAllocatedAt: nowIso(), deskAllocationProvisional: true } })
}

// ── 3. Suite 15 + 16 is shared by design ───────────────────────────────────
console.log('\n3. Suite 15 + 16 — shared space (wall removed)')
for (const ref of SHARED) {
  const lease = leases.find(l => l.contractNumber === ref && l.status === 'active')
  if (!lease) { console.log(`   SKIP ${ref} — no active lease`); continue }
  console.log(`   FLAG ${ref} ${co(lease)} — sharedSpace: true`)
  writes.push({ table: 'leases', id: lease.id, data: { ...lease, sharedSpace: true, sharedSpaceNote: 'Suite 15 + 16 combined — dividing wall removed; co-occupied by design.' } })
}

if (!APPLY) { console.log(`\nDRY RUN — ${writes.length} write(s) pending. Re-run with --apply.`); process.exit(0) }
let ok = 0
for (const w of writes) {
  const data = { ...w.data }; delete data.id
  const { error } = await sb.from(w.table).upsert({ id: w.id, data, updated_at: nowIso() })
  if (error) console.error(`   FAILED ${w.table}/${w.id}: ${error.message}`)
  else ok++
}
console.log(`\nAPPLIED: ${ok}/${writes.length}`)
