// Drop-in bookings — pay on the spot, no month-end fee.
//
// WHY: a Booking Fee on the month-end bill only collects from someone who gets a
// month-end bill. A drop-in has no membership and no invoice run, so a shortfall
// either sat unpaid or (with no company record at all) was never raised — the
// room went out free. Drop-ins now add a card and are charged before the booking
// exists.
import { memberRoomRate, spendableCredits, hasActiveMembership, isDropIn, CREDIT_VALUE } from './credits.js'

// The membership test itself lives in credits.js so the credit model can apply
// it without importing this module; re-exported here for existing callers.
export { hasActiveMembership, isDropIn }

/**
 * Is the 30%-off member room rate live? The app and portal currently charge the
 * LIST rate to everyone (see memberRoomRate in credits.js — the discounted rate
 * exists but isn't switched on across both surfaces yet), so this stays false
 * and drop-in pricing changes nothing for members. Flip it in ONE place when the
 * member rate is agreed, and members get the discount while drop-ins keep list.
 */
export const MEMBER_RATE_DISCOUNTED = false

/**
 * Hourly rate for this booker. Drop-ins always pay the list rate — the member
 * discount is a membership benefit, not a walk-in price.
 */
export function bookingRate(room, companyId, leases) {
  const isMember = hasActiveMembership(companyId, leases) && MEMBER_RATE_DISCOUNTED
  return memberRoomRate(room, isMember)
}

/**
 * Price a booking for whoever is making it. Credits are a membership benefit, so
 * a drop-in has none to draw on (spendableCredits) and pays the whole room hire
 * up front. Amounts in dollars ex GST; `credits` in credit units.
 */
export function priceBooking({ room, hours, company, leases, isPerk = false }) {
  const rate = bookingRate(room, company?.id, leases)
  const cost = isPerk ? 0 : Math.round(rate * hours * 100) / 100
  const needed = isPerk ? 0 : Math.round((cost / CREDIT_VALUE) * 100) / 100
  const balance = spendableCredits(company, leases)
  const creditsUsed = isPerk ? 0 : Math.max(0, Math.min(balance, needed))
  const shortfallCredits = isPerk ? 0 : Math.round((needed - creditsUsed) * 100) / 100
  const payNow = Math.round(shortfallCredits * CREDIT_VALUE * 100) / 100
  return { rate, cost, needed, balance, creditsUsed, shortfallCredits, payNow }
}

// ── Cancelling a room you've already had ────────────────────────────────────
// Cancelling is always allowed — freeing the slot helps everyone. What's gated
// here is the REFUND. A booking that has been used is charged whether or not
// it's later marked cancelled.

/**
 * Has the room been opened for this booking? Stamped by api/salto/open.js the
 * first time the member remote-unlocks the door.
 *
 * NOTE this only sees remote unlocks from the app. A member who taps in with a
 * physical fob leaves no trace in our system — that open lives in Salto's own
 * audit. So this can't be the only test; bookingHasStarted carries the rest.
 */
export function doorWasOpened(booking) {
  return !!booking?.doorOpenedAt
}

/**
 * Has the booked window begun? Times are stored as Melbourne-local HH:mm and
 * members are in Melbourne, so a device-local parse is the right comparison —
 * same convention as bookingWindowMs in app/lib/bookingActions.js.
 */
export function bookingHasStarted(booking) {
  if (!booking?.date || !booking?.startTime) return false
  const from = new Date(`${booking.date}T${booking.startTime}:00`).getTime()
  return Number.isFinite(from) && Date.now() >= from
}

/**
 * Did they get the room? Either the door was opened for it, or its window has
 * started (whether or not they showed up — the slot was held for them and
 * nobody else could book it).
 */
export function bookingWasUsed(booking) {
  return doorWasOpened(booking) || bookingHasStarted(booking)
}

/** Cancelling is always allowed; this says whether the money comes back. */
export function refundableOnCancel(booking) {
  return !bookingWasUsed(booking)
}

/**
 * Must this booking be paid before it is created?
 * Only true drop-ins — a member who overruns their allowance keeps the existing
 * month-end Booking Fee, so nobody with a membership is blocked mid-booking.
 */
export function requiresUpfrontPayment({ company, leases, isPerk = false, payNow = 0 }) {
  if (isPerk) return false
  if (payNow <= 0) return false
  return isDropIn(company?.id, leases)
}
