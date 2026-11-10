import { holdsSpace } from './spaceHold.js'

// Which offices (and parking bays) we can offer right now — shared by the CRM
// lead proposal and the member upgrade offer so the two pickers can never drift.
//
// "Available" is deliberately wider than "vacant": an office whose occupant is
// leaving within the next 90 days is offerable too, because a served notice or
// a scheduled termination sets a vacate date rather than a new end date, and we
// want the suite in front of the next tenant before it sits empty.

// A lease that's been given notice / scheduled to terminate but is still live —
// the occupant is on their way out, so the space is "vacating soon", not simply
// occupied.
export function isVacating(lease) {
  return !!(lease && ['active', 'pending'].includes(lease.status) &&
    (lease.noticeGiven || lease.terminationScheduledFor || lease.vacateDate))
}

// The date the occupant actually moves out: a served-notice / scheduled
// termination vacates on its vacate date; otherwise the contract's own end date.
export function moveOutDate(lease) {
  return lease?.vacateDate || lease?.terminationScheduledFor || lease?.endDate || null
}

// The date a live contract is certain to let go of its space, or null if it
// isn't — i.e. a date the nightly reconcile will actually expire it on. A served
// notice is (reconcile step 3 keys on noticeGiven + vacateDate; every
// termination path sets both). A bare end date is NOT — a renewing contract
// (autoRenew unset) is rolled forward the day after, so only a contract told
// not to renew really ends on its end date.
export function committedMoveOut(lease) {
  if (!lease) return null
  const day = (v) => String(v).slice(0, 10)
  if (lease.noticeGiven && lease.vacateDate) return day(lease.vacateDate)
  if (lease.endDate && (lease.autoRenew === false || lease.renewalDeclined)) return day(lease.endDate)
  return null
}

const spaceIdsOf = (l) => [l?.spaceId, ...(l?.items ?? []).map((i) => i.spaceId)].filter(Boolean)

// Is this contract signed in advance to take over a space another company is
// still in? (The picker offers an office from the day after its holder's
// committed move-out.) Its onboarding — welcome, portal invite, door access —
// and the space flip must wait until the outgoing contract has ended.
export function awaitingHandover(lease, leases = []) {
  const mine = new Set(spaceIdsOf(lease))
  return leases.some((o) => {
    if (o.id === lease.id || o.tenantId === lease.tenantId || !holdsSpace(o)) return false
    const out = committedMoveOut(o)
    return !!out && spaceIdsOf(o).some((id) => mine.has(id)) && (!lease.startDate || lease.startDate > out)
  })
}

// When an office is free for a NEW contract, given the live contracts holding
// it: '' when none does, the last committed move-out when every one of them is
// ending, or null when any of them rolls on (the office isn't coming free).
// `ignoreLeaseId` skips the contract being edited.
export function officeFreeFrom(space, leases = [], ignoreLeaseId = null) {
  const holders = leases.filter((l) => l.id !== ignoreLeaseId && holdsSpace(l) && spaceIdsOf(l).includes(space.id))
  // A company tag with no contract behind it (imports) still means taken.
  if (space.assignedCompanyId && !holders.some((l) => l.tenantId === space.assignedCompanyId)) return null
  if (!holders.length) return ''
  const outs = holders.map(committedMoveOut)
  return outs.every(Boolean) ? outs.sort().pop() : null
}

const daysUntil = (iso) => {
  const t = Date.parse(`${String(iso).slice(0, 10)}T00:00:00`)
  return Number.isFinite(t) ? Math.ceil((t - Date.now()) / 86400000) : null
}

const byUnit = (a, b) =>
  String(a.space.unitNumber).localeCompare(String(b.space.unitNumber), undefined, { numeric: true })

// Occupied means "somebody's stuff is in it" — a tagged occupant OR a live
// contract holding it. Both signals matter: imports set the tag without a
// lease, and a just-accepted proposal sets a lease before anyone moves in.
// "Live" is holdsSpace, not a raw status test: an OfficeRND-import contract
// parked at 'pending' with a term that ended years ago holds nothing, and
// counting it hid L4 Office 7 from the proposal picker (CON-103, ended
// 31/05/2025) after the real tenant had left.
export function officeHasOccupant(space, leases = []) {
  return !!(space.occupantTenantId || space.occupantName ||
    leases.some((l) => l.spaceId === space.id && holdsSpace(l)))
}

// Offices we can put on a proposal: vacant now, plus occupied ones whose
// occupant leaves within `withinDays`. `excludeSpaceIds` drops suites the
// recipient already holds (an upgrade must never re-offer their own office).
export function availableOffices({ spaces = [], leases = [], withinDays = 90, excludeSpaceIds = [] } = {}) {
  const skip = new Set(excludeSpaceIds)
  return spaces
    .filter((s) => s.type === 'office' && !skip.has(s.id))
    .map((s) => {
      const occupied = officeHasOccupant(s, leases)
      const held = leases.find((x) => x.spaceId === s.id && x.status === 'active')
      const outDate = moveOutDate(held)
      const outDays = outDate ? daysUntil(outDate) : null
      const becoming = occupied && outDays != null && outDays >= 0 && outDays <= withinDays
      return { space: s, occupied, becoming, availableFrom: becoming ? outDate : null }
    })
    .filter((o) => !o.occupied || o.becoming)
    .sort((a, b) => (a.occupied === b.occupied ? 0 : a.occupied ? 1 : -1) || byUnit(a, b))
}

// Unleased parking bays that can ride along on a proposal as an add-on.
export function availableParking({ spaces = [], leases = [], excludeSpaceIds = [] } = {}) {
  const skip = new Set(excludeSpaceIds)
  return spaces
    .filter((s) => s.type === 'parking' && !skip.has(s.id) && !officeHasOccupant(s, leases) && s.status !== 'occupied')
    .map((s) => ({ space: s }))
    .sort(byUnit)
}

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

// Is `candidate` a step up from `current`? Compare on the strongest signal the
// two spaces actually share — seats, then floor area, then price — rather than
// forcing one metric onto suites that don't record it.
export function isUpgradeFrom(candidate, current) {
  if (!current) return true
  const pairs = [
    [num(candidate?.pax), num(current?.pax)],
    [num(candidate?.size), num(current?.size)],
    [num(candidate?.monthlyRate ?? candidate?.rate), num(current?.monthlyRate ?? current?.rate)],
  ]
  for (const [a, b] of pairs) {
    if (a != null && b != null && a !== b) return a > b
  }
  return false
}
