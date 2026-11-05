// POST /api/studio/cancel — cancel a podcast studio session, free of charge.
//
// Body: { bookingId, reason? }
//
// Who: the member's own company (portal + app), or an admin (Studio Requests,
// Bookings). Website requesters have no account — they reply to their email and
// an admin cancels for them.
//
// Rules:
//   · Only request-gated spaces (the podcast studio). Meeting rooms keep their
//     own cancel path, which returns credits.
//   · Members may cancel a Pending request or a Confirmed session up until it
//     starts. Once it has started (or the door has been opened) it is the
//     studio team's call, so members are refused. Admins may cancel any time —
//     an operator off sick at 9:05 is still no charge to the client.
//   · No charge: any unbilled Booking Fee for the session is waived. One that
//     has already gone out on an invoice is reported back for a credit note
//     rather than silently pulled (see api/_studioCancel.js).
//
// Order: booking first (frees the slot, and the Salto sweep withdraws door
// access off the back of the Cancelled status), then fees, then email. A fee
// failure after the booking is cancelled is reported, not hidden.
import { serviceClient, verifiedUser, isAdminEmail, companyForEmail } from '../_auth.js'
import { applyCors } from '../_cors.js'
import { isRequestGated } from '../../src/lib/studio.js'
import {
  studioSessionStarted, waiveStudioFees, cancelledStudioRow, sendStudioCancelEmails, emptyFeeOutcome,
} from '../_studioCancel.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sb = serviceClient()
  const user = await verifiedUser(req, sb)
  if (!user) return res.status(401).json({ error: 'Sign in required.' })
  const admin = await isAdminEmail(sb, user.email)

  const { bookingId } = req.body ?? {}
  const reason = String(req.body?.reason ?? '').trim().slice(0, 1000)
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' })

  try {
    const { data: rows, error: readErr } = await sb.from('bookings').select('data').eq('id', bookingId)
    if (readErr) throw new Error(readErr.message)
    const b = rows?.[0]?.data
    if (!b) return res.status(404).json({ error: 'Booking not found.' })

    // Fail CLOSED for members: an account we can't tie to the booking's company
    // has no business cancelling it.
    if (!admin) {
      const companyId = await companyForEmail(sb, user.email)
      if (!companyId || !b.companyId || b.companyId !== companyId) {
        return res.status(403).json({ error: 'Not your booking.' })
      }
    }

    const { data: spRows } = await sb.from('spaces').select('data').eq('id', b.resourceId)
    const space = spRows?.[0]?.data
    if (!isRequestGated(space)) {
      return res.status(400).json({ error: 'This endpoint only cancels podcast studio sessions.' })
    }
    if (b.status === 'Cancelled') {
      return res.status(409).json({ error: 'This session is already cancelled.', booking: b })
    }
    if (!admin && studioSessionStarted(b)) {
      return res.status(409).json({
        error: 'This session has already started, so it can no longer be cancelled here. Please speak to the studio team.',
      })
    }

    const nowIso = new Date().toISOString()
    const by = admin ? 'admin' : 'member'
    const wasConfirmed = b.status === 'Confirmed'

    // 1. Booking → Cancelled. Written before the fees so a failure part-way
    //    leaves the slot freed and the fee visible, never the reverse.
    const first = cancelledStudioRow(b, { nowIso, by, email: user.email, reason, fees: null })
    const bw = await sb.from('bookings').update({ data: first, updated_at: nowIso }).eq('id', bookingId)
    if (bw.error) throw new Error(bw.error.message)

    // 2. Waive the fee(s).
    let fees = emptyFeeOutcome()
    let feeError = null
    try {
      fees = await waiveStudioFees(sb, b, {
        nowIso, admin, space,
        actor: admin ? `Admin (${user.email})` : `Member (${user.email})`,
      })
    } catch (e) {
      feeError = e.message
      fees.failed.push({ id: b.feeId ?? null, price: 0, error: e.message })
    }

    // Record what happened to the money on the booking itself.
    const booking = cancelledStudioRow(b, { nowIso, by, email: user.email, reason, fees })
    await sb.from('bookings').update({ data: booking, updated_at: nowIso }).eq('id', bookingId)

    // 3. Email. Awaited — an unawaited send dies when the lambda freezes.
    const mail = await sendStudioCancelEmails(sb, booking, { by, reason, wasConfirmed, fees, actorEmail: user.email })

    return res.status(200).json({
      success: true,
      booking,
      waived: fees.waived.map(({ id, price, data }) => ({ id, price, data })),
      billed: fees.billed,
      kept: fees.kept,
      unverified: fees.unverified,
      failed: fees.failed,
      feeError,
      ...mail,
    })
  } catch (err) {
    console.error('studio/cancel error:', err)
    return res.status(500).json({ error: 'Could not cancel the session — please try again, or email info@hexaspace.com.au.' })
  }
}
