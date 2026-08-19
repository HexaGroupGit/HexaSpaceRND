// Shared building-unlock (front door + lift) request — used by the
// /api/function-bookings/access-request endpoint (admin / confirm flow) and by
// the daily /api/function-reminders cron that actually releases it.
//
// Sessions that fall AFTER HOURS (outside Mon–Fri 9am–5pm, or any weekend
// session) need the building manager to unlock the front door and program lift
// access to Level 4 — only building management can do the lift. They run that
// on a weekly cycle and won't take a request far in advance, so the email is
// NOT sent at confirm time: each session is scheduled for ACCESS_LEAD_DAYS
// before it, rolled back off a weekend so the request always lands on a
// business day (Mon–Fri). Sessions that share a send date go out in one email,
// so a normal single-date function is still exactly one request. A booking
// confirmed inside its own lead window sends straight away — better late than
// never — as does an admin pressing resend (force).
import { bookingSessions, bufferedWindow, isWeekendDate, accessRequestSendDate, ACCESS_LEAD_DAYS } from '../../src/lib/functionBooking.js'
import { sendResendEmail } from '../_email.js'

const TO = ['info@maxaoc.com.au', 'pbh@profacilitymanagement.com.au']
const CC = ['eric@hexaspace.com.au', 'info@hexaspace.com.au', 'scarlett@hexaspace.com.au', 'brittany@hexaspace.com.au']
const OPEN = '09:00', CLOSE = '17:00' // building's staffed hours, Mon–Fri
const TZ = 'Australia/Melbourne'

export const melbourneToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const dmy = (d) => { const [y, m, day] = String(d).split('-'); return `${day}/${m}/${y}` }
const dayName = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long' })
// A late finish buffers out to "24:00" — show that as 12:00am, not 12:00pm.
const to12 = (t) => { let [h, m] = String(t).split(':').map(Number); if (h >= 24) h -= 24; const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap}` }
const shape = (w) => ({ date: w.date, from: w.blockStart, to: w.blockEnd })

// The sessions that need an unlock: weekend, or the ±30-min buffered window
// starts before opening / ends after close. `from` drops sessions already past.
export function afterHoursWindows(b, from = null) {
  return bookingSessions(b).map((s) => {
    const { blockStart, blockEnd } = bufferedWindow(s.startTime, s.endTime)
    const afterHours = isWeekendDate(s.date) || blockStart < OPEN || blockEnd > CLOSE
    return { ...s, blockStart, blockEnd, afterHours }
  }).filter((w) => w.afterHours && (!from || w.date >= from))
}

// Upcoming after-hours sessions batched by the day their request goes out:
// [{ sendOn: '2026-08-21', windows: [...], sentAt }] — earliest send first.
export function accessRequestGroups(b, from = null) {
  const sends = b?.accessRequestSends ?? {}
  const byDate = new Map()
  for (const w of afterHoursWindows(b, from)) {
    const sendOn = accessRequestSendDate(w.date)
    if (!byDate.has(sendOn)) byDate.set(sendOn, [])
    byDate.get(sendOn).push(w)
  }
  return [...byDate.entries()]
    .map(([sendOn, windows]) => ({ sendOn, windows, sentAt: sends[sendOn]?.sentAt ?? null }))
    .sort((a, z) => a.sendOn.localeCompare(z.sendOn))
}

// The next unlock request still to be sent for this booking, or null.
export function accessRequestDue(b, from = null) {
  return accessRequestGroups(b, from).find((g) => !g.sentAt)?.sendOn ?? null
}

function emailHtml(b, windows) {
  const rowsHtml = windows.map((w) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd">${dayName(w.date)} ${dmy(w.date)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd"><strong>${to12(w.blockStart)} – ${to12(w.blockEnd)}</strong></td>
        <td style="padding:8px 12px;border:1px solid #ddd">${to12(w.startTime)} – ${to12(w.endTime)} function · 30-min buffer each side</td>
      </tr>`).join('')
  return `
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
}

async function emailGroup(b, windows) {
  const first = windows[0]
  const r = await sendResendEmail({
    from: 'Hexa Space <info@hexaspace.com.au>',
    to: TO, cc: CC,
    replyTo: 'info@hexaspace.com.au',
    subject: `After-hours access request — front door & lift, ${dayName(first.date)} ${dmy(first.date)} ${to12(first.blockStart)}–${to12(first.blockEnd)}${windows.length > 1 ? ` (+${windows.length - 1} more)` : ''}`,
    html: emailHtml(b, windows),
  })
  if (!r.ok) throw new Error('Email send failed.')
}

// Returns { status, ... }, persisting the booking whenever anything changed.
//   'not-needed'  — no upcoming session falls outside staffed hours
//   'already'     — every request for this booking has gone out
//   'scheduled'   — held until sendOn (ACCESS_LEAD_DAYS out, business day)
//   'sent'        — emailed now
// Throws on a failed send so callers can surface it.
export async function sendAccessRequest({ supabase, booking, force = false, today = melbourneToday() }) {
  const b = booking
  const groups = accessRequestGroups(b, today)
  if (groups.length === 0) {
    return { status: 'not-needed', note: 'No upcoming sessions fall outside staffed hours — no unlock request required.' }
  }

  // Normally: whatever is due today or overdue. force: the next batch, early.
  const dueNow = force ? [groups.find((g) => !g.sentAt) ?? groups[0]] : groups.filter((g) => !g.sentAt && g.sendOn <= today)
  const nextPending = (sends) => groups.find((g) => !(sends[g.sendOn]?.sentAt))?.sendOn ?? null

  const persist = async (patch) => {
    const updatedAt = new Date().toISOString()
    const updated = { ...b, ...patch, updatedAt }
    await supabase.from('function_bookings').upsert({ id: b.id, data: updated, updated_at: updatedAt })
    return updated
  }

  if (dueNow.length === 0) {
    const sendOn = nextPending(b.accessRequestSends ?? {})
    if (!sendOn) return { status: 'already', sentAt: b.accessRequestSentAt ?? null }
    // Nothing to send yet — record when it will go so the hub can show it.
    const held = b.accessRequestDueDate === sendOn ? b : await persist({ accessRequestDueDate: sendOn })
    const windows = groups.find((g) => g.sendOn === sendOn).windows
    return { status: 'scheduled', sendOn, leadDays: ACCESS_LEAD_DAYS, booking: held, windows: windows.map(shape) }
  }

  const sends = { ...(b.accessRequestSends ?? {}) }
  const sentWindows = []
  for (const g of dueNow) {
    await emailGroup(b, g.windows)
    sends[g.sendOn] = { sentAt: new Date().toISOString(), dates: g.windows.map((w) => w.date) }
    sentWindows.push(...g.windows)
  }
  const sentAt = new Date().toISOString()
  const updated = await persist({
    accessRequestSends: sends,
    accessRequestSentAt: sentAt,
    accessRequestDueDate: nextPending(sends),
    accessRequestWindows: sentWindows.map(shape),
  })
  return { status: 'sent', sentAt, sendOn: dueNow[0].sendOn, nextSendOn: updated.accessRequestDueDate, booking: updated, windows: updated.accessRequestWindows }
}
