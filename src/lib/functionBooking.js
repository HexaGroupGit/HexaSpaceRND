import { blockingResourceIds } from './roomConflicts.js'

// ── Function Space Hire — shared pricing engine, constants & terms ────────────
// Single source of truth used by the admin hub (FunctionBookings.jsx), the public
// agreement/sign page (FunctionSignPage.jsx) and the members portal
// (PortalFunction.jsx). Keeping the maths in one place means the price the client
// sees on the website, in the agreement and on their invoice is always identical.

// Rates are quoted EX-GST. Weekday vs weekend is decided by the event date.
export const RATES = { weekday: 250, weekend: 325 }
export const CLEANING_FEE = 200          // mandatory, ex-GST
export const SECURITY_DEPOSIT = 300      // fixed, refundable, no GST
export const LATE_FEE = 250              // booked within LATE_WINDOW_DAYS of the event

// Admin-editable defaults (Settings → settings.functionSpace, edited from the
// Function Bookings → Pricing tab). configureFunctionPricing() is called once
// settings load (admin store / portal / app); values override the constants
// above for every NEW quote. Per-booking priceOverrides still win over both.
let CONFIGURED = {}
export function configureFunctionPricing(d) { CONFIGURED = d || {} }
export function functionPricingDefaults() {
  const num = (v, fb) => (v === '' || v == null || Number.isNaN(Number(v)) ? fb : Number(v))
  return {
    weekdayRate: num(CONFIGURED.weekdayRate, RATES.weekday),
    weekendRate: num(CONFIGURED.weekendRate, RATES.weekend),
    cleaningFee: num(CONFIGURED.cleaningFee, CLEANING_FEE),
    securityDeposit: num(CONFIGURED.securityDeposit, SECURITY_DEPOSIT),
    lateFee: num(CONFIGURED.lateFee, LATE_FEE),
  }
}
export const LATE_WINDOW_DAYS = 7
export const STAFF_RATE = 40             // per hour, ex-GST
export const STAFF_GUEST_THRESHOLD = 80  // staff only charged for functions over 80 pax
export const GST_RATE = 0.10
export const DEPOSIT_PCT = 0.5           // non-refundable deposit = 50% of venue hire
export const BUFFER_MIN = 30             // 30-min turnover buffer each side of the event
export const BALANCE_DUE_DAYS = 14       // full balance due this many days before the event

// No client-selectable add-ons — the only extra is the F&B & AV staff charge,
// which is auto-applied at $40/hr for functions over 80 guests.
export const ADDONS = []

const round = (n) => Math.round((Number(n) || 0) * 100) / 100

