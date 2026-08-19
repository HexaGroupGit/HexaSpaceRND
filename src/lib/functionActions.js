// Shared function-booking actions used by the admin hub (FunctionBookings.jsx)
// and the CRM Function Enquiries tab (FunctionEnquiries.jsx). Anything that
// mutates tenants/members/invoices/bookings goes through the passed-in `store`;
// the function_bookings row is written directly to Supabase.
//
// Flow: enquiry → (brochure w/ Book-a-time link) → requested (website form) →
// review/approve → invited (portal invite) → client completes portal → deposit
// raised (awaiting_deposit) → deposit paid → confirmed (balance + calendar) →
// completed → refunded. Management can also block the dates before the deposit
// lands (holdWithoutDeposit) — same confirmed stage, deposit still owed.
import { supabase } from './supabase.js'
import { authHeaders } from './apiFetch.js'
import { ADDONS, computeQuote, bufferedWindow, balanceDueDate, money, bookingSessions, sessionsLabel } from './functionBooking.js'
import { PORTAL_URL } from './sendEmail.js'

const today = () => new Date().toISOString().split('T')[0]
const nowIso = () => new Date().toISOString()
const randToken = () => Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')

export function portalBaseUrl(settings) {
  return settings?.portalUrl || PORTAL_URL
}

export async function persistFn(record) {
  const item = { ...record, updatedAt: nowIso() }
  await supabase.from('function_bookings').upsert({ id: item.id, data: item, updated_at: item.updatedAt })
  return item
}

export function quoteFor(b) {
  return b.quote || computeQuote({ ...b, bookedOn: today() })
}

// Has the client already completed their full details (via the portal)?
function hasDetails(b) {
  return !!(b.signedAt || b.companyInfo || b.memberInfo)
}

// Branded HTML block embedded in the "complete your function booking" invite
// email so the client sees exactly what they're booking — every session date &
// time, the per-session pricing, the full quote and the deposit/balance split
// (not just the amount due). Inline styles only (email-safe).
function functionQuoteSummaryHtml(b) {
  const q = quoteFor(b)
  const OLIVE = '#7F8B2F', MUTE = '#6b6b6b', HAIR = '#e3e1e6', INK = '#1a1a1a'
  const SANS = "'HexaGT','Helvetica Neue',Arial,sans-serif"
  const dmy = (d) => { const [y, m, day] = String(d || '').split('-'); return day ? `${day}/${m}/${y}` : '—' }
  const r = (l, v, strong) => `<tr>
    <td style="padding:8px 0;font-family:${SANS};font-size:12px;color:${MUTE};border-bottom:1px solid ${HAIR}">${l}</td>
    <td style="padding:8px 0;font-family:${SANS};font-size:13px;color:${INK};text-align:right;${strong ? 'font-weight:600;' : ''}border-bottom:1px solid ${HAIR}">${v}</td>
  </tr>`
  const ss = (q.sessions && q.sessions.length) ? q.sessions : bookingSessions(b)
  let lines = ''
  if (ss.length > 1) {
    lines += `<tr><td colspan="2" style="padding:12px 0 4px;font-family:${SANS};font-size:11px;color:${OLIVE};text-transform:uppercase;letter-spacing:.1em">Sessions (${ss.length})</td></tr>`
    ss.forEach((s) => { lines += r(`${dmy(s.date)} · ${s.startTime || ''}–${s.endTime || ''}`, s.rental != null ? money(s.rental) : '') })
    if (q.cleaning) lines += r(`Cleaning — ${q.sessionCount || ss.length} sessions`, money(q.cleaning))
  } else {
    const s = ss[0] || {}
    lines += r('Date', `${dmy(s.date)} · ${s.startTime || ''}–${s.endTime || ''}`)
    lines += r(`Venue hire — ${q.hours || 0} hrs`, money(q.rental))
    if (q.cleaning) lines += r('Cleaning fee', money(q.cleaning))
  }
  if (q.staff > 0) lines += r('Event staff', money(q.staff))
  ;(q.extras || []).forEach((e) => { lines += r(e.description, money(e.amount)) })
  if (q.lateFee > 0) lines += r('Late booking fee', money(q.lateFee))
  if (q.discount > 0) lines += r(`Discount${q.discountPct ? ` (${q.discountPct}%)` : ''}${q.discountReason ? ` — ${q.discountReason}` : ''}`, `-${money(q.discount)}`)
  lines += r('GST (10%)', money(q.gst))
  lines += r('Total (inc GST)', money(q.total), true)
  return `<div style="margin:22px 0 6px">
    <div style="font-family:${SANS};font-size:11px;color:${OLIVE};text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px">Your booking · ${b.eventName || 'Function'}</div>
    <table style="width:100%;border-collapse:collapse">${lines}</table>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">
      ${r('Payable now — 50% deposit + $300 security', money(q.dueNow), true)}
      ${r('Balance — due 14 days before the first session', money(q.balanceDue))}
    </table>
  </div>`
}

