// POST /api/function-bookings/access-request  { id, force? }
// After a function's deposit is paid and the venue is secured, sessions that
// fall AFTER HOURS (outside Mon–Fri 9am–5pm, or any weekend session) need the
// building manager to unlock the front door and lift — only building
// management can program the lift. This emails the unlock request to Maxa OC
// + Pro Facility Management (Hexa team cc'd) covering each session's window
// WITH the 30-minute buffer each side, and stamps the booking so repeat
// confirms don't double-send (force=true re-sends, e.g. after a time change).
import { createClient } from '@supabase/supabase-js'
import { bookingSessions, bufferedWindow, isWeekendDate } from '../../src/lib/functionBooking.js'
import { sendResendEmail } from '../_email.js'
import { applyCors } from '../_cors.js'

const SUPABASE_URL = process.env.SUPABASE_URL

const TO = ['info@maxaoc.com.au', 'pbh@profacilitymanagement.com.au']
const CC = ['eric@hexaspace.com.au', 'info@hexaspace.com.au', 'scarlett@hexaspace.com.au', 'brittany@hexaspace.com.au']
const OPEN = '09:00', CLOSE = '17:00' // building's staffed hours, Mon–Fri

const dmy = (d) => { const [y, m, day] = String(d).split('-'); return `${day}/${m}/${y}` }
const dayName = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long' })
const to12 = (t) => { let [h, m] = String(t).split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap}` }

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })

  const { id, force } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'Missing id' })

  try {
    const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })
    const { data: rows } = await supabase.from('function_bookings').select('data').eq('id', id)
    const b = rows?.[0]?.data
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    if (!(b.stage === 'confirmed' || b.depositPaid)) {
      return res.status(400).json({ error: 'Deposit not confirmed yet — access is requested once the venue is secured.' })
    }
    if (b.accessRequestSentAt && !force) {
      return res.status(200).json({ success: true, already: true, sentAt: b.accessRequestSentAt })
    }

    // Sessions needing an unlock: weekend, or the ±30-min buffered window
    // starts before opening / ends after close.
    const windows = bookingSessions(b).map((s) => {
      const { blockStart, blockEnd } = bufferedWindow(s.startTime, s.endTime)
      const afterHours = isWeekendDate(s.date) || blockStart < OPEN || blockEnd > CLOSE
      return { ...s, blockStart, blockEnd, afterHours }
    }).filter((w) => w.afterHours)

    if (windows.length === 0) {
      return res.status(200).json({ success: true, needed: false, note: 'All sessions fall within staffed hours — no unlock request required.' })
    }

    const rowsHtml = windows.map((w) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd">${dayName(w.date)} ${dmy(w.date)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd"><strong>${to12(w.blockStart)} – ${to12(w.blockEnd)}</strong></td>
        <td style="padding:8px 12px;border:1px solid #ddd">${to12(w.startTime)} – ${to12(w.endTime)} function · 30-min buffer each side</td>
      </tr>`).join('')

    const html = `
      <p>Hi team,</p>
      <p>We have a confirmed function booking at <strong>Hexa Space — U 402/828 Whitehorse Road, Box Hill (Level 4)</strong> that
      runs outside staffed hours. Could you please <strong>unlock the front door and enable lift access to Level 4</strong> for the
      following window${windows.length > 1 ? 's' : ''}:</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr>
          <th style="padding:8px 12px;border:1px solid #ddd;text-align:left">Date</th>
          <th style="padding:8px 12px;border:1px solid #ddd;text-align:left">Unlock window</th>
          <th style="padding:8px 12px;border:1px solid #ddd;text-align:left">Event time</th>
        </tr>
        ${rowsHtml}
      </table>
      <p style="margin-top:14px">
        Event: <strong>${b.eventName || 'Private function'}</strong> · ref ${b.ref}${b.guests ? ` · ~${b.guests} guests` : ''}<br/>
        Hexa Space contact: info@hexaspace.com.au
      </p>
      <p>Please confirm once scheduled — happy to provide anything further you need.</p>
      <p>Kind regards,<br/>Hexa Space Pty Ltd<br/>402/830 Whitehorse Road, Box Hill VIC 3128</p>`

    const first = windows[0]
    const r = await sendResendEmail({
      from: 'Hexa Space <info@hexaspace.com.au>',
      to: TO, cc: CC,
      replyTo: 'info@hexaspace.com.au',
      subject: `After-hours access request — front door & lift, ${dayName(first.date)} ${dmy(first.date)} ${to12(first.blockStart)}–${to12(first.blockEnd)}${windows.length > 1 ? ` (+${windows.length - 1} more)` : ''}`,
      html,
    })
    if (!r.ok) return res.status(502).json({ error: 'Email send failed.' })

    const updated = {
      ...b,
      accessRequestSentAt: new Date().toISOString(),
      accessRequestWindows: windows.map((w) => ({ date: w.date, from: w.blockStart, to: w.blockEnd })),
    }
    await supabase.from('function_bookings').upsert({ id: b.id, data: updated, updated_at: updated.accessRequestSentAt })

    return res.status(200).json({ success: true, needed: true, windows: updated.accessRequestWindows })
  } catch (err) {
    console.error('access-request error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
