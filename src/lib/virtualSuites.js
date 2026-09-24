// Virtual-office suite numbering and the contract behind a suite.
//
// A Virtual Office member gets their own suite number at 830 Whitehorse Road —
// it's what makes the address usable for ASIC registration, a bank, Google
// Business and mail sorting ("Suite 428, Level 4/830 Whitehorse Road").
//
// The numbers come from the BUILDING's Level 4 series (4xx), so a VO number
// must never land on a room that already has one. Two wrinkles make that
// non-trivial:
//   • The platform stores physical offices by their floor-local number
//     ("Suite 6" on floor l2) while the building — and the mail — knows that
//     same room as Suite 206. buildingSuiteNumber() converts.
//   • Legacy OfficeRND VOs (Suite 424, 428, 430, 433, 435, 436) carry their
//     number on the LEASE, sometimes with no space record behind them, so
//     leases are scanned too.
// Allocation therefore skips every number either side has ever used.
//
// Where the physical rooms actually sit: the numbered suites are all on LEVEL 2
// (Suite 0–29 → 200–229). Level 4 and 5 offices are named "Office 1"–"Office 15"
// and carry no suite number at all, so nothing physical occupies the 4xx band —
// which is why live virtual offices legitimately sit as low as 406.

import { monthlyRentNow } from './leasePricing.js'
import { buildPaymentSchedule } from './paymentSchedule.js'

// The two Virtual Office packages, as quoted on the website and the brochure.
// The premium inclusions (lounge access, daily meeting-room hours) switch on at
// $150 — voInclusions.js reads VO_LIST_PRICE for that threshold.
export const VO_PACKAGES = { address: 75, plus: 150 }
export const VO_LIST_PRICE = VO_PACKAGES.plus

// First number a NEW virtual office may mint. Not a collision guard (nothing
// physical is in the 4xx band); it simply starts the series where the OfficeRND
// VOs already are, leaving 401–423 to the legacy ones imported below it.
export const VO_SUITE_START = 424

// Floor → building number base: floor-local "Suite 6" on l4 is Suite 406.
const FLOOR_BASE = { l2: 200, l4: 400, l5: 500 }

