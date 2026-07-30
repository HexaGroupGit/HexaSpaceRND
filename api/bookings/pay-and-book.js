// POST /api/bookings/pay-and-book — a drop-in pays for a room, then gets it.
//
// Body: { resourceId, date, startTime, endTime, title? }
//
// Charge FIRST, write the booking second, both server-side, so a drop-in can
// never end up with a room they haven't paid for (and never be charged for a
// slot that was taken while they were paying). A month-end Booking Fee is no use
// for someone who gets no month-end bill — see src/lib/dropIn.js.
import { stripeConfigured, stripeFetch } from '../_stripe.js'
import { applyCors } from '../_cors.js'
import { requireMember } from '../_auth.js'
import { ensureClientForMember } from '../_dropin.js'
import { priceBooking, requiresUpfrontPayment } from '../../src/lib/dropIn.js'
import { blockingResourceIds } from '../../src/lib/roomConflicts.js'
import { companyPerk, isPerkRoom } from '../../src/lib/credits.js'

const toDec = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h + (m || 0) / 60 }
const overlaps = (aS, aE, bS, bE) => toDec(aS) < toDec(bE) && toDec(bS) < toDec(aE)

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!stripeConfigured()) return res.status(500).json({ error: 'Card payments are not available right now.' })

  const auth = await requireMember(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb

  const { resourceId, date, startTime, endTime, title } = req.body ?? {}
  if (!resourceId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'resourceId, date, startTime and endTime are required.' })
  }
  const hours = Math.max(0, toDec(endTime) - toDec(startTime))
  if (hours <= 0) return res.status(400).json({ error: 'The end time must be after the start time.' })

  try {
    const [{ data: spaceRows }, { data: leaseRows }, { data: memberRows }, { data: settingsRow }] = await Promise.all([
      sb.from('spaces').select('id, data'),
      sb.from('leases').select('id, data'),
      sb.from('members').select('id, data').ilike('data->>email', auth.user.email).limit(1),
      sb.from('settings').select('data').eq('id', 'global').single(),
    ])
    const spaces = (spaceRows ?? []).map((r) => ({ ...r.data, id: r.id }))
    const leases = (leaseRows ?? []).map((r) => ({ ...r.data, id: r.id }))
    const settings = settingsRow?.data ?? {}
    const member = memberRows?.[0] ? { ...memberRows[0].data, id: memberRows[0].id } : null

    const room = spaces.find((s) => s.id === resourceId)
    if (!room) return res.status(404).json({ error: 'That room no longer exists.' })

    // A drop-in with no client record gets one, so the card has a home.
    const { companyId } = await ensureClientForMember(sb, auth.user, auth.companyId)
    const { data: tRow } = await sb.from('tenants').select('data').eq('id', companyId).single()
    const company = tRow?.data ? { ...tRow.data, id: companyId } : null
    if (!company) return res.status(404).json({ error: 'Account not found.' })

    // Price it exactly as the app quoted: list rate for a drop-in, credits first.
    const perk = companyPerk(companyId, leases, spaces, settings)
    const isPerk = isPerkRoom(room, perk)
    const quote = priceBooking({ room, hours, company, leases, isPerk })
    if (!requiresUpfrontPayment({ company, leases, isPerk, payNow: quote.payNow })) {
      return res.status(400).json({ error: 'This booking does not need paying up front — book it the normal way.' })
    }

    if (!company.stripeCustomerId || !company.stripePaymentMethodId) {
      return res.status(402).json({ error: 'Add a card first, then confirm your booking.', code: 'card_required' })
    }

    // Slot re-check against server truth, immediately before charging — never
    // take money for a room someone else just booked.
    const blockIds = [...new Set(blockingResourceIds(resourceId, spaces))]
    const { data: liveRows, error: availErr } = await sb
      .from('booking_availability')
      .select('id, resource_id, date, start_time, end_time, status')
      .in('resource_id', blockIds)
      .eq('date', date)
    if (availErr) return res.status(503).json({ error: 'We couldn’t confirm the room is still free — please try again.' })
    const taken = (liveRows ?? []).some((b) => b.status !== 'Cancelled' && overlaps(startTime, endTime, b.start_time, b.end_time))
    if (taken) return res.status(409).json({ error: 'That time was just taken — please choose another slot.' })

    // GST-inclusive: the drop-in is paying a consumer price, not being invoiced.
    const amountIncGst = Math.round(quote.payNow * 1.1 * 100) / 100
    const pi = await stripeFetch('/payment_intents', {
      amount: Math.round(amountIncGst * 100),
      currency: 'aud',
      customer: company.stripeCustomerId,
      payment_method: company.stripePaymentMethodId,
      off_session: 'true',
      confirm: 'true',
      description: `${room.unitNumber} · ${date} ${startTime}–${endTime} · ${company.businessName ?? ''}`.trim(),
      metadata: { kind: 'drop_in_booking', resourceId, date, startTime, endTime, companyId, memberId: member?.id ?? '' },
    })
    if (!pi.ok || pi.json.status !== 'succeeded') {
      return res.status(402).json({
        error: pi.json.error?.message || `The payment was ${pi.json.status || 'declined'}. Please try another card.`,
        code: pi.json.error?.code || 'payment_failed',
      })
    }

    // Paid — now the booking exists.
    const nowIso = new Date().toISOString()
    const booking = {
      id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      reference: `BKG-${Math.floor(100000 + Math.random() * 900000)}`,
      resourceId, date, startTime, endTime, title: title || '',
      memberId: member?.id ?? '', companyId,
      memberName: member?.name ?? '', companyName: company.businessName ?? '',
      status: 'Confirmed', source: 'App', createdBy: 'Member', repeat: 'none',
      createdAt: nowIso.split('T')[0],
      creditsUsed: quote.creditsUsed,
      paidBy: quote.creditsUsed > 0 ? 'part_credits_card' : 'card',
      dropIn: true,
      amountPaid: amountIncGst,
      paymentIntentId: pi.json.id,
      paidAt: nowIso,
    }
    const writes = [sb.from('bookings').upsert({ id: booking.id, data: booking, updated_at: nowIso })]
    if (quote.creditsUsed > 0) {
      const newBal = Math.round((quote.balance - quote.creditsUsed) * 100) / 100
      writes.push(sb.from('tenants').update({
        data: { ...company, creditsRemaining: newBal },
        updated_at: nowIso,
      }).eq('id', companyId))
    }
    const results = await Promise.all(writes)
    const dbErr = results.find((r) => r.error)?.error
    if (dbErr) {
      // Money took, booking didn't. Surface it loudly with the PaymentIntent so
      // it can be refunded or the booking entered by hand — never swallow this.
      console.error('DROP-IN BOOKING WRITE FAILED AFTER CHARGE', { paymentIntent: pi.json.id, error: dbErr })
      return res.status(500).json({
        error: 'Your card was charged but the booking could not be saved. Please contact reception quoting ' + pi.json.id,
        paymentIntentId: pi.json.id,
      })
    }

    // Best-effort, awaited: ops notification + door access for the new booking.
    try {
      const base = `https://${req.headers.host}`
      await fetch(`${base}/api/portal/notify-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization ?? '' },
        body: JSON.stringify({ bookingId: booking.id, kind: 'new' }),
      })
    } catch (e) { console.error('drop-in booking notify failed:', e) }

    return res.status(200).json({ success: true, booking, amountPaid: amountIncGst, paymentIntentId: pi.json.id })
  } catch (err) {
    console.error('pay-and-book error:', err)
    return res.status(500).json({ error: err.message })
  }
}