// ── 1. Brochure / info email (with the Book-a-time link) ─────────────────────
export async function sendBrochure({ booking, settings }) {
  const requestToken = booking.requestToken || randToken()
  const updated = await persistFn({ ...booking, requestToken, brochureSentAt: nowIso(), stage: booking.stage === 'enquiry' ? 'quoted' : booking.stage })
  await fetch('/api/function-bookings/notify', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ booking: updated, mode: 'brochure' }),
  }).catch(() => {})
  return updated
}

// ── 2. Portal invite → drop-in account ───────────────────────────────────────
// Reuse an existing client/member with the same email — never create duplicates.
// If they already have an account they just log in to see their booking.
export async function sendBookingInvite({ store, booking, settings }) {
  const email = (booking.email || '').toLowerCase()
  let tenantId = booking.companyId
  if (!tenantId) {
    const existing = email ? (store.tenants || []).find((t) => (t.email || '').toLowerCase() === email) : null
    if (existing) tenantId = existing.id
    else tenantId = store.addTenant({
      businessName: booking.organisation || booking.name || 'Function client',
      contactName: booking.name || '', email: booking.email || '', phone: booking.phone || '',
      clientType: 'function', status: 'prospect', industry: 'Function client',
    }).id
  }
  const memberMatch = email ? (store.members || []).find((m) => (m.email || '').toLowerCase() === email) : null
  await fetch('/api/auth/invite', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({
      email: booking.email, redirectTo: `${portalBaseUrl(settings)}/function-space`,
      subject: 'Complete your Hexa Space function booking',
      heading: 'Your function booking is approved',
      intro: 'Great news — your date is available! Here are your booking details. Set up your portal access to review everything, sign, and pay your deposit to secure the venue.',
      extraHtml: functionQuoteSummaryHtml(booking),
      ctaLabel: 'Set up access & continue',
      footerLabel: 'Function Space Hire',
    }),
  }).catch(() => {})
  return persistFn({ ...booking, companyId: tenantId, memberId: booking.memberId || memberMatch?.id || null, stage: 'invited', inviteSentAt: nowIso() })
}

// ── 3. Approve a requested booking ───────────────────────────────────────────
// On approve we ALWAYS: lock in the quote, raise the deposit invoice (so it shows
// in their portal Billing straight away) and — for website requests — create their
// tenant + send the portal invite so they can log in, review, sign and pay.
// Member requests (already in the portal, details captured) skip the invite.
export async function approveFunctionBooking({ store, booking, settings }) {
  const q = computeQuote({ ...booking, bookedOn: today() })
  let cur = await persistFn({ ...booking, quote: q, approvedAt: nowIso() })

  // Website request → create account + email the "set up access & continue" link.
  if (!hasDetails(cur)) cur = await sendBookingInvite({ store, booking: cur, settings })

  // Raise the deposit (50% + $300 security), create tenant/member, email deposit.
  await fetch('/api/function-bookings/submit', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ id: cur.id }),
  }).catch(() => {})

  // submit.js wrote the definitive record (awaiting_deposit + invoice ids) — re-read it.
  const { data } = await supabase.from('function_bookings').select('data').eq('id', cur.id)
  return data?.[0]?.data || { ...cur, stage: 'awaiting_deposit' }
}

// ── Negotiated pricing ────────────────────────────────────────────────────────
// Persist per-booking price overrides (Admin → Function Bookings → Adjust
// pricing) and refresh any locked-in quote so the portal, emails and invoice
// amounts all show the negotiated numbers. Pass overrides = null to reset to
// standard rates.
export async function updatePricing({ booking, overrides }) {
  const b = { ...booking, priceOverrides: overrides || null, pricingAdjustedAt: overrides ? nowIso() : null }
  if (b.quote) b.quote = computeQuote({ ...b, bookedOn: today() })
  return persistFn(b)
}

