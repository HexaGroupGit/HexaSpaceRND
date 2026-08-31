// POST /api/bookings/refund — cancel a paid room booking and send the money back.
//
// Body: { bookingId, preview?, amount?, reason?, override?, notify? }
//
// WHY this is one endpoint and not a queue: a room refund is small, decided the
// moment someone cancels, and governed by a rule the booking itself answers
// (refundableOnCancel — has the window started, was the door opened). Splitting
// it into "cancel now, refund later from Billing" is how the money gets
// forgotten — which is exactly what happened to the two website bookings this
// was written for. Bond refunds keep their approval queue because they are
// large, discretionary and owed after a lease ends; this is neither.
//
// Four things happen, ordered so a failure part-way is always recoverable:
//   1. Stripe refund on the original PaymentIntent. FIRST — if it fails, the
//      booking is still live and nothing needs unwinding.
//   2. Booking → Cancelled. Frees the room (and, for North/South/West, the rest
//      of the Function Space block), and the Salto reconciler strips any room
//      access grant off the back of the Cancelled status.
//   3. A credit note against the booking's invoice, creditNoteForId → original,
//      so api/xero/sync.js raises an ACCRECCREDIT and the income reverses. The
//      original stays 'paid': it WAS paid, and the money went back separately.
//   4. The client is emailed.
//
// `preview: true` runs every check and returns what WOULD happen — the amount,
// the card, whether policy allows it — without touching Stripe. The UI calls
// this to decide whether to offer a refund at all.
import { stripeConfigured, stripeFetch } from '../_stripe.js'
import { applyCors } from '../_cors.js'
import { requireAdmin } from '../_auth.js'
import { selectAllRows } from '../_db.js'
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH1, bP, bTable, bSmall } from '../_brand.js'
import { bookingWasUsed, doorWasOpened, bookingHasStarted } from '../../src/lib/dropIn.js'

