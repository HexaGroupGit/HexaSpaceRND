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

const daysUntil = (iso) => {
  const t = Date.parse(`${String(iso).slice(0, 10)}T00:00:00`)
  return Number.isFinite(t) ? Math.ceil((t - Date.now()) / 86400000) : null
}

const byUnit = (a, b) =>
  String(a.space.unitNumber).localeCompare(String(b.space.unitNumber), undefined, { numeric: true })

// Occupied means "somebody's stuff is in it" — a tagged occupant OR a live
// contract holding it. Both signals matter: imports set the tag without a
// lease, and a just-accepted proposal sets a lease before anyone moves in.
export function officeHasOccupant(space, leases = []) {
  return !!(space.occupantTenantId || space.occupantName ||
    leases.some((l) => l.spaceId === space.id && (l.status === 'active' || l.status === 'pending')))
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
