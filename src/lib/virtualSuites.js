// Virtual-office suite numbering.
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
export function newVirtualSuiteSpace({ unitNumber, rate = 150, tenantId = null, status = 'vacant' }) {
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
export function allocateVirtualSuite({ spaces = [], leases = [], start = VO_SUITE_START, rate = 150, tenantId = null } = {}) {
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
