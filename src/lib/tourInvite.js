// Confirmed tour bookings — the calendar invite (.ics), the "getting here"
// content, and the branded emails.
//
// Used by the admin "Book a Tour" modal: someone rings up, staff take their
// details and lock in a time. The prospect gets a real calendar invitation
// (not just a booking link) plus the address and parking options; the leasing
// team gets the same invite so it lands in their calendars too.
//
// Everything renders client-side and goes out through sendEmail() → the
// admin-gated /api/send-email, so safe mode, the suppression list and the
// email log all apply exactly as they do everywhere else.
import { brandShell, bKicker, bH1, bP, bBtn, bSmall } from './sendEmail.js'

const TZID = 'Australia/Melbourne'

// Tours are a leasing event — the whole leasing team is notified, matching
// LEAD_NOTIFY in api/_leads.js.
export const TOUR_NOTIFY = [
  'eric@hexaspace.com.au',
  'brittany@hexaspace.com.au',
  'scarlett@hexaspace.com.au',
  'info@hexaspace.com.au',
]

// Defaults for the arrival details. Editable under Settings → Tours
// (settings.tours), so reception can reword them without a deploy.
export const TOUR_DEFAULTS = {
  address: '402/830 Whitehorse Road, Box Hill VIC 3128',
  arrival: 'Take the lift to Level 4 and check in at reception — we\'ll come and meet you.',
  parking: [
    'Trio Box Hill — free underground parking, entry from Wellington Road',
    'Box Hill Central car park',
  ],
  durationMinutes: 30,
}

// Merged tour settings, with the defaults filled in for anything unset.
export function tourConfig(settings = {}) {
  const t = settings.tours ?? {}
  const parking = Array.isArray(t.parking)
    ? t.parking.filter(Boolean)
    : String(t.parking ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
  return {
    address: t.address || settings?.billing?.address || TOUR_DEFAULTS.address,
    arrival: t.arrival ?? TOUR_DEFAULTS.arrival,
    parking: parking.length ? parking : TOUR_DEFAULTS.parking,
    durationMinutes: Number(t.durationMinutes) || TOUR_DEFAULTS.durationMinutes,
  }
}

// ── Time helpers ─────────────────────────────────────────────────────────────
// Tour times are entered as Melbourne wall-clock. The .ics carries them as
// TZID-qualified local times (see VTIMEZONE below) so no conversion is needed
// there, but the Google/Outlook links need real UTC instants.

// How far Melbourne is ahead of UTC at a given instant, in ms (+10h or +11h).
function tzOffsetMs(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZID, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce((a, p) => (p.type === 'literal' ? a : { ...a, [p.type]: Number(p.value) }), {})
  // Hour 24 is how some engines render midnight — normalise to 0.
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second)
  return asUtc - date.getTime()
}

// 'yyyy-mm-dd' + 'HH:mm' in Melbourne → a real Date. Two passes settle the
// DST boundary case (the offset depends on the instant we're solving for).
export function melbourneToDate(dateStr, timeStr) {
  const [y, mo, d] = String(dateStr || '').split('-').map(Number)
  const [h, mi] = String(timeStr || '0:0').split(':').map(Number)
  if (!y || !mo || !d) return null
  const naive = Date.UTC(y, mo - 1, d, h || 0, mi || 0)
  let guess = new Date(naive - 10 * 3600000)
  for (let i = 0; i < 2; i++) guess = new Date(naive - tzOffsetMs(guess))
  return guess
}

export function addMinutes(timeStr, minutes) {
  const [h, m] = String(timeStr || '0:0').split(':').map(Number)
  const total = ((h || 0) * 60 + (m || 0) + Number(minutes || 0) + 1440 * 10) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const to12h = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number)
  const ap = (h || 0) >= 12 ? 'pm' : 'am'
  return `${(h || 0) % 12 || 12}:${String(m || 0).padStart(2, '0')}${ap}`
}