// The number the BUILDING knows a space by. Floor-local numbers (< 100) are
// lifted onto their floor's base; anything already three digits is taken as a
// building number as-is (legacy imports, virtual offices). Only suite-shaped
// labels count — a migrated "Virtual Office CON-246" is a contract number
// wearing a space's clothes, not suite 246.
export function buildingSuiteNumber(space) {
  const m = String(space?.unitNumber ?? '').trim().match(/^(?:suite\s*#?\s*)?(\d{1,4})$/i)
  if (!m) return null
  const n = Number.parseInt(m[1], 10)
  if (n >= 100) return n
  const base = FLOOR_BASE[space?.floor]
  return base == null ? null : base + n
}

// "Suite 428", "suite #428 — Virtual Office" → 428.
const suiteFromText = (text) => {
  const m = String(text ?? '').match(/suite\s*#?\s*(\d{2,4})/i)
  return m ? Number.parseInt(m[1], 10) : null
}

// Every 4xx number that is spoken for — by a physical office, by a virtual
// office space, or by a contract carrying the number in its resource line.
// Leases of ANY status count: a departed member's suite is not recycled, so a
// forwarded letter can never reach the wrong company.
export function takenSuiteNumbers({ spaces = [], leases = [] } = {}) {
  const taken = new Set()
  for (const s of spaces) {
    if (!['office', 'virtual'].includes(s?.type)) continue
    const n = buildingSuiteNumber(s)
    if (n != null) taken.add(n)
  }
  for (const l of leases) {
    const n = suiteFromText(l?.resource) ?? suiteFromText(l?.suite)
    if (n != null) taken.add(n)
  }
  return taken
}

// The next free suite number in the virtual-office series.
export function nextVirtualSuite({ spaces = [], leases = [], start = VO_SUITE_START } = {}) {
  const taken = takenSuiteNumbers({ spaces, leases })
  let n = start
  while (taken.has(n)) n += 1
  return { number: n, unitNumber: `Suite ${n}` }
}

// A virtual-office space nobody holds — created ahead of time in Spaces, or
// freed when a member left. Reused before minting a new number so the series
// doesn't sprint away from the building. Only numbers in the VO series qualify:
// the old seed data shipped Suite 403/404, which are physical rooms.
export function reusableVirtualSuite({ spaces = [], leases = [], start = VO_SUITE_START } = {}) {
  const held = new Set()          // space ids a live contract holds
  const claimed = new Map()       // suite number → the space id that may use it
  for (const l of leases) {
    if (['active', 'pending'].includes(l?.status) && l?.spaceId) held.add(l.spaceId)
    // A migrated VO often names its suite on the contract with no space record
    // behind it (or a dangling id). That number is spoken for even though the
    // space sitting on it looks free.
    const n = suiteFromText(l?.resource) ?? suiteFromText(l?.suite)
    if (n != null && !claimed.has(n)) claimed.set(n, l?.spaceId ?? null)
  }
  return (
    spaces
      .filter((s) => s?.type === 'virtual' && !s.assignedCompanyId && !s.occupantTenantId && !held.has(s.id))
      .filter((s) => s.status !== 'occupied' && s.status !== 'reserved')
      .map((s) => ({ space: s, n: buildingSuiteNumber(s) }))
      .filter((x) => x.n != null && x.n >= start)
      .filter((x) => !claimed.has(x.n) || claimed.get(x.n) === x.space.id)
      .sort((a, b) => a.n - b.n)[0]?.space ?? null
  )
}

// A fresh virtual-office space record for `unitNumber`.
export function newVirtualSuiteSpace({ unitNumber, rate = VO_LIST_PRICE, tenantId = null, status = 'vacant' }) {
  return {
    id: `hx_vo_${String(unitNumber).replace(/\s+/g, '_').toLowerCase()}`,
    unitNumber,
    type: 'virtual',
    floor: 'l4',
    monthlyRate: rate,
    rate,
    status,
    location: 'whitehorse',
    address: '830 Whitehorse Rd, Box Hill',
    attributes: 'Virtual office — mail & business address.',
    ...(tenantId ? { occupantTenantId: tenantId } : {}),
  }
}

// Allocate a suite for a virtual-office member: reuse a free one where we can,
// otherwise mint the next number. Returns { space, created } — `created` tells
// the caller whether the space still has to be inserted.
export function allocateVirtualSuite({ spaces = [], leases = [], start = VO_SUITE_START, rate = VO_LIST_PRICE, tenantId = null } = {}) {
  const existing = reusableVirtualSuite({ spaces, leases, start })
  if (existing) return { space: existing, created: false }
  const { unitNumber } = nextVirtualSuite({ spaces, leases, start })
  return { space: newVirtualSuiteSpace({ unitNumber, rate, tenantId }), created: true }
}

// The mailing address a virtual-office suite gives its member.
export function virtualSuiteLabel(space) {
  const n = space?.type === 'virtual' ? buildingSuiteNumber(space) : null
  return n == null ? null : `Suite ${n}`
}

// ── The contract behind a suite ──────────────────────────────────────────────
//
// A suite number IS the member's registered business address — it is on their
// ASIC record, their bank file and the mail sorted downstairs. So the contract,
// not a stored assignment field, is what a suite belongs to: the fields can be
// cleared by a stray click, the signed contract cannot. Everything the admin
// UI shows about a suite is resolved from the live contract holding it, and the
// stored fields are only a fallback for a suite nobody holds yet.

// The live (active or pending, not offboarded) contract holding a suite. Two
// links, in order of trust:
//   • spaceId / items[].spaceId — the real pointer, set by every flow that
//     allocates a suite (proposal accept, exit enrolment, manual contract).
//   • the suite number written on the contract's resource line — the only link
//     a migrated OfficeRND VO has, and the number the member was actually told.
// Nothing weaker counts: one company can hold several virtual offices, so
// matching on tenant alone would hand one member's suite to another contract.
export function virtualSuiteContract(space, leases = [], spaces = null) {
  return virtualSuiteClaims(space, leases, spaces)[0] ?? null
}

// Every live contract claiming a suite, best claim first. More than one means
// two companies are pointed at a single registered address — it happens when a
// contract's items[] keeps a suite its spaceId has since moved off, and it is
// worth surfacing because items[] is what the billing engine names on the
// invoice. Ranked so the answer never depends on lease array order:
//   1. spaceId — the contract's primary pointer, and what `resource` agrees with
//   2. items[].spaceId — a bundled line, which is the one that goes stale
// The suite NUMBER is only consulted when nobody claims the space either way:
// it is there for migrated OfficeRND VOs that have no space record at all, and
// the import left unsigned pendings quoting numbers that live members already
// hold — reading those as claims would contest half the floor.
export function virtualSuiteClaims(space, leases = [], spaces = null) {
  if (!space?.id) return []
  const live = leases.filter((l) => ['active', 'pending'].includes(l?.status) && !l?.offboardedAt)
  const byPointer = live
    .map((l) => ({ l, r: l.spaceId === space.id ? 1 : (l.items ?? []).some((i) => i?.spaceId === space.id) ? 2 : 0 }))
    .filter((x) => x.r > 0)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.l)
  if (byPointer.length) return byPointer
  const n = buildingSuiteNumber(space)
  if (n == null) return []
  const dangling = (l) => !l.spaceId || (spaces ? !spaces.some((s) => s?.id === l.spaceId) : false)
  return live.filter((l) => dangling(l) && (suiteFromText(l.resource) ?? suiteFromText(l.suite)) === n)
}

// Everything the admin needs to know about one suite, resolved from the live
// contract: who holds it, what they actually pay this month, and whether the
// space record still agrees with the contract.
export function virtualSuiteHolding(space, { leases = [], tenants = [], members = [], spaces = null } = {}) {
  const claims = virtualSuiteClaims(space, leases, spaces)
  const lease = claims[0] ?? null
  const suite = buildingSuiteNumber(space)
  const contractSuite = lease ? (suiteFromText(lease.resource) ?? suiteFromText(lease.suite)) : null
  const companyId = lease?.tenantId ?? space?.assignedCompanyId ?? space?.occupantTenantId ?? null
  // The contract's own monthly line for THIS suite — not lease.monthlyRent,
  // which is stale on a stepped contract and includes bundled parking.
  const price = lease ? monthlyRentNow(lease, { spaceId: space?.id }) : null
  // One schedule, two very different findings. A $0 month inside a schedule
  // that charges in other months is a promotional free month and will end. A
  // schedule that totals $0 over the WHOLE term is a contract with no rent
  // configured at all: it bills nothing and auto-renews silently, so it must
  // never wear the same "rent-free" label.
  //
  // The test is on the schedule, not on the price fields, because $0 has more
  // than one spelling — monthlyRent: 0 with no steps, and listPrice: 150 with
  // a '100%' discount, both produce a term that never charges. A VO bundled
  // free onto a paying contract is NOT this: that schedule still totals > 0.
  // A suite given away on purpose (a founder, a partner, a goodwill month) is
  // declared with `complimentary` on the contract. That is the difference
  // between a deliberate freebie and someone typing 0 into the rent box, and
  // only the undeclared kind is worth an admin's attention.
  const schedule = lease ? buildPaymentSchedule(lease, null) : null
  const monthKey = new Date().toISOString().slice(0, 7)
  const complimentary = !!lease?.complimentary
  const noRent = !!lease && !complimentary && (!schedule || schedule.totals.total === 0)
  const rentFree = !noRent && !!schedule &&
    schedule.rows.find((r) => r.key === monthKey)?.total === 0
  return {
    lease,
    tenant: tenants.find((t) => t.id === companyId) ?? null,
    member: members.find((m) => m.id === (lease?.memberId ?? space?.assignedMemberId)) ?? null,
    companyId,
    suite,
    contractSuite,
    // A live contract's suite is not the admin's to hand around or delete.
    locked: !!lease,
    // The contract names a different number than the space carries: one of the
    // two is what the member registered, and we no longer know which.
    suiteMismatch: !!(lease && contractSuite != null && suite != null && contractSuite !== suite),
    // The space is tagged to a company the contract doesn't name.
    companyDrift: !!(lease && space?.assignedCompanyId && space.assignedCompanyId !== lease.tenantId),
    // Two live contracts pointed at one registered address.
    rivals: claims.slice(1),
    // Held by a contract but carrying no company tag — invisible to anything
    // that reads the space rather than the contract (directory, mail board).
    unlinked: !!(lease && !space?.assignedCompanyId),
    // Live contract, no rent anywhere in its term, and nobody said so on
    // purpose. See rentFree and complimentary above.
    noRent,
    complimentary,
    monthly: rentFree || noRent ? 0 : price?.monthly ?? null,
    list: price?.list ?? null,
    rentFree,
  }
}

// The patch that re-points a suite at the contract that actually holds it.
// Empty when nothing has drifted.
export function relinkVirtualSuitePatch(space, holding) {
  const { lease } = holding ?? {}
  if (!lease) return {}
  const patch = {}
  if (space?.assignedCompanyId !== lease.tenantId) patch.assignedCompanyId = lease.tenantId
  if (space?.occupantTenantId !== lease.tenantId) patch.occupantTenantId = lease.tenantId
  if (lease.memberId && space?.assignedMemberId !== lease.memberId) patch.assignedMemberId = lease.memberId
  const rate = holding.list ?? holding.monthly
  if (rate != null && rate > 0 && Number(space?.rate ?? space?.monthlyRate ?? 0) !== rate) {
    patch.rate = rate
    patch.monthlyRate = rate
  }
  // Promote to the status the contract implies, but NEVER pull an already
  // occupied suite back to reserved: the member has moved in and their mail is
  // arriving, whatever the contract's signature state still says. Same guard
  // the reconcile pass in useStore applies for the same reason.
  const desired = lease.status === 'pending' ? 'reserved' : 'occupied'
  if (space?.status !== desired && !(space?.status === 'occupied' && desired === 'reserved')) {
    patch.status = desired
  }
  return patch
}
