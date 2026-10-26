// "Use as function" — North + South booked together with the divider opened,
// run as one small conference room (up to 30 people) for a flat set-up fee.
//
// Stored as TWO ordinary bookings (one per room) sharing a combinedGroupId, so
// each room blocks itself the normal way and the Function Space through
// roomConflicts — no new availability rules, and booking_availability (which
// only exposes resource_id) sees both holds. Each row draws its own room's
// credits; the FIRST row also carries the set-up as `setupCredits`, so it comes
// out of the allowance like room hire, any shortfall rides on that row's
// ordinary overage fee, and a cancel refunds it with the rest.

import { CREDIT_VALUE, round2 } from './credits.js'
import { creditsForBooking, payableForCredits } from './dropIn.js'

export const COMBINE_ROOM_NAMES = ['north', 'south']
export const COMBINED_SETUP_FEE = 50
export const COMBINED_SETUP_CREDITS = round2(COMBINED_SETUP_FEE / CREDIT_VALUE)
export const COMBINED_MAX_PAX = 30
export const COMBINED_EXPLAINER = `Book both rooms with the divider opened as one small conference room for up to ${COMBINED_MAX_PAX} people. You pay both rooms' hire plus a A$${COMBINED_SETUP_FEE} set-up fee (${COMBINED_SETUP_CREDITS} credits), and both can come out of your credit allowance.`

const norm = (v) => String(v ?? '').trim().toLowerCase()

// The room that `room` combines with, or null when it isn't part of the pair.
export function combinePartner(room, spaces) {
  if (!room || !COMBINE_ROOM_NAMES.includes(norm(room.unitNumber))) return null
  return (spaces ?? []).find((s) => s.id !== room.id && s.type === room.type &&
    COMBINE_ROOM_NAMES.includes(norm(s.unitNumber))) ?? null
}

export const combinedLabel = (room, partner) => `${room?.unitNumber ?? ''} + ${partner?.unitNumber ?? ''}`

// Rooms that run as a function ON THEIR OWN: no partner to open into, just the
// same room with extra tables and chairs set out for the same flat set-up fee
// (assistant board, 26 Oct 2026). Stored as ONE ordinary row carrying
// useAsFunction + setupCredits, with combinedRooms holding the room name as the
// function label — but no combinedGroupId, so it edits and cancels as a single
// booking.
export const SOLO_FUNCTION_ROOM_NAMES = ['central']
export const SOLO_FUNCTION_EXPLAINER = `We set the room up for your function with extra tables and chairs. You pay the room hire plus a A$${COMBINED_SETUP_FEE} set-up fee (${COMBINED_SETUP_CREDITS} credits), and both can come out of your credit allowance.`

// What "Use as function" means for `room`: open into its partner (North +
// South) or set up on its own (Central). null when the room has no such option.
export function functionOption(room, spaces) {
  const partner = combinePartner(room, spaces)
  if (partner) return { partner, rooms: [room, partner], label: combinedLabel(room, partner), maxPax: COMBINED_MAX_PAX, explainer: COMBINED_EXPLAINER }
  if (room && SOLO_FUNCTION_ROOM_NAMES.includes(norm(room.unitNumber))) {
    return { partner: null, rooms: [room], label: room.unitNumber, maxPax: null, explainer: SOLO_FUNCTION_EXPLAINER }
  }
  return null
}

// The booking fields that mark a function booking, for the row at index i.
// The first row carries the set-up; invitations go out from it alone.
export function functionFields(fn, i, groupId) {
  return {
    useAsFunction: true, combinedRooms: fn.label,
    ...(fn.partner ? { combinedGroupId: groupId } : {}),
    ...(i === 0 ? { setupCredits: COMBINED_SETUP_CREDITS } : { inviteGuests: false }),
  }
}

// A booked function that is a single room (Central) rather than a pair.
export const isSoloFunction = (b) => !!b?.useAsFunction && !b?.combinedGroupId

export const newCombinedGroupId = () => `cmb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

// Every row of a combined booking (including `booking` itself).
export function combinedGroup(booking, bookings) {
  if (!booking?.combinedGroupId) return booking ? [booking] : []
  return (bookings ?? []).filter((b) => b.combinedGroupId === booking.combinedGroupId)
}

// Credits one booking row needs: its room hire, plus the set-up on the row
// that carries it.
export function bookingCreditsNeed(booking, room, hours) {
  return round2(creditsForBooking(room, hours) + Number(booking?.setupCredits || 0))
}

// Cash owed for `short` credits the allowance couldn't cover. The pool covers
// room hire first, so the shortfall lands on the set-up first — and the set-up
// is a flat A$ fee, never discounted the way room hire is for members.
export function payableForShortfall(short, booking, room, companyId, leases) {
  const setupShort = Math.min(Number(short || 0), Number(booking?.setupCredits || 0))
  return round2(payableForCredits(short - setupShort, room, companyId, leases) + setupShort * CREDIT_VALUE)
}

// Room name for the overage fee line, so a set-up shortfall reads as such.
export const feeRoomName = (booking, room) =>
  booking?.setupCredits ? `${room?.unitNumber ?? ''} + function set-up` : room?.unitNumber
