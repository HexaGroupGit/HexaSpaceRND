// POST /api/function-bookings/pay-and-confirm — pay a function booking in full
// on the spot, and secure the venue in the same action.
//
// Body: { id, preview?, override? }
//
// WHY: the standard path is enquiry → approve → 50% deposit + $300 security →
// balance 14 days out → confirmed. That is right for a $4,000 wedding booked
// months ahead. It is heavy for a two-hour workshop next Tuesday, where the
// client would rather just pay and have the room — and every extra step is
// another place the booking stalls with the dates unheld.
//
// So this is the drop-in shape applied to functions: charge the whole thing
// (hire + GST + the refundable security deposit) to the card, THEN confirm.
// Same order as api/bookings/pay-and-book.js, for the same reason — nobody ends
// up holding a venue they haven't paid for, and nobody is charged for dates that
// were taken while they were paying.
//
// The invoice and the calendar holds are built by src/lib/functionConfirm.js,
// which the admin hub's own confirm path uses too: a booking paid this way is
// indistinguishable afterwards from one whose deposit landed, except that it
// carries no balance to chase.
//
// `preview: true` prices it and re-checks the dates without charging anything.
import { stripeConfigured, stripeFetch } from '../_stripe.js'
import { applyCors } from '../_cors.js'
import { requireMember, isAdminEmail } from '../_auth.js'
import { selectAllRows } from '../_db.js'
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH1, bP, bTable, bSmall } from '../_brand.js'
import { computeQuote, bufferedWindow, bookingSessions, sessionsLabel } from '../../src/lib/functionBooking.js'
import { buildFullInvoice, buildSessionHolds, invoiceBaseFor, canPayInFull } from '../../src/lib/functionConfirm.js'
import { blockingResourceIds } from '../../src/lib/roomConflicts.js'