const money = (v) => `$${Number(v || 0).toFixed(2)}`
const dmy = (d) => String(d || '').split('-').reverse().join('/')
const to12 = (t) => { let [h, m] = String(t || '0:0').split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap}` }
const round2 = (v) => Math.round(Number(v || 0) * 100) / 100

const lineTotal = (li) => Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100)
const invoiceSubtotal = (inv) => (inv?.lineItems ?? []).reduce((s, li) => s + lineTotal(li), 0)
const invoiceGross = (inv) => round2(invoiceSubtotal(inv) * (inv?.vatEnabled !== false ? 1.1 : 1))

/**
 * The Stripe PaymentIntent that paid for this booking. Three shapes exist in the
 * wild and all three are real data: the app's drop-in charge writes
 * paymentIntentId, the website's Checkout flow writes stripePaymentIntentId, and
 * anything invoiced carries it only on the invoice's payment line.
 */
export function bookingPaymentIntent(booking, invoice) {
  const direct = booking?.stripePaymentIntentId || booking?.paymentIntentId
  if (direct) return String(direct)
  for (const p of invoice?.payments ?? []) {
    const ref = String(p.reference ?? '')
    if (ref.startsWith('pi_')) return ref
  }
  return null
}

/** What the client actually paid for this booking, GST inclusive. */
export function bookingPaidAmount(booking, invoice) {
  const direct = Number(booking?.paidAmount ?? booking?.amountPaid ?? 0)
  if (direct > 0) return round2(direct)
  const paid = (invoice?.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  if (paid > 0) return round2(paid)
  return invoice ? invoiceGross(invoice) : 0
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb

  const { bookingId, preview = false, amount: amountIn, reason = '', override = false, notify = true } = req.body ?? {}
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' })

  try {
    const { data: bRows } = await sb.from('bookings').select('data').eq('id', bookingId)
    const booking = bRows?.[0]?.data
    if (!booking) return res.status(404).json({ error: 'Booking not found.' })
    if (booking.refundedAt || booking.stripeRefundId) {
      return res.status(400).json({ error: `This booking was already refunded on ${dmy(String(booking.refundedAt).split('T')[0])}.` })
    }

    const [{ data: iRows }, { data: spRows }, { data: tRows }, { data: sRow }] = await Promise.all([
      booking.invoiceId ? sb.from('invoices').select('data').eq('id', booking.invoiceId) : Promise.resolve({ data: [] }),
      sb.from('spaces').select('data').eq('id', booking.resourceId),
      booking.companyId ? sb.from('tenants').select('data').eq('id', booking.companyId) : Promise.resolve({ data: [] }),
      sb.from('settings').select('data').eq('id', 'global').single(),
    ])
    const invoice = iRows?.[0]?.data ?? null
    const room = spRows?.[0]?.data?.unitNumber || booking.resourceName || 'Meeting room'
    const tenant = tRows?.[0]?.data ?? null
    const settings = sRow?.data ?? {}

    const pi = bookingPaymentIntent(booking, invoice)
    const paid = bookingPaidAmount(booking, invoice)
    const amount = amountIn == null ? paid : round2(amountIn)

    // Every reason this might not be refundable, gathered rather than thrown, so
    // preview can show the UI the whole picture in one call.
    const blockers = []
    if (!pi) blockers.push(booking.paidBy === 'credits'
      ? 'This booking was paid with credits, not a card — cancelling returns the credits to the pool instead.'
      : 'No card payment is recorded against this booking, so there is nothing to refund.')
    if (paid <= 0) blockers.push('No amount was paid for this booking.')
    if (amount > paid) blockers.push(`You cannot refund ${money(amount)} — only ${money(paid)} was paid.`)
    if (amount <= 0) blockers.push('The refund amount must be more than zero.')

    // Policy: a booking that was used is charged whether or not it is later
    // cancelled. Staff can still refund it as a goodwill call, but they have to
    // say so — hence override, which is recorded on the booking.
    const used = bookingWasUsed(booking)
    const usedWhy = doorWasOpened(booking) ? 'the door was opened for it'
      : bookingHasStarted(booking) ? 'its booked window has already started' : ''

    if (preview) {
      let card = null
      if (pi && stripeConfigured()) {
        const st = await stripeFetch(`/payment_intents/${pi}?expand[]=latest_charge`)
        const ch = st.json?.latest_charge
        if (st.ok && ch?.payment_method_details?.card) {
          card = `${ch.payment_method_details.card.brand} ····${ch.payment_method_details.card.last4}`
        }
        if (ch?.refunded || Number(ch?.amount_refunded) > 0) {
          blockers.push(`Stripe shows ${money((ch.amount_refunded ?? 0) / 100)} already refunded on this payment.`)
        }
      }
      return res.status(200).json({
        refundable: blockers.length === 0,
        blockers,
        needsOverride: used,
        usedReason: usedWhy,
        amount: blockers.length ? 0 : amount,
        paid, card, paymentIntentId: pi,
        invoiceNumber: invoice?.number ?? null,
        clientEmail: tenant?.email || booking.memberEmail || null,
      })
    }

    if (blockers.length) return res.status(400).json({ error: blockers[0], blockers })
    if (used && !override) {
      return res.status(400).json({
        error: `This booking has been used — ${usedWhy}. It is charged whether or not it is now cancelled. Refund it anyway only as a goodwill call.`,
        needsOverride: true,
      })
    }
    if (!stripeConfigured()) return res.status(500).json({ error: 'Stripe is not configured.' })

    // ── 1. Money first ──────────────────────────────────────────────────────
    const r = await stripeFetch('/refunds', {
      payment_intent: pi,
      amount: Math.round(amount * 100),
      reason: 'requested_by_customer',
      metadata: {
        kind: 'room_booking_refund',
        bookingRef: booking.reference ?? booking.id,
        invoice: invoice?.number ?? '',
        room,
        refundedBy: auth.user?.email ?? '',
      },
    })
    if (!r.ok || !['succeeded', 'pending'].includes(r.json?.status)) {
      return res.status(402).json({
        error: r.json?.error?.message || `Stripe could not refund this payment (${r.json?.status ?? 'failed'}). The booking has NOT been cancelled.`,
      })
    }
    const refundId = r.json.id
    const nowIso = new Date().toISOString()
    const today = nowIso.split('T')[0]
    const partial = amount < paid

    // ── 2. Booking cancelled ────────────────────────────────────────────────
    // creditsUsed/feeAmount zeroed to match the Calendar's own cancel path: a
    // refunded booking must not also leave a month-end Booking Fee behind.
    const cancelled = {
      ...booking,
      status: 'Cancelled',
      cancelledAt: nowIso,
      cancelledBy: 'Admin',
      cancelReason: reason || 'Cancelled and refunded by Hexa Space',
      refundedAt: nowIso,
      refundAmount: amount,
      refundMethod: 'Stripe (card)',
      stripeRefundId: refundId,
      refundedBy: auth.user?.email ?? '',
      ...(override && used ? { refundOverride: true, refundOverrideReason: usedWhy } : {}),
      paidBy: partial ? booking.paidBy : 'refunded',
      creditsUsed: 0,
      feeAmount: 0,
      feeId: null,
    }
    const bw = await sb.from('bookings').update({ data: cancelled, updated_at: nowIso }).eq('id', bookingId)
    if (bw.error) {
      // Money is out but the room is still held — say so loudly with the refund
      // id rather than reporting a clean success.
      console.error('BOOKING REFUNDED BUT NOT CANCELLED', { bookingId, refundId, error: bw.error })
      return res.status(500).json({
        error: `${money(amount)} was refunded (${refundId}) but the booking could not be cancelled. Cancel it by hand — do not refund again.`,
        refundId,
      })
    }

    // ── 3. Credit note, so Xero reverses the income ─────────────────────────
    let creditNote = null
    if (invoice) {
      // Invoice numbers live in JSONB with no uniqueness constraint, so
      // allocation is read-max-plus-one — same as api/auto-billing.js.
      const rows = await selectAllRows(sb, 'invoices', 'data->>number')
      const highest = rows
        .map((x) => parseInt(String(x.number ?? '').replace(/\D/g, ''), 10))
        .filter((n) => !isNaN(n) && n > 0)
        .reduce((max, n) => Math.max(max, n), 0)
      const template = settings.invoicing?.invoiceNumberTemplate ?? 'INV-{{number}}'
      const number = template.replace('{{number}}', String(highest + 1).padStart(4, '0'))

      // The credit is raised ex-GST because the Xero push sends Exclusive lines
      // and adds OUTPUT tax itself; refunding a GST-inclusive figure as if it
      // were ex would over-credit by the GST.
      const taxable = invoice.vatEnabled !== false
      const exGst = round2(taxable ? amount / 1.1 : amount)
      const id = `inv${Date.now()}${Math.random().toString(36).slice(2, 6)}`
      creditNote = {
        id,
        number,
        tenantId: invoice.tenantId ?? booking.companyId ?? null,
        leaseId: invoice.leaseId ?? null,
        source: 'booking-refund',
        invoiceType: 'creditNote',
        // 'paid', never 'pending': api/overdue-reminders.js has no negative-total
        // guard, so a pending credit note flips to overdue and chases the client.
        status: 'paid',
        sentStatus: 'not_sent',
        issueDate: today,
        dueDate: today,
        periodStart: invoice.periodStart ?? null,
        periodEnd: invoice.periodEnd ?? null,
        reference: `Credit note for ${invoice.number} — booking ${booking.reference ?? ''} cancelled${partial ? ' (part refund)' : ''}`.trim(),
        companyName: invoice.companyName ?? tenant?.businessName ?? '',
        contactName: invoice.contactName ?? tenant?.contactName ?? '',
        clientEmail: invoice.clientEmail ?? tenant?.email ?? '',
        currency: 'AUD',
        vatEnabled: taxable,
        discountPct: 0,
        isProrated: false,
        paymentMethod: '',
        xeroSync: false,
        creditNoteForId: invoice.id,
        bookingId,
        refundedAt: nowIso,
        refundMethod: 'Stripe (card)',
        refundReference: refundId,
        stripeRefundId: refundId,
        lineItems: [{
          id: `li_${id}_0`,
          description: `Credit — ${room} ${dmy(booking.date)} ${to12(booking.startTime)}–${to12(booking.endTime)} cancelled${partial ? ' (part refund)' : ''} (reverses ${invoice.number})`,
          revenueAccount: (invoice.lineItems ?? [])[0]?.revenueAccount ?? 'Additional Services',
          unitPrice: -exGst,
          qty: 1,
          discountPct: 0,
        }],
        payments: [{
          id: `ref_${refundId.slice(-10)}`,
          date: today,
          amount: -amount,
          method: 'Stripe refund',
          reference: refundId,
        }],
        comments: [{
          id: `cmt${Date.now()}`,
          text: `${dmy(today)} — booking ${booking.reference ?? ''} cancelled, ${money(amount)} refunded to the card (${refundId}) by ${auth.user?.email ?? 'an admin'}.${reason ? ` Reason: ${reason}` : ''}`,
          createdAt: today,
        }],
      }
      const cw = await sb.from('invoices').insert({ id, data: creditNote })
      if (cw.error) {
        console.error('BOOKING REFUND CREDIT NOTE FAILED', { bookingId, refundId, error: cw.error })
        creditNote = null
      } else {
        // Trail on the original. Status and payments left alone on purpose: the
        // payment was genuinely received, and a negative payment here would show
        // it unpaid and hand it to the overdue chaser.
        const original = {
          ...invoice,
          refundedAt: nowIso,
          refundedByCreditNoteId: id,
          comments: [...(invoice.comments ?? []), {
            id: `cmt${Date.now() + 1}`,
            text: `${dmy(today)} — booking ${booking.reference ?? ''} cancelled and ${money(amount)} refunded to the card via Stripe (${refundId}), reversed by credit note ${number}. This invoice stays 'paid': the payment was received and the money went back out separately.`,
            createdAt: today,
          }],
        }
        await sb.from('invoices').update({ data: original, updated_at: nowIso }).eq('id', invoice.id)
      }
    }

    // ── 4. Tell the client ──────────────────────────────────────────────────
    // Awaited, not fire-and-forget: on Vercel an unawaited send dies when the
    // lambda freezes (see docs/build-notes.md).
    let emailed = false
    const to = tenant?.email || booking.memberEmail || creditNote?.clientEmail
    if (notify && to) {
      const brand = settings.company?.name || 'Hexa Space'
      const from = `${settings.emails?.fromName || brand} <${settings.emails?.fromEmail || 'noreply@hexaspace.com.au'}>`
      const inner =
        bKicker('Booking Cancelled') +
        bH1('Your booking is cancelled and refunded') +
        bP(`Hi ${booking.memberName?.split(' ')[0] || 'there'}, we've cancelled your booking and sent ${money(amount)} back to the card you paid with. Card refunds usually land within 5–10 business days, depending on your bank.`) +
        bTable([
          ['Room', room],
          ['Date', dmy(booking.date)],
          ['Time', `${to12(booking.startTime)} – ${to12(booking.endTime)}`],
          ['Reference', booking.reference ?? '—'],
          ['Refunded', money(amount), true],
          ...(invoice ? [['Invoice', invoice.number]] : []),
        ]) +
        bP('Nothing further is needed from you. We hope to see you again soon — just book another room whenever you need one.') +
        bSmall(`Refund reference ${refundId}`)
      const sent = await sendResendEmail({
        from,
        to: [to],
        replyTo: 'info@hexaspace.com.au',
        subject: `Refunded ${money(amount)} — ${room} booking on ${dmy(booking.date)} cancelled`,
        html: brandFrame(inner, { company: brand, footerLabel: 'Booking Refund' }),
      })
      emailed = !!sent.ok && !sent.skipped
    }

    return res.status(200).json({
      success: true,
      amount,
      partial,
      refundId,
      status: r.json.status,
      booking: cancelled,
      creditNote,
      emailed,
      message: `${money(amount)} refunded to the card${creditNote ? ` and credited by ${creditNote.number}` : ''}. ${emailed ? 'The client has been emailed.' : 'The client was NOT emailed — tell them by hand.'}`,
    })
  } catch (err) {
    console.error('bookings/refund error:', err)
    return res.status(500).json({ error: err.message })
  }
}
