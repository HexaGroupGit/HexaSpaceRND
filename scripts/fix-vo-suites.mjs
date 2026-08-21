// One-off repair of the virtual-office suite series.
//
// The OfficeRND import minted a VO "space" per contract and numbered them with a
// later backfill, so numbers ended up duplicated across live members, stranded on
// dead contracts, or missing entirely. A VO suite number IS the member's
// registered business address, so two members sharing one is a mail-misrouting
// (and ASIC) problem, not a cosmetic one.
//
// Rules applied here:
//   • The number a member was already told (lease.resource, from OfficeRND) wins.
//   • Where two LIVE contracts hold one number, the billed/active one keeps it.
//   • Dead contracts (cancelled/terminated/expired) release their duplicate number
//     to a free one, so it can never be handed out twice.
//   • Every space's assignment is realigned to the contract that actually holds it.
//
// Dry-run by default; pass --apply to write.
import { writeFileSync } from 'node:fs'
import { sql } from './_sql.mjs'
import { takenSuiteNumbers } from '../src/lib/virtualSuites.js'

const APPLY = process.argv.includes('--apply')
const spaces = (await sql('select data from spaces')).map((r) => r.data)
const leases = (await sql('select data from leases')).map((r) => r.data)
const tenants = (await sql('select data from tenants')).map((r) => r.data)
const tn = Object.fromEntries(tenants.map((t) => [t.id, t.businessName]))
const spaceById = Object.fromEntries(spaces.map((s) => [s.id, s]))
const leaseOf = (con) => leases.find((l) => (l.contractNumber ?? l.id) === con)
const LIVE = (l) => ['active', 'pending'].includes(l?.status)

// Numbers already spoken for — by any space and by any contract's resource line,
// dead ones included: a departed member's number is never recycled, so a
// forwarded letter can't reach the wrong company.
const taken = takenSuiteNumbers({ spaces, leases })
let cursor = 437
function freeNumber() {
  do { cursor += 1 } while (taken.has(cursor))
  taken.add(cursor)
  return cursor
}

const spaceEdits = new Map()
const leaseEdits = new Map()
const notes = []
const patchSpace = (id, patch, why) => {
  spaceEdits.set(id, { ...(spaceEdits.get(id) ?? {}), ...patch })
  notes.push({ kind: 'space', id, unit: spaceById[id]?.unitNumber, patch, why })
}
const patchLease = (id, patch, why) => {
  leaseEdits.set(id, { ...(leaseEdits.get(id) ?? {}), ...patch })
  notes.push({ kind: 'lease', id, patch, why })
}

// ── 1. Suite 421: Boss International keeps it, Invincible Energy moves to 432 ──
const boss = leaseOf('CON-1751')
const invincible = leaseOf('CON-62')
patchSpace('hx_vo_CON-62', {
  assignedCompanyId: boss.tenantId, occupantTenantId: boss.tenantId,
  assignedMemberId: boss.memberId ?? null, status: 'occupied',
}, 'Suite 421 -> Boss International (CON-1751)')
patchSpace('hx_vo_CON-121', {
  assignedCompanyId: invincible.tenantId, occupantTenantId: invincible.tenantId, status: 'occupied',
  rate: invincible.monthlyRent ?? 150, monthlyRate: invincible.monthlyRent ?? 150,
}, 'Suite 432 -> Invincible Energy (CON-62), moved off 421')
patchLease(invincible.id, { spaceId: 'hx_vo_CON-121', resource: 'Suite 432' }, 'moved off shared Suite 421')
patchLease(boss.id, { resource: 'Virtual Office — Business Address · Suite 421' }, 'suite named on the contract')

// ── 2. Suite 406, held by three contracts ──────────────────────────────────────
// Heena4BoxHill (active, invoiced, told 406) keeps it. Scrutex was told 414 all
// along — its space was simply mislabelled. Tedku moves to a free number.
const scrutex = leaseOf('CON-250')
patchSpace('hx_vo_CON-148', {
  unitNumber: 'Suite 414', assignedCompanyId: scrutex.tenantId, occupantTenantId: scrutex.tenantId,
}, 'relabelled 406 -> 414, the number CON-250 was actually told')
const tedku = leaseOf('CON-239')
const tedkuN = freeNumber()
patchSpace('hx_vo_CON-239', { unitNumber: `Suite ${tedkuN}` }, 'moved off shared Suite 406 (Heena4BoxHill keeps it)')
patchLease(tedku.id, { resource: `Suite ${tedkuN}` }, 'moved off shared Suite 406')

// ── 3. Duplicate numbers stranded on dead contracts ────────────────────────────
for (const [id, why] of [
  ['hx_vo_CON-200', 'Suite 410 duplicate - CON-200 (Orchardlink) cancelled; ALLSET keeps 410'],
  ['hx_vo_CON-190', 'Suite 411 duplicate - CON-190 (JC Partners) cancelled; TOP TRADING keeps 411'],
  ['hx_vo_CON-134', 'Suite 603 duplicate - CON-134 terminated; NOVAFAB keeps 603'],
  ['hx_vo_CON-213', 'Suite 208 clashed with the physical Level 2 Suite 8; CON-213 expired'],
]) {
  patchSpace(id, {
    unitNumber: `Suite ${freeNumber()}`, status: 'vacant',
    assignedCompanyId: null, occupantTenantId: null, assignedMemberId: null,
  }, why)
}

