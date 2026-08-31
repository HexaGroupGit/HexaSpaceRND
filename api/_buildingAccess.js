// Building-unlock (front door + lift) requests to building management.
//
// Only building management can program lift access to Level 4, so anything
// running outside the building's staffed hours — any weekend, or a window that
// starts before open / ends after close — needs an email asking them to unlock.
//
// Shared by function bookings (api/function-bookings/_accessRequest.js, which
// adds the scheduled "3 business days before" release) and room bookings
// (api/bookings/access-request.js, which is a manual admin button). Both send
// the SAME email to the same people, so the building manager sees one
// consistent request whichever side it came from — keeping two copies of this
// markup is how they would drift apart.
import { sendResendEmail } from './_email.js'

export const TO = ['info@maxaoc.com.au', 'pbh@profacilitymanagement.com.au']
export const CC = ['eric@hexaspace.com.au', 'info@hexaspace.com.au', 'scarlett@hexaspace.com.au', 'brittany@hexaspace.com.au']
export const OPEN = '09:00', CLOSE = '17:00' // building's staffed hours, Mon–Fri
const TZ = 'Australia/Melbourne'

export const melbourneToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export const dmy = (d) => { const [y, m, day] = String(d).split('-'); return `${day}/${m}/${y}` }
export const dayName = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long' })
// A late finish buffers out to "24:00" — show that as 12:00am, not 12:00pm.
export const to12 = (t) => { let [h, m] = String(t).split(':').map(Number); if (h >= 24) h -= 24; const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap}` }
export const shape = (w) => ({ date: w.date, from: w.blockStart, to: w.blockEnd })

// Escapes text that reaches the HTML — room names and company names are
// admin-entered, but the building manager's email should not be a place where
// a stray angle bracket breaks the table.
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// The request email. `what` describes the booking in the opening sentence,
// `detailsHtml` is the block under the table, and `noteFor` labels the third
// column so a function ("30-min buffer each side") and a room booking read
// correctly without either pretending to be the other.
export function accessRequestHtml({ windows, what, detailsHtml }) {
  const rowsHtml = windows.map((w) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd">${dayName(w.date)} ${dmy(w.date)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd"><strong>${to12(w.blockStart)} – ${to12(w.blockEnd)}</strong></td>
        <td style="padding:8px 12px;border:1px solid #ddd">${w.note}</td>
      </tr>`).join('')
  return `
      <p>Hi team,</p>
      <p>We have ${what} at <strong>Hexa Space — U 402/828 Whitehorse Road, Box Hill (Level 4)</strong> that
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
        ${detailsHtml}
      </p>
      <p>Please confirm once scheduled — happy to provide anything further you need.</p>
      <p>Kind regards,<br/>Hexa Space Pty Ltd<br/>402/830 Whitehorse Road, Box Hill VIC 3128</p>`
}

// Sends one request covering `windows`. Throws on failure so callers can
// surface it rather than silently recording a send that never happened.
export async function sendAccessRequestEmail({ windows, what, detailsHtml, subjectLabel = 'After-hours access request' }) {
  const first = windows[0]
  const r = await sendResendEmail({
    from: 'Hexa Space <info@hexaspace.com.au>',
    to: TO, cc: CC,
    replyTo: 'info@hexaspace.com.au',
    subject: `${subjectLabel} — front door & lift, ${dayName(first.date)} ${dmy(first.date)} ${to12(first.blockStart)}–${to12(first.blockEnd)}${windows.length > 1 ? ` (+${windows.length - 1} more)` : ''}`,
    html: accessRequestHtml({ windows, what, detailsHtml }),
  })
  if (!r.ok) throw new Error('Email send failed.')
}