const money = (v) => `$${(Number(v) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dmy = (d) => String(d || '').split('-').reverse().join('/')
const toDec = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h + (m || 0) / 60 }
const overlaps = (aS, aE, bS, bE) => toDec(aS) < toDec(bE) && toDec(bS) < toDec(aE)

const isFunctionSpace = (s) => !!s && (s.type === 'function' || s.id === 'hx_func' || /function/i.test(s.unitNumber || ''))

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireMember(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb
  const isAdmin = await isAdminEmail(sb, auth.user.email)

  const { id, preview = false, override = false } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'id is required.' })

  try {
    const { data: fbRows } = await sb.from('function_bookings').select('data').eq('id', id)
    const booking = fbRows?.[0]?.data
    if (!booking) return res.status(404).json({ error: 'Booking not found.' })

    // A member may only pay for their own company's booking (or one raised
    // against their email); admins may take payment for any.
    if (!isAdmin) {
      const ownsIt = (booking.companyId && booking.companyId === auth.companyId) ||
        (booking.email && booking.email.toLowerCase() === auth.user.email.toLowerCase())
      if (!ownsIt) return res.status(403).json({ error: 'Not your booking.' })
    }

    if (!canPayInFull(booking)) {
      return res.status(400).json({
        error: booking.depositPaid || booking.paidInFullAt
          ? 'This booking has already been paid for.'
          : `A booking at the "${booking.stage}" stage can't be paid in full up front.`,
      })
    }

    const [{ data: spRows }, { data: tRows }, { data: settRow }] = await Promise.all([
      sb.from('spaces').select('id, data'),
      sb.from('tenants').select('id, data').eq('id', booking.tenantId || booking.companyId || '__none__'),
      sb.from('settings').select('data').eq('id', 'global').single(),
    ])
    const spaces = (spRows ?? []).map((r) => ({ ...r.data, id: r.id }))
    const settings = settRow?.data ?? {}
    const company = tRows?.[0] ? { ...tRows[0].data, id: tRows[0].id } : null

    // Price it HERE. The client's figure is a display value; this is the one the
    // card is charged, computed from the booking's own sessions and overrides.
    const quote = computeQuote({ ...booking, bookedOn: new Date().toISOString().split('T')[0] })
    const amount = Number(quote.fullDue ?? 0)
    if (!(amount > 0)) return res.status(400).json({ error: 'This booking has nothing to pay.' })

    const fnSpace = spaces.find(isFunctionSpace)
    if (!fnSpace) return res.status(500).json({ error: 'The Function Space is not set up as a bookable space.' })

    // Dates still free? Checked against server truth for EVERY session, on the
    // buffered window, and across every room the Function Space physically
    // occupies (North/South/West) — booking one of those blocks the venue.
    const sessions = bookingSessions(booking)
    if (!sessions.length) return res.status(400).json({ error: 'This booking has no sessions.' })
    const blockIds = [...new Set(blockingResourceIds(fnSpace.id, spaces))]
    const ourHolds = new Set(booking.calendarBookingIds ?? (booking.calendarBookingId ? [booking.calendarBookingId] : []))
    const clashes = []
    for (const s of sessions) {
      const { blockStart, blockEnd } = bufferedWindow(s.startTime, s.endTime)
      const { data: liveRows, error: availErr } = await sb
        .from('booking_availability')
        .select('id, resource_id, date, start_time, end_time, status')
        .in('resource_id', blockIds)
        .eq('date', s.date)
      // Fail CLOSED: if we can't see the calendar we don't take the money.
      if (availErr) return res.status(503).json({ error: 'We couldn’t confirm the venue is still free — please try again.' })
      for (const row of liveRows ?? []) {
        if (row.status === 'Cancelled' || ourHolds.has(row.id)) continue
        if (overlaps(blockStart, blockEnd, row.start_time, row.end_time)) {
          clashes.push(`${dmy(s.date)} ${s.startTime}–${s.endTime}`)
          break
        }
      }
    }
    if (clashes.length) {
      return res.status(409).json({
        error: `Those dates are no longer free: ${clashes.join(', ')}. Pick another time before taking payment.`,
        clashes,
      })
    }

    const hasCard = !!(company?.stripeCustomerId && company?.stripePaymentMethodId)

    if (preview) {
      return res.status(200).json({
        payable: hasCard,
        amount,
        breakdown: {
          hire: quote.taxable, gst: quote.gst, total: quote.total,
          securityDeposit: quote.securityDeposit, fullDue: quote.fullDue,
          sessions: quote.sessionCount, hours: quote.hours,
        },
        card: hasCard ? `${company.cardBrand ?? 'card'} ····${company.cardLast4 ?? ''}`.trim() : null,
        clientEmail: company?.email || booking.email || null,
        sessionsLabel: sessionsLabel(booking),
        // No card on file is not an error — it just means the deposit cycle (or
        // adding a card first) is the way through.
        reason: hasCard ? null : 'No card on file for this client — add one first, or use the deposit invoice instead.',
      })
    }

    if (!hasCard) return res.status(402).json({ error: 'Add a card first, then take payment.', code: 'card_required' })
    if (!stripeConfigured()) return res.status(500).json({ error: 'Stripe is not configured.' })

    // ── 1. Money first ──────────────────────────────────────────────────────
    const pi = await stripeFetch('/payment_intents', {
      amount: Math.round(amount * 100),
      currency: 'aud',
      customer: company.stripeCustomerId,
      payment_method: company.stripePaymentMethodId,
      off_session: 'true',
      confirm: 'true',
      description: `Function booking paid in full · ${booking.ref ?? ''} · ${booking.eventName || 'Function'}`.trim(),
      metadata: {
        kind: 'function_pay_in_full',
        functionRef: booking.ref ?? '',
        bookingId: id,
        companyId: company.id,
        takenBy: auth.user.email,
      },
    })
    if (!pi.ok || pi.json.status !== 'succeeded') {
      return res.status(402).json({
        error: pi.json.error?.message || `The payment was ${pi.json.status || 'declined'}. The booking has NOT been confirmed.`,
        code: pi.json.error?.code || 'payment_failed',
      })
    }
    const nowIso = new Date().toISOString()

    // ── 2. The paid invoice ─────────────────────────────────────────────────
    // Numbers live in JSONB with no uniqueness constraint — read-max-plus-one,
    // same as api/auto-billing.js.
    const numRows = await selectAllRows(sb, 'invoices', 'data->>number')
    const highest = numRows
      .map((x) => parseInt(String(x.number ?? '').replace(/\D/g, ''), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .reduce((max, n) => Math.max(max, n), 0)
    const template = settings.invoicing?.invoiceNumberTemplate ?? 'INV-{{number}}'
    const invoiceId = `inv${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const invoice = {
      ...buildFullInvoice({
        booking, quote, base: invoiceBaseFor(booking), id: invoiceId,
        paid: { amount, method: 'stripe', reference: pi.json.id },
      }),
      number: template.replace('{{number}}', String(highest + 1).padStart(4, '0')),
      paidInFullAt: nowIso,
      stripePaymentIntentId: pi.json.id,
    }

    // Any unpaid deposit/balance invoice raised earlier is void — they are not
    // owed now, and left pending they would be chased by the overdue cron.
    const { data: existingRows } = await sb.from('invoices').select('id, data').eq('data->>functionRef', booking.ref ?? '__none__')
    const toVoid = (existingRows ?? []).filter((r) =>
      ['function_deposit', 'function_balance', 'function_full'].includes(r.data?.invoiceType) &&
      !['paid', 'voided'].includes(r.data?.status))

    // ── 3. Calendar holds ───────────────────────────────────────────────────
    const holds = buildSessionHolds({ booking, functionSpaceId: fnSpace.id }).map((h) => ({
      ...h,
      id: `bk${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: nowIso,
    }))

    const writes = [
      sb.from('invoices').insert({ id: invoiceId, data: invoice }),
      ...toVoid.map((r) => sb.from('invoices').update({
        data: { ...r.data, status: 'voided', voidedAt: nowIso, voidReason: `Superseded by ${invoice.number} — booking paid in full` },
        updated_at: nowIso,
      }).eq('id', r.id)),
      ...(ourHolds.size ? [] : holds.map((h) => sb.from('bookings').insert({ id: h.id, data: h, updated_at: nowIso }))),
    ]
    const results = await Promise.all(writes)
    const dbErr = results.find((r) => r.error)?.error
    if (dbErr) {
      // Paid, but the booking didn't land. Surface it with the PaymentIntent —
      // never report success and never swallow this.
      console.error('FUNCTION PAY-IN-FULL WRITE FAILED AFTER CHARGE', { id, paymentIntent: pi.json.id, error: dbErr })
      return res.status(500).json({
        error: `The card was charged ${money(amount)} but the booking could not be confirmed. Quote ${pi.json.id} — do not charge again.`,
        paymentIntentId: pi.json.id,
      })
    }

    const calendarBookingIds = ourHolds.size ? [...ourHolds] : holds.map((h) => h.id)
    const confirmed = {
      ...booking,
      stage: 'confirmed',
      confirmedAt: booking.confirmedAt || nowIso,
      quote,
      tenantId: company.id,
      companyId: company.id,
      // The whole amount is in, so nothing is outstanding and nothing is held
      // on courtesy — both of the flags the deposit cycle uses say so.
      depositPaid: true,
      depositPaidAt: booking.depositPaidAt || nowIso,
      heldWithoutDeposit: false,
      paidInFull: true,
      paidInFullAt: nowIso,
      paidInFullAmount: amount,
      paidInFullBy: auth.user.email,
      stripePaymentIntentId: pi.json.id,
      fullInvoiceId: invoiceId,
      calendarBookingIds,
      calendarBookingId: calendarBookingIds[0] ?? null,
      updatedAt: nowIso,
    }
    const fw = await sb.from('function_bookings').upsert({ id, data: confirmed, updated_at: nowIso })
    if (fw.error) {
      console.error('FUNCTION PAY-IN-FULL BOOKING WRITE FAILED', { id, paymentIntent: pi.json.id, error: fw.error })
      return res.status(500).json({
        error: `The card was charged ${money(amount)} and the invoice raised, but the booking stage did not update. Quote ${pi.json.id} — do not charge again.`,
        paymentIntentId: pi.json.id,
      })
    }

    // ── 4. Confirmation + the building unlock request ───────────────────────
    // Awaited, not fire-and-forget: on Vercel an unawaited send dies when the
    // lambda freezes (see docs/build-notes.md).
    let emailed = false
    const to = company?.email || booking.email
    if (to) {
      const brand = settings.company?.name || 'Hexa Space'
      const from = `${settings.emails?.fromName || brand} <${settings.emails?.fromEmail || 'noreply@hexaspace.com.au'}>`
      const inner =
        bKicker('Booking Confirmed') +
        bH1('Your function is booked and paid') +
        bP(`Thanks ${booking.name?.split(' ')[0] || 'there'} — we've taken ${money(amount)} and the venue is yours. There's nothing left to pay before the day.`) +
        bTable([
          ['Event', booking.eventName || 'Function'],
          [sessions.length > 1 ? 'Sessions' : 'Date', sessionsLabel(booking)],
          ['Guests', booking.guests ? String(booking.guests) : '—'],
          ['Reference', booking.ref ?? '—'],
          ['Venue hire + GST', money(quote.total)],
          ['Security deposit (refundable)', money(quote.securityDeposit)],
          ['Paid in full', money(amount), true],
          ['Invoice', invoice.number],
        ]) +
        bP(`The ${money(quote.securityDeposit)} security deposit is refundable — we return it after the event once the space is checked over.`) +
        bSmall('Need to change something? Reply to this email and we\'ll sort it out.')
      const sent = await sendResendEmail({
        from, to: [to], replyTo: 'info@hexaspace.com.au',
        subject: `Confirmed — ${booking.eventName || 'your function'} on ${dmy(sessions[0].date)}`,
        html: brandFrame(inner, { company: brand, footerLabel: 'Function Space Hire' }),
      })
      emailed = !!sent.ok && !sent.skipped
    }

    // After-hours / weekend sessions need building management to unlock the door
    // and lift. Idempotent and a no-op in business hours, so fire on every confirm.
    try {
      await fetch(`https://${req.headers.host}/api/function-bookings/access-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization ?? '' },
        body: JSON.stringify({ id }),
      })
    } catch (e) { console.error('function access-request failed:', e) }

    return res.status(200).json({
      success: true,
      amount,
      paymentIntentId: pi.json.id,
      invoice: { id: invoiceId, number: invoice.number },
      voided: toVoid.map((r) => r.data?.number).filter(Boolean),
      booking: confirmed,
      emailed,
      message: `${money(amount)} taken and ${booking.eventName || 'the function'} confirmed — invoice ${invoice.number}.${emailed ? ' The client has been emailed.' : ' The client was NOT emailed — tell them by hand.'}`,
    })
  } catch (err) {
    console.error('function pay-and-confirm error:', err)
    return res.status(500).json({ error: err.message })
  }
}
