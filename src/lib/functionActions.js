// Shared function-booking actions used by both the admin hub (FunctionBookings.jsx)
// and the CRM Function Enquiries tab (FunctionEnquiries.jsx). Anything that mutates
// tenants/members/invoices/bookings goes through the passed-in `store` so it stays
// on the authenticated admin side; the function_bookings row itself is written
// directly to Supabase.
import { supabase } from './supabase.js'
import { ADDONS, computeQuote, bufferedWindow, balanceDueDate } from './functionBooking.js'

const today = () => new Date().toISOString().split('T')[0]
const nowIso = () => new Date().toISOString()

export function portalBaseUrl(settings) {
  return settings?.portalUrl || `${window.location.origin}/portal`
}

// Persist a function_bookings record + return it (stamped).
export async function persistFn(record) {
  const item = { ...record, updatedAt: nowIso() }
  await supabase.from('function_bookings').upsert({ id: item.id, data: item, updated_at: item.updatedAt })
  return item
}

// Rough/opening quote for a booking (uses its snapshot if present).
export function quoteFor(b) {
  return b.quote || computeQuote({ ...b, bookedOn: today() })
}

// ── 1. Brochure / info email (early funnel) ──────────────────────────────────
export async function sendBrochure(booking) {
  await fetch('/api/function-bookings/notify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking, mode: 'brochure' }),
  }).catch(() => {})
  return persistFn({ ...booking, brochureSentAt: nowIso(), stage: booking.stage === 'enquiry' ? 'quoted' : booking.stage })
}

// ── 2. Booking invite → drop-in portal account ───────────────────────────────
// Creates a lightweight `function`-tagged prospect company (so the portal login
// resolves an account), then emails a set-password / booking link to the portal.
export async function sendBookingInvite({ store, booking, settings }) {
  let tenantId = booking.companyId
  if (!tenantId) {
    const t = store.addTenant({
      businessName: booking.organisation || booking.name || 'Function client',
      contactName: booking.name || '', email: booking.email || '', phone: booking.phone || '',
      clientType: 'function', status: 'prospect', industry: 'Function client',
    })
    tenantId = t.id
  }
  const redirectTo = portalBaseUrl(settings)
  await fetch('/api/auth/invite', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: booking.email, redirectTo,
      subject: 'Confirm your Hexa Space function booking',
      heading: 'Confirm your function booking',
      intro: 'Set up your quick access to the Hexa Space portal, where you can enter your event details, see your total and deposit, and confirm your booking.',
      ctaLabel: 'Set up access & continue',
    }),
  }).catch(() => {})
  return persistFn({ ...booking, companyId: tenantId, stage: 'invited', inviteSentAt: nowIso() })
}

// ── Finalise the client’s company + member from captured info ─────────────────
function finaliseClient(store, b) {
  const ci = b.companyInfo || {}
  const mi = b.memberInfo || {}
  let tenantId = b.companyId
  if (tenantId) {
    const patch = {}
    if (ci.businessName) patch.businessName = ci.businessName
    if (ci.abn) patch.abn = ci.abn
    if (ci.phone) patch.phone = ci.phone
    if (ci.contactName) patch.contactName = ci.contactName
    patch.clientType = 'function'
    if (patch.businessName || patch.abn || patch.phone) store.updateTenant(tenantId, patch)
  } else {
    const t = store.addTenant({
      businessName: ci.businessName || b.organisation || b.name || 'Function client',
      contactName: ci.contactName || b.name || '', email: b.email || '', phone: ci.phone || b.phone || '',
      abn: ci.abn || '', clientType: 'function', status: 'client', industry: 'Function client',
    })
    tenantId = t.id
  }
  let memberId = b.memberId
  if (!memberId && (mi.name || b.name)) {
    const m = store.addMember({
      name: mi.name || b.name, email: mi.email || b.email, phone: mi.phone || b.phone || '',
      companyId: tenantId, clientType: 'function', role: 'Function contact', status: 'active',
    })
    memberId = m.id
  }
  return { tenantId, memberId }
}

