// POST /api/portal/notify-booking — ops notification to info@hexaspace.com.au
// whenever a MEMBER creates, amends or cancels a meeting-room booking from the
// portal or the app (admin-made bookings don't notify — the admin already knows).
// Member-authed; the booking must belong to the caller's company. Body:
//   { bookingId, kind?: 'new' | 'amended' | 'cancelled', occurrences? }
import { requireMember } from '../_auth.js'
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH1, bP, bTable, bSmall } from '../_brand.js'
import { applyCors } from '../_cors.js'

const OPS_EMAIL = 'info@hexaspace.com.au'

const dmy = (d) => String(d || '').split('-').reverse().join('/')
const to12 = (t) => { let [h, m] = String(t || '0:0').split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap}` }

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireMember(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb

  const { bookingId, kind = 'new', occurrences = 1 } = req.body ?? {}
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' })

  try {
    const { data: rows } = await sb.from('bookings').select('data').eq('id', bookingId)
    const b = rows?.[0]?.data
    if (!b) return res.status(404).json({ error: 'Booking not found.' })
    if (auth.companyId && b.companyId && b.companyId !== auth.companyId) {
      return res.status(403).json({ error: 'Not your booking.' })
    }

    const [{ data: spRows }, { data: tRows }] = await Promise.all([
      sb.from('spaces').select('data').eq('id', b.resourceId),
      b.companyId ? sb.from('tenants').select('data').eq('id', b.companyId) : Promise.resolve({ data: [] }),
    ])
    const room = spRows?.[0]?.data?.unitNumber || b.resourceName || 'Meeting room'
    const company = tRows?.[0]?.data?.businessName || b.companyName || '—'

    const copy = {
      new: { kicker: 'New Booking', h1: 'Meeting room booked 📅', lead: 'A member just booked a meeting room from the portal/app.' },
      amended: { kicker: 'Booking Changed', h1: 'Booking amended ✏️', lead: 'A member changed their booking — it is back to Pending for re-confirmation.' },
      cancelled: { kicker: 'Booking Cancelled', h1: 'Booking cancelled ✖️', lead: 'A member cancelled their booking; their credits were returned.' },
    }[kind] ?? {}

    const inner =
      bKicker(copy.kicker ?? 'Booking') +
      bH1(copy.h1 ?? 'Booking update') +
      bP(copy.lead ?? '') +
      bTable([
        ['Room', room, true],
        ['When', `${dmy(b.date)} · ${to12(b.startTime)} – ${to12(b.endTime)}${occurrences > 1 ? ` (+${occurrences - 1} more session${occurrences > 2 ? 's' : ''})` : ''}`, true],
        ['Company', company, true],
        ['Booked by', b.memberName || auth.user.email, true],
        ['Title', b.title || '—', true],
        ['Status', b.status || '—', true],
        ['Credits used', String(b.creditsUsed ?? 0), true],
      ]) +
      bSmall('Automated notification from the member portal — review it on the admin calendar.')

    const r = await sendResendEmail({
      from: 'Hexa Space <noreply@hexaspace.com.au>',
      to: OPS_EMAIL,
      replyTo: auth.user.email,
      subject: `${kind === 'new' ? 'New booking' : kind === 'amended' ? 'Booking amended' : 'Booking cancelled'}: ${room} — ${dmy(b.date)} ${to12(b.startTime)} (${company})`,
      html: brandFrame(inner, { footerLabel: 'Bookings' }),
    })
    return res.status(200).json({ sent: !!r?.ok })
  } catch (err) {
    console.error('notify-booking error:', err)
    return res.status(500).json({ error: 'Could not send the notification.' })
  }
}
