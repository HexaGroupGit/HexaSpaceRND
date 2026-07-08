// Meeting-room credit model.
//
// Each membership grants a MONTHLY credit allowance that a company can spend on
// room bookings. 1 credit = A$40 of bookings. Allowance is a company-level pool
// (summed across the company's active memberships), reset each month, deducted by
// bookings, and — when exhausted — a Booking Fee is raised for the overage which
// is added to the company's month-end bill.

export const CREDIT_VALUE = 40 // A$ per credit

// Monthly credit allocation per membership type. Private Office is per-pax.
export const MEMBERSHIP_CREDITS = {
  'Flexible Desk': 4,
  'Dedicated Desk': 8,
  'Private Office': 5, // × pax
  'Virtual Office': 0,
}

// Credits granted by a single membership, given its type and (for offices) pax.
export function membershipCredits(type, pax) {
  if (type === 'Private Office') return (Number(pax) || 0) * MEMBERSHIP_CREDITS['Private Office']
  return MEMBERSHIP_CREDITS[type] ?? 0
}

// Classify a lease/membership into one of the four membership types. Mirrors the
// classifier in Memberships.jsx so the allowance matches what's shown there.
export function classifyMembership(lease, space) {
  const text = `${lease?.planName || ''} ${space?.unitNumber || ''} ${space?.attributes || ''} ${space?.type || ''}`.toLowerCase()
  if (text.includes('virtual')) return 'Virtual Office'
  if (text.includes('flex')) return 'Flexible Desk'
  if (text.includes('dedicated')) return 'Dedicated Desk'
  return 'Private Office'
}

// A company's computed monthly allowance = sum of its active memberships' credits.
export function computeMonthlyAllowance(tenantId, leases, spaces) {
  return (leases ?? [])
    .filter((l) => l.tenantId === tenantId && l.status === 'active')
    .reduce((sum, l) => {
      const space = (spaces ?? []).find((s) => s.id === l.spaceId)
      return sum + membershipCredits(classifyMembership(l, space), space?.pax)
    }, 0)
}

// Effective allowance: a manual override on the company wins, else the computed value.
export function effectiveAllowance(tenant, computed) {
  const o = tenant?.creditAllowanceOverride
  return (o === 0 || o) ? Number(o) : computed
}

// Credits needed to cover a dollar cost (rounded to 0.01 credit).
export function creditsForCost(cost) {
  return Math.round((Number(cost || 0) / CREDIT_VALUE) * 100) / 100
}

// Invoice-facing name for a booking charge. When credits part-covered it, the
// "(over allowance)" tag explains the partial amount; when the company had no
// credits at all, it's just a plain room charge: room, rate, date & time.
export function bookingFeeName({ roomName, rate, date, startTime, endTime, usedCredits }) {
  const dmy = date ? String(date).split('-').reverse().join('/') : ''
  const when = [dmy, startTime && endTime ? `${startTime}–${endTime}` : startTime || ''].filter(Boolean).join(' ')
  const base = `Meeting room — ${roomName || ''}`.trim()
  if (Number(usedCredits) > 0) return `${base} · ${when} (over allowance)`
  return `${base} · $${Number(rate) || 0}/hr · ${when}`
}

export const round2 = (n) => Math.round(Number(n || 0) * 100) / 100

// ── Private-office room perk ────────────────────────────────────────────────
// Companies holding an active Private Office (suite) membership get the small
// consulting rooms (Sky, Earth, Sun, Moon) FREE — no credits — but capped so
// they can't book all day. Defaults below; overridable via settings.officePerks.
export const OFFICE_PERK_DEFAULTS = {
  freeRooms: ['Sky', 'Earth', 'Sun', 'Moon'], // matched by room name (unitNumber), case-insensitive
  maxHoursPerBooking: 2,
  maxHoursPerDay: 4, // per company, per day, across the free rooms
}

export function officePerkConfig(settings) {
  const p = settings?.officePerks ?? {}
  const rooms = Array.isArray(p.freeRooms) && p.freeRooms.length ? p.freeRooms : OFFICE_PERK_DEFAULTS.freeRooms
  return {
    freeRooms: rooms.map((r) => String(r).toLowerCase()),
    maxHoursPerBooking: Number(p.maxHoursPerBooking ?? OFFICE_PERK_DEFAULTS.maxHoursPerBooking),
    maxHoursPerDay: Number(p.maxHoursPerDay ?? OFFICE_PERK_DEFAULTS.maxHoursPerDay),
  }
}

// Does this company hold an active Private Office (suite) membership?
export function hasPrivateOffice(companyId, leases, spaces) {
  if (!companyId) return false
  return (leases ?? []).some((l) => l.tenantId === companyId && l.status === 'active'
    && classifyMembership(l, (spaces ?? []).find((s) => s.id === l.spaceId)) === 'Private Office')
}

// Is this room one of the office-perk (free) rooms?
export function isPerkRoom(space, settings) {
  if (!space) return false
  return officePerkConfig(settings).freeRooms.includes(String(space.unitNumber || '').toLowerCase())
}

// Hours a company has already booked in perk rooms on a given date (excludes
// cancelled). Pass the booking list + spaces so we know which rooms are perks.
export function perkHoursUsed({ companyId, date, bookings, spaces, settings, excludeIds = [] }) {
  const perkIds = new Set((spaces ?? []).filter((s) => isPerkRoom(s, settings)).map((s) => s.id))
  return (bookings ?? [])
    .filter((b) => b.companyId === companyId && b.date === date && b.status !== 'Cancelled'
      && perkIds.has(b.resourceId) && !excludeIds.includes(b.id))
    .reduce((sum, b) => {
      const dur = hoursBetween(b.startTime, b.endTime)
      return sum + (dur > 0 ? dur : 0)
    }, 0)
}

function hoursBetween(start, end) {
  const dec = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h + (m || 0) / 60 }
  return dec(end) - dec(start)
}

// Evaluate a proposed booking against the office perk.
//   { perk: is this a free perk booking, allowed: within caps, reason: why not }
export function evaluateOfficePerk({ companyId, space, hours, leases, spaces, settings, perkHoursToday = 0 }) {
  if (!isPerkRoom(space, settings) || !hasPrivateOffice(companyId, leases, spaces)) {
    return { perk: false, allowed: true }
  }
  const cfg = officePerkConfig(settings)
  const name = space.unitNumber || 'This room'
  if (hours > cfg.maxHoursPerBooking) {
    return { perk: true, allowed: false, reason: `${name} is included with your office — up to ${cfg.maxHoursPerBooking}h per booking. Please shorten or split it.` }
  }
  if (perkHoursToday + hours > cfg.maxHoursPerDay) {
    const left = round2(Math.max(0, cfg.maxHoursPerDay - perkHoursToday))
    return { perk: true, allowed: false, reason: `Your office includes up to ${cfg.maxHoursPerDay}h/day in the small rooms — you have ${left}h left today.` }
  }
  return { perk: true, allowed: true }
}

// Where to email a company: its own email, else the member flagged Billing
// Person, else the Contact Person, else any member with an email. Used by
// EVERY company-facing send (invoices, reminders, mail alerts, renewals) so
// email-less companies still reach a human. Server twin: api/_email.js.
export function billingEmailFor(tenant, members = []) {
  if (tenant?.email) return tenant.email
  const mine = (members ?? []).filter((m) => m.companyId === tenant?.id && m.email)
  return (mine.find((m) => m.billingPerson) ?? mine.find((m) => m.contactPerson) ?? mine[0])?.email || ''
}
