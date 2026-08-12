// Does this contract still hold the space(s) it names?
//
// A space is held by any live contract — 'active', or 'pending' while it waits
// on signature / commencement. The catch is 'pending': nothing ever expires it
// (reconcile's term-end sweep only looks at 'active'), so the OfficeRND import
// left ~10 contracts parked at 'pending' with end dates years in the past.
// Those ghosts hold their suite forever: the suite never appears in the
// contract picker, and offboardLease refuses to free it when the real tenant
// leaves. That's what hid L2 Suite 8 after its early termination (Aug 2026) —
// CON-108 and CON-127 both ended in 2024/25 but still read as pending.
//
// A pending contract whose term has already ended holds nothing. 'active' is
// deliberately not date-checked: an auto-renewing contract legitimately runs
// past its end date until the nightly reconcile rolls or expires it.
export function holdsSpace(lease, todayISO = new Date().toISOString().slice(0, 10)) {
  if (!lease || lease.offboardedAt) return false
  if (lease.status === 'active') return true
  if (lease.status !== 'pending') return false
  return !lease.endDate || lease.endDate >= todayISO
}
