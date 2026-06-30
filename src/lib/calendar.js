// Build "add to calendar" links for an event (client-side, for the Events screen).

const icsDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function calendarLinks(ev) {
  if (!ev?.date) return null
  const start = ev.date
  const end = ev.endDate || new Date(new Date(start).getTime() + 2 * 3600 * 1000).toISOString()
  const loc = [ev.location, ev.locationAddress].filter(Boolean).join(', ')
  const details = ev.summary || ev.description || ''
  const e = encodeURIComponent
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${e(ev.title)}&dates=${icsDate(start)}/${icsDate(end)}&details=${e(details)}&location=${e(loc)}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${e(ev.title)}&startdt=${e(start)}&enddt=${e(end)}&body=${e(details)}&location=${e(loc)}`,
    yahoo: `https://calendar.yahoo.com/?v=60&title=${e(ev.title)}&st=${icsDate(start)}&et=${icsDate(end)}&desc=${e(details)}&in_loc=${e(loc)}`,
    ical: `/api/event-ics?title=${e(ev.title)}&start=${e(start)}&end=${e(end)}&location=${e(loc)}&details=${e(details)}`,
  }
}

// Trigger reminder emails for one event now (manual send), or a test preview.
export async function sendEventReminders({ eventSlug, eventName, force, testEmail }) {
  const res = await fetch('/api/event-reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventSlug, eventName, force, testEmail }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Failed to send reminders')
  return data // { events, sent, remindedIds } or { test, to, event }
}