// Re-issue the deposit at the adjusted price while it's still unpaid: void the
// pending deposit invoice, clear submit.js's raise-lock, and let it raise +
// email a fresh invoice at the new amount. Once the deposit is PAID, pricing
// changes flow to the balance invoice instead (raised at deposit-paid time).
export async function reissueDeposit({ store, booking }) {
  if (booking.depositPaid) throw new Error('Deposit already paid — adjustments now apply to the balance invoice only.')
  const q = computeQuote({ ...booking, bookedOn: today() })
  const cur = await persistFn({ ...booking, quote: q, depositRaisedAt: null, depositInvoiceId: null })
  const dep = (store.invoices || []).find((i) =>
    i.functionRef === booking.ref && i.invoiceType === 'function_deposit' && !['paid', 'voided'].includes(i.status))
  if (dep) store.voidInvoice(dep.id)
  await fetch('/api/function-bookings/submit', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ id: cur.id }),
  }).catch(() => {})
  const { data } = await supabase.from('function_bookings').select('data').eq('id', cur.id)
  return data?.[0]?.data || cur
}

const newInvoiceId = () => `inv${Date.now()}${Math.random().toString(36).slice(2, 6)}`

// Every invoice raised against a booking, read from Supabase rather than the
// admin store: the store loads once at page load, so an invoice raised
// server-side by submit.js earlier in the session isn't in it — and deciding
// "is there already a deposit invoice to void?" off stale data is how a client
// ends up holding two invoices for the same booking.
async function fnInvoices(ref) {
  const { data } = await supabase.from('invoices').select('data').eq('data->>functionRef', ref)
  return (data ?? []).map((r) => r.data).filter(Boolean)
}

// Void through the store when it knows the row (keeps the admin UI in step),
// straight to Supabase when it doesn't.
async function voidInvoiceRow({ store, invoice }) {
  if ((store.invoices || []).some((i) => i.id === invoice.id)) store.voidInvoice(invoice.id)
  else await supabase.from('invoices').upsert({ id: invoice.id, data: { ...invoice, status: 'voided' }, updated_at: nowIso() })
}

// The single invoice a courtesy hold is billed on: the whole venue hire (GST)
// plus the refundable security deposit (no GST) — no 50/50 split, because no
// deposit was taken. Due by the same 14-days-before deadline the terms set for
// payment in full.
function fullInvoice({ booking: b, quote: q, base, id }) {
  return {
    ...base, id, invoiceType: 'function_full', dueDate: balanceDueDate(b.eventDate) || today(), vatEnabled: true,
    lineItems: [
      { description: `Function booking, payable in full · ${b.eventName || 'Function'} (${sessionsLabel(b)})`, revenueAccount: 'Function Space Hire', unitPrice: q.taxable, qty: 1, discountPct: 0 },
      { description: `Refundable security deposit · ${b.eventName || 'Function'}`, revenueAccount: 'Security Deposit', unitPrice: q.securityDeposit, qty: 1, discountPct: 0, vatExempt: true },
    ],
  }
}

function invoiceBaseFor(b) {
  return {
    tenantId: b.tenantId || b.companyId || null, source: 'function', status: 'pending', sentStatus: 'not_sent',
    functionRef: b.ref, clientName: b.organisation || b.companyInfo?.businessName || b.name || 'Function client',
    clientEmail: b.email, issueDate: today(),
  }
}

// Re-issue a courtesy hold's full invoice at an adjusted price. There's no
// deposit split to rebuild, so this never goes near submit.js — void the
// outstanding invoice and raise a fresh one at the new amount.
export async function reissueHeldInvoice({ store, booking }) {
  const q = computeQuote({ ...booking, bookedOn: today() })
  const open = (await fnInvoices(booking.ref)).find((i) =>
    i.invoiceType === 'function_full' && !['paid', 'voided'].includes(i.status))
  if (open) await voidInvoiceRow({ store, invoice: open })
  const id = newInvoiceId()
  store.addInvoice(fullInvoice({ booking, quote: q, base: invoiceBaseFor(booking), id }))
  return persistFn({ ...booking, quote: q, fullInvoiceId: id })
}

// ── 4. Ask the client to pick a different date (clash) ───────────────────────
export async function askAmendDate({ booking, settings }) {
  const requestToken = booking.requestToken || randToken()
  const updated = await persistFn({ ...booking, requestToken, amendRequestedAt: nowIso() })
  await fetch('/api/function-bookings/notify', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ booking: updated, mode: 'amend_date' }),
  }).catch(() => {})
  return updated
}

