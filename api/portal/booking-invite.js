// POST /api/portal/booking-invite — emails meeting invitations to the
// attendees a member added on their room booking. Member-authed; the caller
// must belong to the booking's company. Body:
//   { bookingId, mode?: 'invite' | 'update' | 'cancelled', occurrences? }
// Attendee list is read from the booking row (booking.attendees) so the email
// always matches what was saved. Each attendee gets a branded email with the
// details and an .ics calendar attachment.
import { requireMember } from '../_auth.js'
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH1, bP, bSmall, SANS, INK } from '../_brand.js'
import { applyCors } from '../_cors.js'

export const config = { maxDuration: 60 }

const MAX_ATTENDEES = 15

const dmy = (d) => String(d || '').split('-').reverse().join('/')
const dayName = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long' })
const to12 = (t) => { let [h, m] = String(t || '0:0').split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap}` }
const icsStamp = (date, time) => `${String(date).replace(/-/g, '')}T${String(time).replace(':', '')}00`

function buildIcs(b, roomName) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hexa Space//Bookings//EN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@hexaspace.com.au`,
    `DTSTART:${icsStamp(b.date, b.startTime)}`,
    `DTEND:${icsStamp(b.date, b.endTime)}`,
    `SUMMARY:${(b.title || 'Meeting at Hexa Space').replace(/[,;]/g, ' ')}`,
    `LOCATION:${roomName} — Hexa Space, 402/830 Whitehorse Road Box Hill VIC 3128`.replace(/[,;]/g, ' '),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireMember(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb

  const { bookingId, mode = 'invite', occurrences = 1 } = req.body ?? {}
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' })

  try {
    const { data: rows } = await sb.from('bookings').select('data').eq('id', bookingId)
    const b = rows?.[0]?.data
    if (!b) return res.status(404).json({ error: 'Booking not found.' })
    // Only someone from the booking's company can invite people to it.
    if (auth.companyId && b.companyId && b.companyId !== auth.companyId) {
      return res.status(403).json({ error: 'Not your booking.' })
    }

    const attendees = [...new Set((b.attendees ?? []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, MAX_ATTENDEES)
    if (attendees.length === 0) return res.status(200).json({ sent: 0 })

    const { data: spRows } = await sb.from('spaces').select('data').eq('id', b.resourceId)
    const roomName = spRows?.[0]?.data?.unitNumber || b.resourceName || 'Meeting room'
    const { data: settRows } = await sb.from('settings').select('data').eq('id', 'global')
    const settings = settRows?.[0]?.data ?? {}
    const fromName = settings?.emails?.fromName || 'Hexa Space'
    const fromEmail = settings?.emails?.fromEmail || 'noreply@hexaspace.com.au'
    const host = b.memberName || b.companyName || auth.user.email

    const when = `${dayName(b.date)} ${dmy(b.date)} · ${to12(b.startTime)} – ${to12(b.endTime)}`
    const copy = {
      invite: { kicker: 'Meeting invitation', h1: "You're invited", lead: `${host} has invited you to a meeting at Hexa Space.` },
      update: { kicker: 'Meeting updated', h1: 'Meeting time changed', lead: `${host} has moved your meeting at Hexa Space — here are the new details.` },
      cancelled: { kicker: 'Meeting cancelled', h1: 'Meeting cancelled', lead: `${host} has cancelled the meeting below. Sorry for any inconvenience.` },
    }[mode] ?? {}

    const detail = (k, v) => `<tr><td style="padding:8px 0;font-family:${SANS};font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8a8a86;width:110px;border-top:1px solid rgba(0,0,0,.08)">${k}</td><td style="padding:8px 0;font-family:${SANS};font-size:14px;color:${INK};border-top:1px solid rgba(0,0,0,.08)">${v}</td></tr>`
    const inner =
      bKicker(copy.kicker) +
      bH1(copy.h1) +
      bP(copy.lead) +
      `<table style="width:100%;border-collapse:collapse;margin:4px 0 14px">${
        detail('What', b.title || 'Meeting') +
        detail('When', when + (occurrences > 1 ? ` (+${occurrences - 1} more session${occurrences > 2 ? 's' : ''})` : '')) +
        detail('Where', `${roomName} — Hexa Space, Level 4, 402/830 Whitehorse Rd, Box Hill`) +
        detail('Host', host)
      }</table>` +
      (mode !== 'cancelled' ? bP('Ask for your host at reception when you arrive.') : '') +
      bSmall('Sent on behalf of the host via the Hexa Space member portal.')
    const html = brandFrame(inner, { footerLabel: 'Meetings' })

    const attachments = mode !== 'cancelled'
      ? [{ filename: 'meeting.ics', content: Buffer.from(buildIcs(b, roomName)).toString('base64') }]
      : undefined

    let sent = 0
    for (const to of attendees) {
      const r = await sendResendEmail({
        from: `${fromName} <${fromEmail}>`,
        to,
        replyTo: auth.user.email,
        subject: mode === 'cancelled'
          ? `Cancelled: ${b.title || 'meeting'} — ${dmy(b.date)}`
          : `${mode === 'update' ? 'Updated: ' : ''}${host} invited you — ${b.title || 'meeting at Hexa Space'}, ${dmy(b.date)} ${to12(b.startTime)}`,
        html, attachments,
      })
      if (r.ok) sent++
      await new Promise((r2) => setTimeout(r2, 350)) // Resend rate limit
    }

    return res.status(200).json({ sent })
  } catch (err) {
    console.error('booking-invite error:', err)
    return res.status(500).json({ error: 'Could not send invitations.' })
  }
}
