import { useState, useEffect } from 'react'
import { format, parseISO, isFuture, isToday } from 'date-fns'
import { Calendar, MapPin, ExternalLink, CalendarPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { fetchSanityEvents } from '../../lib/sanity.js'
import { Screen, BackHeader, Label, Chip, Rule, BigButton, EmptyNote } from '../ui.jsx'

// Events — same sources as the portal (Sanity + portal_events), presented
// Eclat-style: arched image cards, serif titles, a detail view with
// add-to-calendar.

function isUpcoming(dateStr) {
  try { const d = parseISO(dateStr); return isFuture(d) || isToday(d) } catch { return true }
}
const longDate = (dateStr) => {
  try { return format(parseISO(dateStr), 'EEEE, d MMMM yyyy') } catch { return dateStr }
}

// "6:00 pm" → {h, m} (24h); null if unparseable → treated as all-day.
function parseTime(t) {
  const m = /(\d{1,2})[:.](\d{2})\s*(am|pm)?/i.exec(t || '')
  if (!m) return null
  let h = Number(m[1]) % 12
  if ((m[3] || '').toLowerCase() === 'pm') h += 12
  return { h, m: Number(m[2]) }
}

const pad = (n) => String(n).padStart(2, '0')

function calendarStamps(event) {
  const d = parseISO(event.date)
  const t = parseTime(event.time)
  if (!t) {
    const day = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    const next = new Date(d); next.setDate(next.getDate() + 1)
    const dayEnd = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
    return { allDay: true, start: day, end: dayEnd }
  }
  const start = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(t.h)}${pad(t.m)}00`
  const endDate = new Date(d); endDate.setHours(t.h + 2, t.m) // default 2h
  const end = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`
  return { allDay: false, start, end }
}

function downloadIcs(event) {
  const { allDay, start, end } = calendarStamps(event)
  const loc = event.location || 'Hexa Space, 402/830 Whitehorse Road, Box Hill VIC 3128'
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hexa Space//Member App//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@hexaspace.com.au`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${(event.title || '').replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:${(event.description || '').replace(/\r?\n/g, '\\n').replace(/[,;]/g, ' ')}`,
    `LOCATION:${loc.replace(/[,;]/g, ' ')}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${(event.title || 'event').replace(/\W+/g, '-').toLowerCase()}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}

function googleCalUrl(event) {
  const { start, end } = calendarStamps(event)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Hexa Space event',
    dates: `${start}/${end}`,
    details: event.description || '',
    location: event.location || 'Hexa Space, 402/830 Whitehorse Road, Box Hill VIC 3128',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

export default function Events() {
  const [events, setEvents] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      const [sanityEvents, localRes] = await Promise.all([
        fetchSanityEvents().catch(() => []),
        supabase.from('portal_events').select('data'),
      ])
      const localEvents = (localRes.data ?? []).map((r) => ({ ...r.data, source: 'local' }))
      const all = [...sanityEvents, ...localEvents].filter((e) => e.date)
      all.sort((a, b) => new Date(a.date) - new Date(b.date))
      setEvents(all)
    }
    load()
  }, [])

  if (selected) return <EventDetail event={selected} onBack={() => setSelected(null)} />

  const upcoming = (events ?? []).filter((e) => isUpcoming(e.date))
  const past = (events ?? []).filter((e) => !isUpcoming(e.date)).slice(-4).reverse()

  return (
    <Screen>
      <BackHeader title="Events" fallback="/more" />
      <p className="font-display font-extralight text-[28px] leading-tight text-ink mt-2 mb-8">
        What's on at<br />Hexa Space.
      </p>

      {events === null ? (
        <p className="hx-prose text-center py-10">Loading events…</p>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <EmptyNote label="No events on the calendar." sub="Check hexaspace.com.au for the latest programming." />
      ) : (
        <>
          {upcoming.map((e, i) => (
            <EventCard key={e.id ?? i} event={e} onOpen={() => setSelected(e)} featured={i === 0} />
          ))}
          {past.length > 0 && (
            <>
              <Label className="mt-10 mb-4">Past events</Label>
              <div className="opacity-60">
                {past.map((e, i) => <EventCard key={e.id ?? `p${i}`} event={e} onOpen={() => setSelected(e)} />)}
              </div>
            </>
          )}
        </>
      )}
    </Screen>
  )
}

function EventCard({ event, onOpen, featured = false }) {
  return (
    <button onClick={onOpen} className="w-full text-left mb-7 active:opacity-70 transition-opacity">
      {event.imageUrl ? (
        <div className={`app-arch overflow-hidden ${featured ? 'h-56' : 'h-40'}`}>
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }} />
        </div>
      ) : (
        <div className={`app-arch bg-stone flex items-center justify-center ${featured ? 'h-56' : 'h-40'}`}>
          <Calendar size={22} strokeWidth={1.2} className="text-ink/40" />
        </div>
      )}
      <div className="pt-4 px-1">
        <Label>{longDate(event.date)}{event.time && event.time !== '12:00 am' ? ` · ${event.time}` : ''}</Label>
        <h3 className="font-display font-extralight text-[24px] leading-tight text-ink mt-2">{event.title}</h3>
        {event.location && (
          <p className="hx-prose text-[12px] mt-2 flex items-center gap-1.5"><MapPin size={12} /> {event.location}</p>
        )}
      </div>
      <Rule className="mt-6" />
    </button>
  )
}

function EventDetail({ event, onBack }) {
  return (
    <Screen>
      <div className="flex items-center pt-5 pb-4 -ml-2">
        <button onClick={onBack} aria-label="Back"
          className="h-11 w-11 flex items-center justify-center text-ink active:opacity-60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="font-heading uppercase tracking-nav text-[12px] text-ink mx-auto pr-11">Event</span>
      </div>

      {event.imageUrl && (
        <div className="app-arch overflow-hidden h-64 mb-6">
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }} />
        </div>
      )}

      <Chip tone={isUpcoming(event.date) ? 'green' : 'ink'}>{isUpcoming(event.date) ? 'Upcoming' : 'Past event'}</Chip>
      <h1 className="font-display font-extralight text-[32px] leading-[1.08] text-ink mt-4">{event.title}</h1>

      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-3 hx-prose text-[14px] text-ink">
          <Calendar size={14} className="text-hexa-green shrink-0" />
          {longDate(event.date)}{event.time && event.time !== '12:00 am' ? ` · ${event.time}` : ''}
        </div>
        <div className="flex items-center gap-3 hx-prose text-[14px] text-ink">
          <MapPin size={14} className="text-hexa-green shrink-0" />
          {event.location || 'Hexa Space · 402/830 Whitehorse Road, Box Hill'}
        </div>
      </div>

      {event.description && (
        <>
          <Rule className="my-6" />
          <p className="hx-prose text-[14px]">{event.description}</p>
        </>
      )}

      {isUpcoming(event.date) && (
        <div className="mt-8 space-y-3">
          <BigButton onClick={() => downloadIcs(event)}>
            <CalendarPlus size={14} className="inline mr-2 -mt-0.5" /> Add to calendar
          </BigButton>
          <BigButton tone="outline" onClick={() => window.open(googleCalUrl(event), '_blank', 'noopener')}>
            Google Calendar
          </BigButton>
          {event.link && (
            <a href={event.link} target="_blank" rel="noopener noreferrer"
              className="hx-btn-ghost mx-auto mt-2 flex w-fit">
              Event page <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
    </Screen>
  )
}