// ── 5. Secure the venue: raise the invoices + place the calendar booking ────
// Two ways in — the deposit landed (confirmDepositPaid), or management chose to
// block the dates before it did (holdWithoutDeposit). Both place the same
// calendar holds; they differ in how the money is billed. Deposit paid → the
// usual 50% deposit + 50% balance. Courtesy hold → ONE invoice for the full
// amount, payable in full, and no deposit is marked as received.
async function secureVenue({ store, booking, findFunctionSpace, depositPaid }) {
  const b = booking
  const q = computeQuote({ ...b, bookedOn: today() })
  const tenantId = b.tenantId || b.companyId || null
  const clientName = b.organisation || b.companyInfo?.businessName || b.name || 'Function client'
  const invs = store.invoices || []
  const has = (type) => invs.some((i) => i.functionRef === b.ref && i.invoiceType === type && i.status !== 'voided')
  const base = { tenantId, source: 'function', status: 'pending', sentStatus: 'not_sent', functionRef: b.ref, clientName, clientEmail: b.email, issueDate: today() }

  // A courtesy hold is billed as ONE invoice for everything owed, not the 50/50
  // split — no deposit was taken, so chasing a deposit invoice AND a balance
  // invoice makes no sense. The pending deposit invoice raised at approve time
  // is voided so they're never asked for both.
  let fullInvoiceId = b.fullInvoiceId || null
  if (!depositPaid) {
    const live = await fnInvoices(b.ref)
    const openFull = live.find((i) => i.invoiceType === 'function_full' && i.status !== 'voided')
    if (openFull) {
      fullInvoiceId = openFull.id
    } else {
      const split = live.filter((i) => ['function_deposit', 'function_balance'].includes(i.invoiceType) && !['paid', 'voided'].includes(i.status))
      for (const inv of split) await voidInvoiceRow({ store, invoice: inv })
      fullInvoiceId = newInvoiceId()
      store.addInvoice(fullInvoice({ booking: b, quote: q, base, id: fullInvoiceId }))
    }
  } else if (fullInvoiceId || has('function_full')) {
    // Already on a full invoice — leave it alone when the money lands later and
    // this runs again to mark it paid.
  } else {
    // Safety net: raise the deposit (50% + $300 security) if it was never raised
    // (e.g. a manual hub booking that skipped the portal). One invoice, two lines.
    if (!has('function_deposit')) store.addInvoice({ ...base, invoiceType: 'function_deposit', dueDate: today(), vatEnabled: true, lineItems: [
      { description: `50% deposit — function booking · ${b.eventName || 'Function'} (${sessionsLabel(b)})`, revenueAccount: 'Function Space Hire', unitPrice: q.depositHalf, qty: 1, discountPct: 0 },
      { description: `Refundable security deposit · ${b.eventName || 'Function'}`, revenueAccount: 'Security Deposit', unitPrice: q.securityDeposit, qty: 1, discountPct: 0, vatExempt: true },
    ] })

    // Balance = the remaining 50% of the booking cost (GST), due 14 days before
    // the FIRST session (b.eventDate always mirrors the first session).
    if (!has('function_balance')) {
      store.addInvoice({ ...base, invoiceType: 'function_balance', dueDate: balanceDueDate(b.eventDate) || today(), vatEnabled: true, lineItems: [
        { description: `50% balance — function booking · ${b.eventName || 'Function'} (${sessionsLabel(b)})`, revenueAccount: 'Function Space Hire', unitPrice: q.balanceHalf, qty: 1, discountPct: 0 },
      ] })
    }
  }

  // Place a calendar hold for EVERY session (venue secured) with ±30-min buffer.
  let calendarBookingIds = b.calendarBookingIds ?? (b.calendarBookingId ? [b.calendarBookingId] : [])
  const fn = findFunctionSpace ? findFunctionSpace(store.spaces) : null
  const sessions = bookingSessions(b)
  if (fn && sessions.length && calendarBookingIds.length === 0) {
    calendarBookingIds = sessions.map((s, i) => {
      const { blockStart, blockEnd } = bufferedWindow(s.startTime, s.endTime)
      const item = store.addBooking({
        type: 'function', resourceId: fn.id, date: s.date, startTime: blockStart, endTime: blockEnd,
        title: `${b.eventName || 'Function'}${sessions.length > 1 ? ` — session ${i + 1}/${sessions.length}` : ''} (incl. buffer)`,
        eventType: b.eventType, guests: Number(b.guests) || null,
        status: 'Confirmed', approval: 'approved', source: 'Function Bookings', functionRef: b.ref, repeat: 'none', createdBy: 'Admin',
      })
      return item?.id
    }).filter(Boolean)
  }
  const updated = await persistFn({
    ...b, stage: 'confirmed', confirmedAt: b.confirmedAt || nowIso(), quote: q, tenantId, companyId: tenantId,
    depositPaid, depositPaidAt: depositPaid ? (b.depositPaidAt || nowIso()) : null,
    // heldWithoutDeposit clears the moment the deposit lands; the timestamp stays
    // as the record that the dates were blocked ahead of payment.
    heldWithoutDeposit: !depositPaid,
    heldWithoutDepositAt: b.heldWithoutDepositAt || (depositPaid ? null : nowIso()),
    fullInvoiceId,
    calendarBookingIds, calendarBookingId: calendarBookingIds[0] ?? null,
  })
  fetch('/api/function-bookings/notify', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ booking: updated, mode: depositPaid ? 'confirmed' : 'held' }) }).catch(() => {})
  // After-hours / weekend sessions need building management to unlock the
  // front door + lift (±30-min buffer) — the endpoint no-ops for business-hours
  // bookings and is idempotent, so fire it on every confirm. It normally just
  // SCHEDULES the request (3 business days before the session — building
  // management programs the lift weekly and won't take it earlier); the daily
  // function-reminders cron sends it. A booking confirmed inside that window
  // goes out straight away.
  fetch('/api/function-bookings/access-request', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ id: updated.id }) }).catch(() => {})
  return updated
}

