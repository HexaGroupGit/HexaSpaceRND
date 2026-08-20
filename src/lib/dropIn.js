// Drop-in bookings — pay on the spot, no month-end fee.
//
// WHY: a Booking Fee on the month-end bill only collects from someone who gets a
// month-end bill. A drop-in has no membership and no invoice run, so a shortfall
// either sat unpaid or (with no company record at all) was never raised — the
// room went out free. Drop-ins now add a card and are charged before the booking
// exists.
import { memberRoomRate, spendableCredits, hasActiveMembership, isDropIn, CREDIT_VALUE, creditsForCost, round2 } from './credits.js'

// The membership test itself lives in credits.js so the credit model can apply
// it without importing this module; re-exported here for existing callers.
export { hasActiveMembership, isDropIn }

/**
 * Is the 30%-off member room rate live? YES — since 20 Aug 2026, on every
 * surface at once (admin calendar + Bookings, portal, app, and the drop-in
 * charge), because they all quote through bookingRate.
 *
 * Who gets it: a company holding an ACTIVE membership. Anyone else pays the full
 * listed rate — a walk-in with no record, and equally a client record whose
 * membership has lapsed or hasn't started. hasActiveMembership is the only test.
 *
 * It moves MONEY only. The credit allowance is drawn at the list rate either way
 * (creditRate), so a member spends their included hours at list value first and
 * the 30% lands on the cash they pay once that allowance is exhausted.
 */
export const MEMBER_RATE_DISCOUNTED = true

/**
 * Hourly rate for this booker, in MONEY. Drop-ins always pay the list rate — the
 * member discount is a membership benefit, not a walk-in price.
 */
export function bookingRate(room, companyId, leases) {
  const isMember = hasActiveMembership(companyId, leases) && MEMBER_RATE_DISCOUNTED
  return memberRoomRate(room, isMember)
}

/**
 * Hourly rate the CREDIT allowance is drawn down at — always the listed rate,
 * for everyone.
 *
 * WHY this is not bookingRate: the 30% member discount is a discount on MONEY,
 * not a bigger allowance. Priced off the member rate, a credit would buy 1/0.7
 * of a listed hour, so the same pool would silently stretch ~43% further and a
 * membership's included hours would change without anyone deciding to change
 * them. Credits are denominated in list dollars (CREDIT_VALUE each) and burn at
 * list; the discount lands on the cash a member actually pays.
 */
export function creditRate(room) {
  return memberRoomRate(room, false)
}

/** Credits an unbooked window would consume — at the list rate, per creditRate. */
export function creditsForBooking(room, hours) {
  return creditsForCost(creditRate(room) * (Number(hours) || 0))
}

/**
 * Money payable for credits the allowance could not cover. The shortfall is
 * counted in list-priced credits, so the member discount is applied HERE — this
 * is the one place list-denominated credits turn back into cash, and the only
 * place the discount touches the credit path. Drop-ins pay the ratio 1.
 */
export function payableForCredits(credits, room, companyId, leases) {
  const list = creditRate(room)
  if (!list) return 0
  const cash = bookingRate(room, companyId, leases)
  return round2(Number(credits || 0) * CREDIT_VALUE * (cash / list))
}

/**
 * Price a booking for whoever is making it. Credits are a membership benefit, so
 * a drop-in has none to draw on (spendableCredits) and pays the whole room hire
 * up front. Amounts in dollars ex GST; `credits` in credit units.
 */
export function priceBooking({ room, hours, company, leases, isPerk = false }) {
  const rate = bookingRate(room, company?.id, leases)
  const cost = isPerk ? 0 : round2(rate * hours)
  // Credits are drawn at the LIST rate even when the cash rate is discounted,
  // so `needed` is NOT cost/CREDIT_VALUE for a member — see creditRate.
  const listCost = isPerk ? 0 : round2(creditRate(room) * hours)
  const needed = isPerk ? 0 : creditsForCost(listCost)
  const balance = spendableCredits(company, leases)
  const creditsUsed = isPerk ? 0 : Math.max(0, Math.min(balance, needed))
  const shortfallCredits = isPerk ? 0 : round2(needed - creditsUsed)
  const payNow = isPerk ? 0 : payableForCredits(shortfallCredits, room, company?.id, leases)
  return { rate, cost, listCost, needed, balance, creditsUsed, shortfallCredits, payNow }
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