// ── 3. Approve → invoices + TENTATIVE calendar hold ──────────────────────────
// The hold is created as 'Pending' (tentative) so the slot can't be double-booked
// while the client pays; it firms to 'Confirmed' when the deposit is marked paid.
export async function approveFunctionBooking({ store, booking, findFunctionSpace }) {
  const b = booking
  const q = computeQuote({ ...b, bookedOn: today() })
  const { tenantId, memberId } = finaliseClient(store, b)
  const clientName = b.organisation || b.companyInfo?.businessName || b.name || 'Function client'
  const base = { tenantId, source: 'function', status: 'pending', sentStatus: 'not_sent', functionRef: b.ref, clientName, clientEmail: b.email, issueDate: today() }

  // 50% venue-hire deposit (GST)
  store.addInvoice({ ...base, invoiceType: 'function_deposit', dueDate: today(), vatEnabled: true,
    lineItems: [{ description: `Function venue hire — 50% deposit · ${b.eventName || 'Function'} (${b.eventDate})`, revenueAccount: 'Function Space Hire', unitPrice: q.rentalDeposit, qty: 1, discountPct: 0 }] })
  // Refundable $300 security (no GST)
  store.addInvoice({ ...base, invoiceType: 'deposit', dueDate: today(), vatEnabled: false,
    lineItems: [{ description: `Refundable security deposit · ${b.eventName || 'Function'}`, revenueAccount: 'Security Deposit', unitPrice: q.securityDeposit, qty: 1, discountPct: 0 }] })
  // Balance (remaining 50% + cleaning + add-ons + late fee), due 14 days before event
  const lines = [
    { description: `Function venue hire — balance (50%) · ${b.eventDate}`, revenueAccount: 'Function Space Hire', unitPrice: q.rentalBalance, qty: 1, discountPct: 0 },
    { description: 'Cleaning fee', revenueAccount: 'Function Space Hire', unitPrice: q.cleaning, qty: 1, discountPct: 0 },
  ]
  if (q.staff) lines.push({ description: `F&B & AV staff — ${q.hours} hrs @ $40/hr`, revenueAccount: 'Function Space Hire', unitPrice: q.staff, qty: 1, discountPct: 0 })
  ADDONS.forEach((a) => { if (b.addons?.[a.key]) lines.push({ description: a.label, revenueAccount: 'Function Space Hire', unitPrice: a.price, qty: 1, discountPct: 0 }) })
  if (q.lateFee) lines.push({ description: 'Late booking surcharge', revenueAccount: 'Function Space Hire', unitPrice: q.lateFee, qty: 1, discountPct: 0 })
  store.addInvoice({ ...base, invoiceType: 'function_balance', dueDate: balanceDueDate(b.eventDate) || today(), vatEnabled: true, lineItems: lines })

  // Tentative calendar hold with ±30-min buffer
  let calendarBookingId = b.calendarBookingId
  const fn = findFunctionSpace ? findFunctionSpace(store.spaces) : null
  if (fn && b.eventDate && !calendarBookingId) {
    const { blockStart, blockEnd } = bufferedWindow(b.startTime, b.endTime)
    const item = store.addBooking({
      type: 'function', resourceId: fn.id, date: b.eventDate, startTime: blockStart, endTime: blockEnd,
      title: `${b.eventName || 'Function'} (tentative · incl. buffer)`, eventType: b.eventType, guests: Number(b.guests) || null,
      status: 'Pending', approval: 'approved', source: 'Function Bookings', functionRef: b.ref, repeat: 'none', createdBy: 'Admin',
    })
    calendarBookingId = item?.id
  }
  const updated = await persistFn({ ...b, stage: 'confirmed', approvedAt: nowIso(), confirmedAt: nowIso(), quote: q, tenantId, memberId, companyId: tenantId, calendarBookingId, depositPaid: false })
  fetch('/api/function-bookings/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking: updated, mode: 'confirmed' }) }).catch(() => {})
  return updated
}

// ── 4. Deposit paid → firm the tentative hold ────────────────────────────────
export async function setDepositPaid({ store, booking, paid }) {
  if (booking.calendarBookingId) store.updateBooking(booking.calendarBookingId, { status: paid ? 'Confirmed' : 'Pending', title: `${booking.eventName || 'Function'}${paid ? '' : ' (tentative)'} · incl. buffer` })
  return persistFn({ ...booking, depositPaid: paid })
}

// ── 5. Decline ────────────────────────────────────────────────────────────────
export async function declineFunctionBooking({ store, booking }) {
  if (booking.calendarBookingId) store.deleteBooking(booking.calendarBookingId)
  return persistFn({ ...booking, stage: 'cancelled', calendarBookingId: null })
}

// ── Post-event: resolve the $300 security deposit ────────────────────────────
export async function resolveDeposit({ store, booking, damage, refund, overflow, notes }) {
  const tenantId = booking.tenantId || booking.companyId || null
  const clientName = booking.organisation || booking.name || 'Function client'
  if (refund > 0) store.addInvoice({ tenantId, source: 'function', invoiceType: 'bond_refund', status: 'pending', sentStatus: 'not_sent', functionRef: booking.ref, clientName, clientEmail: booking.email, issueDate: today(), dueDate: today(), vatEnabled: false, lineItems: [{ description: `Security deposit refund · ${booking.eventName || 'Function'}`, revenueAccount: 'Security Deposit', unitPrice: -refund, qty: 1, discountPct: 0 }] })
  if (overflow > 0) store.addInvoice({ tenantId, source: 'function', invoiceType: 'function_damage', status: 'pending', sentStatus: 'not_sent', functionRef: booking.ref, clientName, clientEmail: booking.email, issueDate: today(), dueDate: today(), vatEnabled: true, lineItems: [{ description: `Damage / excess cleaning · ${booking.eventName || 'Function'} — ${notes || ''}`, revenueAccount: 'Function Space Hire', unitPrice: overflow, qty: 1, discountPct: 0 }] })
  return persistFn({ ...booking, stage: 'refunded', refundedAt: nowIso(), refundAmount: refund, damageAmount: damage, damageNotes: notes, securityStatus: damage >= 300 ? 'withheld' : damage > 0 ? 'partial' : 'refunded' })
}