// ── 4. Live contracts carrying no usable suite number ──────────────────────────
patchSpace('hx_vo_CON-115', { unitNumber: 'Suite 488' }, '"Suite 88" on Level 4 already rendered as 488 - label now matches the address')
patchLease(leaseOf('CON-115').id, { resource: 'Suite 488' }, 'suite named on the contract')

const ocon = leaseOf('CON-271')
const oconN = freeNumber()
patchSpace('hx_xa_virtualofficevo6', {
  unitNumber: `Suite ${oconN}`, type: 'virtual', floor: 'l4', status: 'occupied',
  assignedCompanyId: ocon.tenantId, occupantTenantId: ocon.tenantId,
}, 'VO had no suite number - "Virtual Office VO6" is not an address')
patchLease(ocon.id, { resource: `Suite ${oconN}` }, 'allocated a suite')

// Bricklane was told 408, and Suite 408 sits empty under a stale hold.
const bricklane = leaseOf('CON-246')
patchSpace('hx_vo_CON-155', {
  assignedCompanyId: bricklane.tenantId, occupantTenantId: bricklane.tenantId, status: 'occupied',
}, 'Suite 408 -> Bricklane (CON-246), the number it was told; stale Nutrimores hold cleared')
patchLease(bricklane.id, { spaceId: 'hx_vo_CON-155' }, 'linked to Suite 408')

// Regent Metal has a live, invoiced VO and no space at all.
const regent = leaseOf('CON-272')
const regentN = freeNumber()
const regentSpace = {
  id: `hx_vo_suite_${regentN}`, unitNumber: `Suite ${regentN}`, type: 'virtual', floor: 'l4',
  rate: regent.monthlyRent ?? 75, monthlyRate: regent.monthlyRent ?? 75, status: 'occupied',
  location: 'whitehorse', address: '830 Whitehorse Rd, Box Hill',
  attributes: 'Virtual office — mail & business address.',
  assignedCompanyId: regent.tenantId, occupantTenantId: regent.tenantId,
}
notes.push({ kind: 'space+', id: regentSpace.id, patch: { unitNumber: regentSpace.unitNumber }, why: 'new suite for CON-272 (Regent Metal), which had none' })
patchLease(regent.id, { spaceId: regentSpace.id, resource: `Suite ${regentN}` }, 'allocated a suite')

// ── 5. Realign every remaining VO space to the contract that actually holds it ─
for (const s of spaces.filter((x) => x?.type === 'virtual')) {
  if (spaceEdits.has(s.id)) continue
  const live = leases.filter((l) => l.spaceId === s.id && LIVE(l))
  if (live.length === 1) {
    const l = live[0]
    if (s.assignedCompanyId !== l.tenantId || s.occupantTenantId !== l.tenantId) {
      patchSpace(s.id, { assignedCompanyId: l.tenantId, occupantTenantId: l.tenantId, status: 'occupied' },
        `assignment realigned to its live contract ${l.contractNumber ?? l.id} (${l.companyName ?? tn[l.tenantId] ?? '?'})`)
    }
  } else if (live.length === 0 && (s.assignedCompanyId || s.occupantTenantId)) {
    patchSpace(s.id, { assignedCompanyId: null, occupantTenantId: null, assignedMemberId: null, status: 'vacant' },
      `stale hold by ${tn[s.assignedCompanyId] ?? tn[s.occupantTenantId] ?? s.assignedCompanyId} - no live contract`)
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────
for (const n of notes) {
  console.log(`${n.kind.padEnd(6)} ${String(n.id).padEnd(24)} ${n.unit ? `[${n.unit}] ` : ''}${n.why}`)
  console.log(`       ${Object.entries(n.patch).map(([k, v]) => `${k}=${v === null ? 'null' : v}`).join('  ')}`)
}
console.log(`\n${spaceEdits.size} space rows updated + 1 created, ${leaseEdits.size} lease rows updated`)

if (!APPLY) { console.log('\nDRY RUN - pass --apply to write.'); process.exit(0) }

writeFileSync('vo-suite-fix-backup.json', JSON.stringify({
  spaces: [...spaceEdits.keys()].map((id) => spaceById[id]),
  leases: [...leaseEdits.keys()].map((id) => leases.find((l) => l.id === id)),
}, null, 2))

const esc = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const stmts = ['begin;']
for (const [id, patch] of spaceEdits) stmts.push(`update spaces set data = data || ${esc(JSON.stringify(patch))}::jsonb where id = ${esc(id)};`)
for (const [id, patch] of leaseEdits) stmts.push(`update leases set data = data || ${esc(JSON.stringify(patch))}::jsonb where id = ${esc(id)};`)
stmts.push(`insert into spaces (id, data) values (${esc(regentSpace.id)}, ${esc(JSON.stringify(regentSpace))}::jsonb) on conflict (id) do update set data = excluded.data;`)
stmts.push('commit;')
await sql(stmts.join('\n'))
console.log('\nApplied. Previous rows saved to vo-suite-fix-backup.json')
