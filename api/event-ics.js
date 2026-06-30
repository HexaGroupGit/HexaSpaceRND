// GET /api/event-ics?title=&start=&end=&location=&details=
// Returns a downloadable .ics calendar file (the "iCal" add-to-calendar link).

function icsDate(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
function esc(s) {
  return String(s ?? '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

export default function handler(req, res) {
  const { title = 'Event', start, end, location = '', details = '' } = req.query
  if (!start) return res.status(400).send('Missing start')

  const endIso = end || new Date(new Date(start).getTime() + 2 * 3600 * 1000).toISOString()
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HexaHub//Events//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${icsDate(start)}-${Math.random().toString(36).slice(2, 8)}@hexahub.com.au`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(endIso)}`,
    `SUMMARY:${esc(title)}`,
    details ? `DESCRIPTION:${esc(details)}` : '',
    location ? `LOCATION:${esc(location)}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean)

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="event.ics"')
  return res.status(200).send(lines.join('\r\n'))
}
