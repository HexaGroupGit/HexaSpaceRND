// Drop-in bookings — pay on the spot, no month-end fee.
//
// WHY: a Booking Fee on the month-end bill only collects from someone who gets a
// month-end bill. A drop-in has no membership and no invoice run, so a shortfall
// either sat unpaid or (with no company record at all) was never raised — the
// room went out free. Drop-ins now add a card and are charged before the booking
// exists.
import { memberRoomRate, creditBalance, CREDIT_VALUE } from './credits.js'

/** A company is a member if it holds an active lease/membership. */
export function hasActiveMembership(companyId, leases) {
  if (!companyId) return false
  return (leases ?? []).some((l) => l.tenantId === companyId && l.status === 'active')
}

export function isDropIn(companyId, leases) {
  return !hasActiveMembership(companyId, leases)
}

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
 * Price a booking for whoever is making it. Credits still apply first (a former
 * member may hold a balance), so a drop-in only pays what credits don't cover.
 * Amounts in dollars ex GST; `credits` in credit units.
 */
export function priceBooking({ room, hours, company, leases, isPerk = false }) {
  const rate = bookingRate(room, company?.id, leases)
  const cost = isPerk ? 0 : Math.round(rate * hours * 100) / 100
  const needed = isPerk ? 0 : Math.round((cost / CREDIT_VALUE) * 100) / 100
  const balance = creditBalance(company)
  const creditsUsed = isPerk ? 0 : Math.max(0, Math.min(balance, needed))
  const shortfallCredits = isPerk ? 0 : Math.round((needed - creditsUsed) * 100) / 100
  const payNow = Math.round(shortfallCredits * CREDIT_VALUE * 100) / 100
  return { rate, cost, needed, balance, creditsUsed, shortfallCredits, payNow }
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