export function tourWhenLabel(dateStr, timeStr) {
  const d = melbourneToDate(dateStr, timeStr)
  if (!d) return ''
  const day = new Intl.DateTimeFormat('en-AU', { timeZone: TZID, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  return `${day} at ${to12h(timeStr)}`
}

export const durationLabel = (mins) => {
  const n = Number(mins) || 0
  if (n < 60) return `${n} minutes`
  const h = n / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? '' : 's'}`
}

// ── .ics ─────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const icsLocal = (dateStr, timeStr) => `${String(dateStr).replace(/-/g, '')}T${String(timeStr).replace(':', '')}00`
const icsUtc = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n')

// RFC 5545 caps content lines at 75 OCTETS (not characters) and Outlook is
// strict about it — so measure UTF-8 bytes, and never split a character in two.
const MAX_OCTETS = 75
const byteLen = (s) => new TextEncoder().encode(s).length

function fold(line) {
  if (byteLen(line) <= MAX_OCTETS) return line
  const chars = [...line] // code points, so surrogate pairs stay intact
  const out = []
  let cur = ''
  let budget = MAX_OCTETS
  for (const ch of chars) {
    const n = byteLen(ch)
    if (byteLen(cur) + n > budget) {
      out.push(cur)
      cur = ''
      budget = MAX_OCTETS - 1 // continuation lines start with a space
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join('\r\n')
}

// Melbourne's DST rules, so clients resolve the local times correctly rather
// than guessing (and so the invite survives a DST change between now and the
// tour date).
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:STANDARD',
  'DTSTART:19700405T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU',
  'TZOFFSETFROM:+1100',
  'TZOFFSETTO:+1000',
  'TZNAME:AEST',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19701004T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU',
  'TZOFFSETFROM:+1000',
  'TZOFFSETTO:+1100',
  'TZNAME:AEDT',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
]

// A proper invitation, not a "publish" feed: METHOD:REQUEST + ORGANIZER +
// ATTENDEE gets Gmail/Outlook to show the Yes/No/Maybe card and to update the
// same event in place when a rescheduled invite arrives (bumped SEQUENCE).
export function buildTourIcs({
  uid, sequence = 0, date, startTime, endTime,
  summary, description = '', location,
  organiserName, organiserEmail, attendees = [], cancelled = false,
}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hexa Space//Tours//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${cancelled ? 'CANCEL' : 'REQUEST'}`,
    ...VTIMEZONE,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${Number(sequence) || 0}`,
    `DTSTAMP:${icsUtc(new Date())}`,
    `DTSTART;TZID=${TZID}:${icsLocal(date, startTime)}`,
    `DTEND;TZID=${TZID}:${icsLocal(date, endTime)}`,
    `SUMMARY:${esc(summary)}`,
    description ? `DESCRIPTION:${esc(description)}` : '',
    location ? `LOCATION:${esc(location)}` : '',
    `ORGANIZER;CN=${esc(organiserName)}:mailto:${organiserEmail}`,
    ...attendees.filter(Boolean).map((a) => {
      const email = typeof a === 'string' ? a : a.email
      const cn = typeof a === 'string' ? a : (a.name || a.email)
      return `ATTENDEE;CN=${esc(cn)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`
    }),
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
  ]
  if (!cancelled) {
    lines.push(
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Hexa Space tour', 'TRIGGER:-PT60M', 'END:VALARM',
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.filter(Boolean).map(fold).join('\r\n')
}

// Resend wants raw base64 with no data: prefix. Built without Buffer so this
// stays a browser module.
export function icsBase64(ics) {
  const bytes = new TextEncoder().encode(ics)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

// "Add to calendar" fallback for anyone whose client ignores the attachment.
export function googleCalendarLink({ date, startTime, endTime, title, details, location }) {
  const s = melbourneToDate(date, startTime)
  const e = melbourneToDate(date, endTime)
  if (!s || !e) return ''
  const stamp = (d) => icsUtc(d)
  const q = encodeURIComponent
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${q(title)}&dates=${stamp(s)}/${stamp(e)}&details=${q(details)}&location=${q(location)}`
}

// ── Emails ───────────────────────────────────────────────────────────────────
const esc4 = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The parking options as an HTML list — the {{parking}} merge field.
export function parkingHtml(parking = []) {
  if (!parking.length) return ''
  return `<ul style="margin:0 0 16px;padding-left:18px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#3a3a3a">${
    parking.map((p) => `<li>${esc4(p)}</li>`).join('')
  }</ul>`
}

// Merge fields for the editable "Tour — Booking confirmed" template.
export function tourVars({ lead, date, startTime, endTime, durationMinutes, host, message, settings }) {
  const cfg = tourConfig(settings)
  const company = settings?.company?.name || 'Hexa Space'
  const title = `${company} tour`
  return {
    company,
    name: (lead?.name || '').trim().split(/\s+/)[0] || 'there',
    fullName: lead?.name || '',
    businessName: lead?.businessName || '',
    tourDate: new Intl.DateTimeFormat('en-AU', { timeZone: TZID, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(melbourneToDate(date, startTime) ?? new Date()),
    tourTime: to12h(startTime),
    tourWhen: tourWhenLabel(date, startTime),
    durationLabel: durationLabel(durationMinutes),
    host: host || '',
    address: cfg.address,
    arrival: cfg.arrival,
    parking: parkingHtml(cfg.parking),
    message: message ? `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#3a3a3a;margin:0 0 16px">${esc4(message)}</p>` : '',
    calendarLink: googleCalendarLink({
      date, startTime, endTime, title,
      details: `Your tour of ${company}. ${cfg.arrival}`,
      location: cfg.address,
    }),
    website: settings?.company?.website || 'hexaspace.com.au',
  }
}

const fill = (str, vars) => String(str ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m))

// The confirmation to the prospect. Uses the editable template when one exists
// (Templates → Emails → "Tour — Booking confirmed"), else the built-in body.
// Template content is a complete branded document (same convention as the other
// DEFAULT_*_HTML seeds), so it is filled and sent as-is.
export function tourConfirmedEmail({ template, vars, rescheduled = false }) {
  if (template?.content) {
    return {
      subject: fill(template.subject || `Your ${vars.company} tour — {{tourWhen}}`, vars),
      html: fill(template.content, vars),
    }
  }
  const inner =
    bKicker(rescheduled ? 'Tour rescheduled' : 'Tour confirmed') +
    bH1(rescheduled ? 'Your tour has moved' : "You're booked in") +
    bP(`Hi ${esc4(vars.name)},`) +
    bP(rescheduled
      ? `Thanks for letting us know — your tour of ${esc4(vars.company)} is now <strong>${esc4(vars.tourWhen)}</strong>. The updated invitation is attached, and it will replace the old one in your calendar.`
      : `Thanks for the call. Your tour of ${esc4(vars.company)} is locked in for <strong>${esc4(vars.tourWhen)}</strong> — allow about ${esc4(vars.durationLabel)}.`) +
    vars.message +
    detailTable([
      ['When', `${esc4(vars.tourWhen)} · ${esc4(vars.durationLabel)}`],
      ['Where', esc4(vars.address)],
      vars.host ? ['Meeting', esc4(vars.host)] : null,
    ].filter(Boolean)) +
    (vars.calendarLink ? bBtn('Add to calendar', vars.calendarLink) : '') +
    bP('<strong>Getting here</strong>') +
    (vars.arrival ? bP(esc4(vars.arrival)) : '') +
    (vars.parking ? bP('Parking:') + vars.parking : '') +
    bP('If anything changes, just reply to this email or give us a call and we\'ll move it.') +
    bSmall('A calendar invitation is attached — open it to add the tour to your calendar.')
  return {
    subject: rescheduled
      ? `Updated: your ${vars.company} tour — ${vars.tourWhen}`
      : `Your ${vars.company} tour — ${vars.tourWhen}`,
    html: brandShell(inner, { company: vars.company, website: vars.website }),
  }
}

// The heads-up to the leasing team, carrying the same invite.
export function tourTeamEmail({ vars, lead, notes, bookedBy, rescheduled = false }) {
  const who = [lead?.name, lead?.businessName && `(${lead.businessName})`].filter(Boolean).join(' ')
  const inner =
    bKicker(rescheduled ? 'Tour rescheduled' : 'Tour booked') +
    bH1(`${esc4(who || lead?.email || 'A prospect')} is coming in`) +
    detailTable([
      ['When', `${esc4(vars.tourWhen)} · ${esc4(vars.durationLabel)}`],
      ['Contact', esc4(lead?.name || '—')],
      ['Business', esc4(lead?.businessName || '—')],
      ['Email', esc4(lead?.email || '—')],
      ['Phone', esc4(lead?.phone || '—')],
      ['Interested in', esc4(lead?.enquiryType || '—')],
      vars.host ? ['Showing them', esc4(vars.host)] : null,
      bookedBy ? ['Booked by', esc4(bookedBy)] : null,
    ].filter(Boolean)) +
    (notes ? bP(`<strong>Notes:</strong> ${esc4(notes)}`) : '') +
    bSmall('The invitation is attached and the prospect has been emailed the address and parking. They\'re in the CRM under Leads.')
  return {
    subject: `${rescheduled ? 'Rescheduled' : 'Tour booked'} — ${who || lead?.email || 'prospect'}, ${vars.tourWhen}`,
    html: brandShell(inner, { company: vars.company, website: vars.website }),
  }
}

function detailTable(rows) {
  const tr = ([l, v]) => `<tr>
      <td style="padding:9px 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8a8a86;width:120px;border-top:1px solid rgba(0,0,0,.08)">${l}</td>
      <td style="padding:9px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;border-top:1px solid rgba(0,0,0,.08)">${v}</td>
    </tr>`
  return `      <table style="width:100%;border-collapse:collapse;margin:4px 0 18px">${rows.map(tr).join('')}</table>`
}