// ── Time helpers ──────────────────────────────────────────────────────────────
export function toMin(t) {
  const [h, m] = String(t || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
export function fromMin(x) {
  const clamped = Math.max(0, Math.min(24 * 60, x))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
export function shiftTime(t, deltaMin) {
  return fromMin(toMin(t) + deltaMin)
}
export function hoursBetween(start, end) {
  return Math.max(0, (toMin(end) - toMin(start)) / 60)
}
export function isWeekendDate(dateStr) {
  if (!dateStr) return false
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay()
  return day === 0 || day === 6
}
function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return null
  const a = new Date(`${fromStr}T00:00:00`)
  const b = new Date(`${toStr}T00:00:00`)
  return Math.floor((b - a) / 86400000)
}

// The physical calendar hold — event window widened by the 30-min buffer each side.
export function bufferedWindow(startTime, endTime) {
  return {
    blockStart: shiftTime(startTime, -BUFFER_MIN),
    blockEnd: shiftTime(endTime, BUFFER_MIN),
  }
}

// ── Multi-session series ─────────────────────────────────────────────────────
// A booking is either single-session (legacy eventDate/startTime/endTime) or a
// series with sessions: [{ date, startTime, endTime }]. This normaliser is the
// one place that decides which — everything else works off the returned array.
// The booking's eventDate/startTime/endTime always mirror the FIRST session so
// legacy consumers (reminders, sorting, portal cards) keep working.
export function bookingSessions(b = {}) {
  if (Array.isArray(b.sessions) && b.sessions.length) {
    return b.sessions
      .filter((s) => s?.date && s?.startTime && s?.endTime)
      .sort((a, z) => `${a.date}T${a.startTime}`.localeCompare(`${z.date}T${z.startTime}`))
  }
  return b.eventDate ? [{ date: b.eventDate, startTime: b.startTime, endTime: b.endTime }] : []
}

// "25/07/2026" for one session, "6 sessions · 25/07 – 30/08/2026" for a series.
export function sessionsLabel(b = {}) {
  const ss = bookingSessions(b)
  if (ss.length === 0) return b.eventDate || ''
  const dmy = (d) => { const [y, m, day] = String(d).split('-'); return `${day}/${m}/${y}` }
  if (ss.length === 1) return dmy(ss[0].date)
  const dm = (d) => { const [, m, day] = String(d).split('-'); return `${day}/${m}` }
  return `${ss.length} sessions · ${dm(ss[0].date)} – ${dmy(ss[ss.length - 1].date)}`
}

// ── Pricing engine ──────────────────────────────────────────────────────────
// input: single-session { eventDate, startTime, endTime, guests, bookedOn } or a
// series { sessions: [{date,startTime,endTime}], guests, bookedOn }. Rates are
// per-session (weekday/weekend by each session's own date); the cleaning fee
// applies per session (the venue is turned over after every one); the security
// deposit is held once per booking; the late surcharge applies once, judged
// against the FIRST session. bookedOn defaults to the first date (no late fee)
// if not supplied — callers that know "today" should pass it.
//
// NEGOTIATED PRICING: input.priceOverrides (set on the booking via Admin →
// Function Bookings → Adjust pricing) customises a quote without forking the
// maths — every recompute (approve, deposit-paid, resend) flows the overrides
// through, so a negotiated price survives stage transitions.
//   { rate,                 // custom $/hr ex-GST, replaces weekday AND weekend
//     cleaningFee,          // per-session ex-GST ('' / null = standard)
//     securityDeposit,      // flat, no GST ('' / null = standard $300)
//     waiveLateFee,         // true → no late surcharge
//     discountPct | discountAmount, discountReason,   // pct wins if both set
//     extraLines: [{ description, amount }] }         // ex-GST, taxable
const numOr = (v, fallback) => (v === '' || v == null || Number.isNaN(Number(v)) ? fallback : Number(v))

export function computeQuote(input = {}) {
  const { guests, bookedOn } = input
  const o = input.priceOverrides || {}
  const sessionList = bookingSessions(input)
  const staffApplies = Number(guests) > STAFF_GUEST_THRESHOLD

  const D = functionPricingDefaults()
  const customRate = numOr(o.rate, null)
  const cleaningFee = numOr(o.cleaningFee, D.cleaningFee)

  const sessions = sessionList.map((s) => {
    const isWeekend = isWeekendDate(s.date)
    const rate = customRate ?? (isWeekend ? D.weekendRate : D.weekdayRate)
    const hours = round(hoursBetween(s.startTime, s.endTime))
    return {
      date: s.date, startTime: s.startTime, endTime: s.endTime,
      isWeekend, rate, hours,
      rental: round(rate * hours),
      staff: staffApplies ? round(STAFF_RATE * hours) : 0,
      cleaning: cleaningFee,
    }
  })
  const sessionCount = sessions.length
  const first = sessions[0] ?? { isWeekend: false, rate: customRate ?? D.weekdayRate, date: input.eventDate }

  const hours = round(sessions.reduce((s, x) => s + x.hours, 0))
  const rental = round(sessions.reduce((s, x) => s + x.rental, 0))
  const staff = round(sessions.reduce((s, x) => s + x.staff, 0))
  const cleaning = round(cleaningFee * Math.max(1, sessionCount))

  const extras = (o.extraLines || [])
    .map((l) => ({ description: (l.description || '').trim(), amount: round(l.amount) }))
    .filter((l) => l.description && l.amount !== 0)
  const extrasTotal = round(extras.reduce((s, l) => s + l.amount, 0))
  const addonsTotal = round(staff + extrasTotal)

  const days = daysBetween(bookedOn, first.date)
  const lateFee = o.waiveLateFee ? 0
    : days != null && days >= 0 && days < LATE_WINDOW_DAYS ? D.lateFee : 0

  // Negotiated discount — % of the pre-discount subtotal, or a flat amount.
  const preDiscount = round(rental + cleaning + addonsTotal + lateFee)
  const discountPct = numOr(o.discountPct, 0)
  const discount = discountPct > 0
    ? round(preDiscount * Math.min(discountPct, 100) / 100)
    : Math.min(numOr(o.discountAmount, 0), preDiscount)

  // Booking cost = everything except the refundable security deposit. GST applies.
  const taxable = round(preDiscount - discount)
  const gst = round(taxable * GST_RATE)
  const total = round(taxable + gst)

  // Deposit invoice (due now) = 50% of the booking cost (GST applies) + the
  // refundable security deposit (no GST). Balance = the other 50% (GST).
  const depositHalf = round(taxable * DEPOSIT_PCT)          // ex-GST invoice line
  const balanceHalf = round(taxable - depositHalf)          // ex-GST invoice line
  const securityDeposit = numOr(o.securityDeposit, D.securityDeposit) // no GST
  const depositIncGst = round(depositHalf * (1 + GST_RATE))
  const dueNow = round(depositIncGst + securityDeposit)     // display
  const balanceDue = round(total - depositIncGst)           // display

  return {
    sessions, sessionCount,
    isWeekend: first.isWeekend, rate: first.rate, hours,
    rental, depositHalf, balanceHalf,
    cleaning, staff, staffApplies, addonsTotal,
    extras, extrasTotal,
    lateFee,
    discount, discountPct: discountPct > 0 ? discountPct : 0,
    discountReason: discount > 0 ? (o.discountReason || '').trim() : '',
    customRate: customRate != null,
    taxable, gst, total,
    securityDeposit, depositIncGst, dueNow, balanceDue,
  }
}

// Balance invoice due date = BALANCE_DUE_DAYS before the event (YYYY-MM-DD).
// The balance (remaining 50%) is due 14 days before the event — but never in the
// past: for a late booking (event within 14 days) it falls due immediately.
export function balanceDueDate(eventDate, bookedOn) {
  if (!eventDate) return null
  const d = new Date(`${eventDate}T00:00:00`)
  d.setDate(d.getDate() - BALANCE_DUE_DAYS)
  const due = d.toISOString().split('T')[0]
  const today = bookedOn || new Date().toISOString().split('T')[0]
  return due < today ? today : due // late booking → due now
}

// ── Terms & Conditions (from the Function Space Hire Form) ────────────────────
// Shown in full on the agreement/sign page; the client must tick to accept.
export const TERMS_INTRO =
  '"Hexa Space" refers to the function space within our workspace, available for rental. ' +
  '"Client" refers to the individual or entity renting Hexa Space for an event. ' +
  '"Event" refers to the specific gathering or occasion for which the Client is renting Hexa Space.'

export const TERMS = [
  { title: 'Rental Fees', body: 'The venue hire rate for Hexa Space is $250 +GST per hour on weekdays and $325 +GST per hour on weekends. These fees must be paid in full at least 14 days prior to the event date. A non-refundable deposit of 50% of the total rental fee is required at the time of booking to secure the reservation.' },
  { title: 'Booking Confirmation', body: 'Bookings only commence once the deposit has been paid. No reservation is confirmed or held until Hexa Space has received the required deposit.' },
  { title: 'Cleaning Fee', body: 'A mandatory cleaning fee of $200 +GST will be added to the total rental cost. This fee covers the basic cleaning and maintenance of Hexa Space after the event.' },
  { title: 'Security Deposit', body: 'A refundable security deposit of $300 is required at the time of booking. The security deposit will be refunded within 5 business days after the event, provided that no damages or additional fees have been incurred.' },
  { title: 'Bump-In / Bump-Out', body: 'Each booking includes 1 hour of complimentary bump-in and 1 hour of complimentary bump-out. Additional set-up or pack-down time is charged at a rate per 30 minutes. A 30-minute turnover buffer is reserved before and after your event.' },
  { title: 'Meeting Rooms', body: 'All meeting rooms remain locked by default. Where meeting room access is required, the Hexa team will book the rooms internally to avoid clashes with other bookings.' },
  { title: 'Liability', body: 'The Client agrees to indemnify, defend, and hold harmless Hexa Space, its owners, employees, agents, and representatives from any and all claims, liabilities, damages, or expenses (including reasonable attorney’s fees) arising from or related to the use of Hexa Space for the Event, except for any claims or liabilities caused solely by the negligence or misconduct of Hexa Space.' },
  { title: 'Damages & Additional Charges', body: 'The Client is responsible for any damages to Hexa Space or its property caused by the Client, their guests, or any third-party vendors hired by the Client. The cost of any necessary repairs or replacements will be deducted from the security deposit. If the damages exceed the security deposit amount, the Client will be billed for the additional costs. Additional cleaning and/or damage fees apply in cases of misconduct, excessive cleaning requirements, or venue damage.' },
  { title: 'Rules and Regulations', body: 'The Client is responsible for obtaining any necessary permits, licenses, or approvals required for the Event. The Client shall ensure that the noise level during the Event does not exceed any applicable legal limits or cause a disturbance to others. Smoking is not allowed inside Hexa Space. The Client agrees to comply with all applicable laws, ordinances, and regulations during the Event.' },
  { title: 'Late Booking Fee', body: 'A $250 surcharge applies to any booking made within 7 days of the event date.' },
  { title: 'Cancellation Policy', body: 'If the Client cancels the Event more than 30 days prior to the scheduled date, the initial deposit will be forfeited. If the Client cancels the Event within 14 to 30 days before the scheduled date, the Client will be responsible for 75% of the total rental fee. If the Client cancels the Event within 14 days of the scheduled date, the Client will be responsible for 100% of the total rental fee.' },
  { title: 'Force Majeure', body: 'Neither party shall be liable for any failure to perform its obligations under this Agreement if such failure is caused by events beyond its reasonable control, such as acts of God, war, terrorism, civil unrest, natural disasters, or any other similar occurrences.' },
]

// ── Lifecycle stages ──────────────────────────────────────────────────────────
export const STAGES = {
  enquiry:          { label: 'Enquiry',        cls: 'bg-gray-100 text-gray-600' },
  quoted:           { label: 'Quoted',         cls: 'bg-slate-100 text-slate-700' },
  requested:        { label: 'Booking Requested', cls: 'bg-amber-100 text-amber-700' },
  invited:          { label: 'Invited to Portal', cls: 'bg-indigo-100 text-indigo-700' },
  agreement_sent:   { label: 'Agreement Sent', cls: 'bg-blue-100 text-blue-700' },
  pending_approval: { label: 'Awaiting Approval', cls: 'bg-amber-100 text-amber-700' },
  signed:           { label: 'Signed',         cls: 'bg-yellow-100 text-yellow-700' },
  awaiting_deposit: { label: 'Deposit Due',    cls: 'bg-orange-100 text-orange-700' },
  confirmed:        { label: 'Confirmed',      cls: 'bg-green-100 text-green-700' },
  completed:        { label: 'Completed',      cls: 'bg-teal-100 text-teal-700' },
  refunded:         { label: 'Deposit Refunded', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled:        { label: 'Cancelled',      cls: 'bg-red-100 text-red-600' },
  declined:         { label: 'Declined',       cls: 'bg-red-100 text-red-600' },
}

// The three room layouts offered for the function space.
export const LAYOUTS = [
  { name: 'Cocktail', cap: 'Up to 100' },
  { name: 'Seminar', cap: 'Up to 80' },
  { name: 'Classroom', cap: 'Up to 45' },
]

// Other function bookings that already hold the same date (deposit due or
// confirmed) — used to warn about double-bookings at review time.
export function dateClashes(rows, eventDate, exceptId) {
  if (!eventDate) return []
  return (rows || []).filter((b) =>
    b.id !== exceptId && ['awaiting_deposit', 'confirmed'].includes(b.stage) &&
    bookingSessions(b).some((s) => s.date === eventDate))
}

// Series-aware variants: every session is checked, and each hit is tagged with
// the session date it clashes on so the warning can say which one.
export function seriesDateClashes(rows, booking) {
  const out = []
  for (const s of bookingSessions(booking)) {
    for (const hit of dateClashes(rows, s.date, booking.id)) out.push({ ...hit, clashDate: s.date })
  }
  return out
}

export function seriesCalendarClashes(bookings, resourceId, booking, spaces) {
  const out = []
  for (const s of bookingSessions(booking)) {
    for (const hit of calendarClashes(bookings, resourceId, s.date, s.startTime, s.endTime, booking.ref, spaces)) {
      out.push({ ...hit, clashDate: s.date })
    }
  }
  return out
}

// Do two [start,end) minute windows overlap?
export function timeOverlaps(aStart, aEnd, bStart, bEnd) {
  return toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd)
}

// Real calendar bookings that overlap this event's time window (incl. the 30-min
// buffer each side) on the function space resource — catches ANY hold on the
// venue that day (meeting/studio/function), not just other function requests.
// `spaces` (optional) makes this catch holds on rooms that physically share the
// venue — booking the Function Space also clashes with North/South/West meetings.
export function calendarClashes(bookings, resourceId, eventDate, startTime, endTime, exceptFunctionRef, spaces) {
  if (!resourceId || !eventDate || !startTime || !endTime) return []
  const { blockStart, blockEnd } = bufferedWindow(startTime, endTime)
  const blockIds = new Set(blockingResourceIds(resourceId, spaces))
  return (bookings || []).filter((bk) =>
    blockIds.has(bk.resourceId) &&
    bk.date === eventDate &&
    bk.status !== 'Cancelled' &&
    !(exceptFunctionRef && bk.functionRef === exceptFunctionRef) &&
    timeOverlaps(blockStart, blockEnd, bk.startTime || '00:00', bk.endTime || '23:59'))
}

export function money(v) {
  const n = Number(v) || 0
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
