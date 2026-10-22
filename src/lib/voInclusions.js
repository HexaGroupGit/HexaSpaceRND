// Virtual Office membership inclusions — printed on the Virtual Office
// Membership Agreement (screen/e-sign template + PDF export).
// Two packages: $75+GST (basic) and $150+GST (premium). The premium-only
// lines below are dropped from contracts priced under $150/month.
import { virtualSuiteLabel, VO_LIST_PRICE } from './virtualSuites.js'

export const VO_PREMIUM_ONLY = [
  'Daily Access to Sky & Tian Meeting Room + Consulting Rooms (2 Hours Daily)',
  'Coworking lounge access with Enterprise-Grade WiFi. 9:00AM - 5:30PM',
  'Complimentary Tea & Coffee',
]

// The address line — and the same line once the member has their own suite.
export const VO_ADDRESS_INCLUSION =
  'Premium Business Address in Box Hill (Level 4/830 Whitehorse Road Box Hill VIC 3128)'
const voAddressInclusion = (suite) =>
  `Premium Business Address in Box Hill (${suite}, Level 4/830 Whitehorse Road Box Hill VIC 3128)`

// The member-rate line. The $75 address package lost the room discount on
// 22 Oct 2026 — see addressOnlyWithoutRoomDiscount below.
export const VO_ROOM_DISCOUNT_INCLUSION =
  'Booking access to meeting rooms, event spaces and media studios with member’s discount (Refer to Meeting Room Pricing Guide)'
const VO_ROOM_ACCESS_INCLUSION =
  'Booking access to meeting rooms, event spaces and media studios (Refer to Meeting Room Pricing Guide)'

export const VO_INCLUSIONS = [
  VO_ADDRESS_INCLUSION,
  'Mail & Package Handling',
  'Access to Reception Services',
  VO_ROOM_DISCOUNT_INCLUSION,
  'Daily Access to Sky & Tian Meeting Room + Consulting Rooms (2 Hours Daily)',
  'Coworking lounge access with Enterprise-Grade WiFi. 9:00AM - 5:30PM',
  'Connection to the Ucommune network across China, Singapore and Hong Kong',
  'Exclusive invitations to community events',
  'Complimentary Tea & Coffee',
]

// membershipType counts too: a VO born from an accepted proposal is written as
// a generic "Membership Agreement", so documentType alone missed it entirely.
export const isVirtualOfficeAgreement = (lease, space) =>
  /virtual office/i.test(`${lease?.documentType ?? ''} ${lease?.membershipType ?? ''}`) ||
  space?.type === 'virtual'

// The VO package is priced off the contract's LIST monthly (a discounted
// premium contract is still the premium package).
const voListMonthly = (lease) =>
  Number(lease?.items?.[0]?.steps?.[0]?.listPrice ?? lease?.listPrice ?? lease?.monthlyRent ?? 0)

// The $75 address package stopped carrying the member room discount for
// contracts created from 22 Oct 2026 (Melbourne). Earlier $75 contracts keep it
// — their signed agreement lists it. createdAt is a UTC instant, so the cutoff
// is Melbourne midnight as an instant; startDate is the fallback for records
// with no createdAt.
export const VO_ROOM_DISCOUNT_DROPPED_AT = '2026-10-21T13:00:00.000Z'
export function addressOnlyWithoutRoomDiscount(lease, space) {
  if (!isVirtualOfficeAgreement(lease, space)) return false
  if (voListMonthly(lease) >= VO_LIST_PRICE) return false
  // A proposal-accepted VO names its package ("Virtual Office Plus · Suite 431")
  // but stores no list price, so a Plus deal quoted under $150 is still Plus.
  if (/plus/i.test(String(lease?.resource ?? ''))) return false
  // A renewal carries the first contract's date, so a grandfathered member
  // keeps the discount across renewals.
  const since = lease?.originalCreatedAt ?? lease?.createdAt
  const created = since ? new Date(since) : null
  if (created && !isNaN(created)) return created.toISOString() >= VO_ROOM_DISCOUNT_DROPPED_AT
  return String(lease?.startDate ?? '') >= '2026-10-22'
}

// The full inclusions list an agreement should print: VO agreements get their
// package's standard set first, then whatever negotiated extras were typed on
// the contract (lease.inclusions — one per line). Any agreement type can carry
// custom inclusions; the section renders whenever this returns items.
export function leaseInclusions(lease, space) {
  const custom = String(lease?.inclusions ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
  if (!isVirtualOfficeAgreement(lease, space)) return custom
  const premium = voListMonthly(lease) >= VO_LIST_PRICE
  const noDiscount = addressOnlyWithoutRoomDiscount(lease, space)
  const base = (premium ? VO_INCLUSIONS : VO_INCLUSIONS.filter((i) => !VO_PREMIUM_ONLY.includes(i)))
    .map((i) => (noDiscount && i === VO_ROOM_DISCOUNT_INCLUSION ? VO_ROOM_ACCESS_INCLUSION : i))
  // Once the member holds a suite, the agreement names it: this exact line is
  // what they register with ASIC and hand to their bank.
  const suite = virtualSuiteLabel(space)
  const withSuite = suite
    ? base.map((i) => (i === VO_ADDRESS_INCLUSION ? voAddressInclusion(suite) : i))
    : base
  return [...withSuite, ...custom]
}