export function confirmDepositPaid({ store, booking, findFunctionSpace }) {
  return secureVenue({ store, booking, findFunctionSpace, depositPaid: true })
}

// Management courtesy: block the dates now, money still owed. Nothing is
// waived — the client is invoiced the full amount in one hit (hire + GST +
// security deposit); only the "venue isn't held until the deposit lands" gate
// moves.
export function holdWithoutDeposit({ store, booking, findFunctionSpace }) {
  return secureVenue({ store, booking, findFunctionSpace, depositPaid: false })
}

// Manual (re)send of the building unlock request — used from the admin hub
// when the email needs to go again (e.g. the times changed after confirm).
export async function requestBuildingAccess({ booking, force = false }) {
  const r = await fetch('/api/function-bookings/access-request', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ id: booking.id, force }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'Request failed.')
  const { data } = await supabase.from('function_bookings').select('data').eq('id', booking.id)
  return { result: d, booking: data?.[0]?.data || booking }
}

// ── Decline ──────────────────────────────────────────────────────────────────
export async function declineFunctionBooking({ store, booking }) {
  const holds = booking.calendarBookingIds ?? (booking.calendarBookingId ? [booking.calendarBookingId] : [])
  holds.forEach((id) => store.deleteBooking(id))
  return persistFn({ ...booking, stage: 'declined', calendarBookingId: null, calendarBookingIds: [] })
}

// ── Post-event: resolve the $300 security deposit ────────────────────────────
export async function resolveDeposit({ store, booking, damage, refund, overflow, notes }) {
  const tenantId = booking.tenantId || booking.companyId || null
  const clientName = booking.organisation || booking.name || 'Function client'
  // Credit note against the security deposit — routed through the same admin
  // approval + tenant-notify queue as lease bond refunds (Billing → pending
  // bond refunds → Approve → client emailed). Linked to the deposit invoice.
  if (refund > 0) store.addInvoice({ tenantId, source: 'function', invoiceType: 'bond_refund', status: 'pending', approvalStatus: 'pending', creditNoteForId: booking.fullInvoiceId || booking.depositInvoiceId || null, sentStatus: 'not_sent', functionRef: booking.ref, reference: `Security deposit refund — ${booking.ref}`, clientName, clientEmail: booking.email, issueDate: today(), dueDate: today(), vatEnabled: false, lineItems: [{ description: `Security deposit refund · ${booking.eventName || 'Function'}`, revenueAccount: 'Security Deposit', unitPrice: -refund, qty: 1, discountPct: 0 }] })
  if (overflow > 0) store.addInvoice({ tenantId, source: 'function', invoiceType: 'function_damage', status: 'pending', sentStatus: 'not_sent', functionRef: booking.ref, clientName, clientEmail: booking.email, issueDate: today(), dueDate: today(), vatEnabled: true, lineItems: [{ description: `Damage / excess cleaning · ${booking.eventName || 'Function'} — ${notes || ''}`, revenueAccount: 'Function Space Hire', unitPrice: overflow, qty: 1, discountPct: 0 }] })
  return persistFn({ ...booking, stage: 'refunded', refundedAt: nowIso(), refundAmount: refund, damageAmount: damage, damageNotes: notes, securityStatus: damage >= 300 ? 'withheld' : damage > 0 ? 'partial' : 'refunded' })
}
