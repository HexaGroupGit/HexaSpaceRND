import { useMemo, useState } from 'react'
import { format, addDays } from 'date-fns'
import { Check, Users } from 'lucide-react'
import { useApp } from '../context.js'
import { isFunctionSpace } from '../../portal/functionSpace.js'
import { Screen, Label, Display, Rule, Chip, Sheet, BigButton, EmptyNote, fmt, to12, money0, bookingName } from '../ui.jsx'
import { toDec, fromDec, isFree, creditBalance, createBooking, CREDIT_VALUE } from '../lib/bookingActions.js'

const DAY_START = 9, DAY_END = 17 // mirrors the portal calendar's booking window
const DURATIONS = [
  { min: 30, label: '30 mins' },
  { min: 60, label: '1 hour' },
  { min: 90, label: '1.5 hrs' },
  { min: 120, label: '2 hours' },
]

export default function Book() {
  const { data, patch } = useApp()
  const { spaces, allBookings, bookings, member, company } = data

  const rooms = useMemo(() => (spaces ?? [])
    .filter((s) => s.type === 'meeting' && !isFunctionSpace(s))
    .sort((a, b) => (a.hourlyRate ?? a.rate ?? 0) - (b.hourlyRate ?? b.rate ?? 0)), [spaces])
  const studios = useMemo(() => (spaces ?? [])
    .filter((s) => s.type === 'studio' || s.type === 'podcast')
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'studio' ? -1 : 1)), [spaces])

  const [kind, setKind] = useState('rooms')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [start, setStart] = useState('10:00')
  const [durMin, setDurMin] = useState(60)
  const [confirmRoom, setConfirmRoom] = useState(null)

  const list = kind === 'rooms' ? rooms : studios
  const end = fromDec(toDec(start) + durMin / 60)

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), [])

  // Start-time options: half-hour steps that fit the window (and not in the past today).
  const startOptions = useMemo(() => {
    const out = []
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const nowDec = new Date().getHours() + new Date().getMinutes() / 60
    for (let d = DAY_START; d + durMin / 60 <= DAY_END; d += 0.5) {
      if (date === todayStr && d <= nowDec) continue
      out.push(fromDec(d))
    }
    return out
  }, [date, durMin])
  const startValid = startOptions.includes(start)
  const effectiveStart = startValid ? start : startOptions[0]
  const effectiveEnd = effectiveStart ? fromDec(toDec(effectiveStart) + durMin / 60) : end

  const balance = creditBalance(company)

  return (
    <Screen>
      <div className="pt-9 pb-6">
        <Label>Book · By the hour</Label>
        <Display className="mt-4">Rooms &amp; studios.</Display>
      </div>

      {/* Rooms / Studios toggle */}
      <div className="flex gap-6 border-b border-ink/10 mb-6">
        {[['rooms', 'Meeting Rooms'], ['studios', 'Studios']].map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)}
            className={`relative pb-3 min-h-[44px] font-heading uppercase tracking-nav text-[11px] transition-colors ${kind === k ? 'text-ink' : 'text-portal-muted'}`}>
            {label}
            {kind === k && <span className="absolute inset-x-0 -bottom-px h-px bg-hexa-green" />}
          </button>
        ))}
      </div>

      {/* Day strip */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
        {days.map((d) => {
          const ds = format(d, 'yyyy-MM-dd')
          const on = ds === date
          return (
            <button key={ds} onClick={() => setDate(ds)}
              className={`shrink-0 w-14 py-2.5 border text-center transition-colors ${on ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink border-ink/15 active:bg-bone'}`}>
              <span className={`block font-heading uppercase tracking-label text-[9px] ${on ? 'text-paper/60' : 'text-portal-muted'}`}>
                {format(d, 'EEE')}
              </span>
              <span className="block font-display font-extralight text-lg leading-tight mt-0.5">{format(d, 'd')}</span>
            </button>
          )
        })}
      </div>

      {/* From · duration bar (Eclat-style) */}
      <div className="flex items-stretch gap-2 mt-4">
        <label className="shrink-0 border border-ink/15 bg-paper px-3 flex items-center gap-2">
          <span className="hx-eyebrow">From</span>
          <select value={effectiveStart ?? ''} onChange={(e) => setStart(e.target.value)}
            className="bg-transparent font-heading uppercase tracking-nav text-[11px] text-ink py-3 outline-none">
            {startOptions.map((t) => <option key={t} value={t}>{to12(t)}</option>)}
          </select>
        </label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {DURATIONS.map((d) => (
            <button key={d.min} onClick={() => setDurMin(d.min)}
              className={`shrink-0 px-4 border font-heading uppercase tracking-nav text-[10px] transition-colors ${durMin === d.min ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink border-ink/15 active:bg-bone'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 mb-4">
        <Label>{list.length} {kind === 'rooms' ? (list.length === 1 ? 'room' : 'rooms') : (list.length === 1 ? 'studio' : 'studios')}</Label>
        <Chip tone="green">{balance} credits · A${CREDIT_VALUE} each</Chip>
      </div>

      {/* Room cards — horizontal scroll */}
      {list.length === 0 ? (
        <EmptyNote label={`No ${kind} available.`} sub="Please check back soon." />
      ) : !effectiveStart ? (
        <EmptyNote label="No times left today." sub="Pick another day above." />
      ) : (
        <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2 snap-x snap-mandatory">
          {list.map((room) => {
            const free = isFree(allBookings, room.id, date, effectiveStart, effectiveEnd)
            return (
              <RoomCard key={room.id} room={room} free={free}
                onBook={() => free && setConfirmRoom(room)} />
            )
          })}
        </div>
      )}

      {/* My upcoming bookings */}
      <UpcomingList bookings={bookings} spaces={spaces} />

      {confirmRoom && effectiveStart && (
        <ConfirmSheet
          room={confirmRoom} date={date} start={effectiveStart} end={effectiveEnd}
          member={member} company={company} allBookings={allBookings} balance={balance}
          onClose={() => setConfirmRoom(null)}
          onBooked={({ booking, company: updatedCompany, fee }) => {
            patch((prev) => ({
              ...prev,
              bookings: [...prev.bookings, booking],
              allBookings: [...prev.allBookings, booking],
              company: updatedCompany,
              fees: fee ? [...prev.fees, fee] : prev.fees,
            }))
          }}
        />
      )}
    </Screen>
  )
}

function RoomCard({ room, free, onBook }) {
  const rate = room.hourlyRate ?? room.rate
  const dark = room.type !== 'meeting'
  return (
    <button onClick={onBook} disabled={!free}
      className="shrink-0 w-60 snap-start text-left bg-paper border border-ink/10 active:bg-bone transition-colors disabled:active:bg-paper">
      {/* Arched visual — no photos in inventory, so a typographic plate */}
      <div className={`app-arch mx-4 mt-4 h-40 flex items-center justify-center ${dark ? 'bg-charcoal' : 'bg-stone'} ${!free ? 'opacity-50' : ''}`}>
        <span className={`font-display font-extralight text-5xl ${dark ? 'text-paper/85' : 'text-ink/70'}`}>
          {(room.unitNumber || '?').charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-heading uppercase tracking-nav text-[11px] text-ink leading-relaxed">{room.unitNumber}</span>
          <Chip tone={free ? 'green' : 'amber'}>{free ? 'Available' : 'Booked'}</Chip>
        </div>
        <div className="hx-prose text-[12px] mt-2 flex items-center gap-3">
          <span>{rate ? `${money0(rate)}/hr` : '—'}</span>
          {room.pax && <span className="flex items-center gap-1"><Users size={11} /> {room.pax}</span>}
          {room.size && <span>{room.size}</span>}
        </div>
      </div>
    </button>
  )
}

function UpcomingList({ bookings, spaces }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const upcoming = [...(bookings ?? [])]
    .filter((b) => b.date && b.date >= todayStr && b.status !== 'Cancelled')
    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')))
    .slice(0, 6)

  return (
    <div className="mt-10">
      <Label className="mb-3">My upcoming bookings</Label>
      {upcoming.length === 0 ? (
        <>
          <Rule />
          <p className="hx-prose text-[13px] py-5">Nothing booked yet — pick a slot above.</p>
        </>
      ) : (
        <div className="divide-y divide-ink/5 border-y border-ink/10">
          {upcoming.map((b) => (
            <div key={b.id} className="flex items-center gap-4 py-4">
              <div className="bg-paper border border-ink/10 h-12 w-12 shrink-0 flex flex-col items-center justify-center">
                <span className="font-display font-extralight text-lg leading-none">{b.date.slice(8, 10)}</span>
                <span className="font-heading uppercase tracking-label text-[8px] text-portal-muted mt-0.5">
                  {format(new Date(b.date + 'T00:00:00'), 'MMM')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading uppercase tracking-nav text-[11px] text-ink truncate">{bookingName(spaces, b)}</div>
                <div className="hx-prose text-[12px] mt-0.5">
                  {to12(b.startTime)} – {to12(b.endTime)}{b.title ? ` · ${b.title}` : ''}
                </div>
              </div>
              <Chip tone={b.status === 'Confirmed' ? 'green' : 'ink'}>{b.status}</Chip>
            </div>
          ))}
        </div>
      )}
      <p className="hx-prose text-[11px] mt-4">
        Portal requests are confirmed by our team — usually within the hour. Credits are a company
        pool; anything over the allowance is billed as a fee at month end.
      </p>
    </div>
  )
}

function ConfirmSheet({ room, date, start, end, member, company, allBookings, balance, onClose, onBooked }) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const rate = room.hourlyRate ?? room.rate ?? 0
  const hrs = toDec(end) - toDec(start)
  const cost = hrs * rate
  const credits = Math.round((cost / CREDIT_VALUE) * 100) / 100
  const covered = Math.min(balance, credits)
  const overage = Math.round((credits - covered) * 100) / 100

  async function confirm() {
    setSaving(true); setError('')
    try {
      const result = await createBooking({ room, date, startTime: start, endTime: end, title, member, company, allBookings })
      onBooked(result)
      setDone(result.booking)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title={done ? 'Booking requested' : 'Confirm booking'}>
      {done ? (
        <div className="text-center pt-2">
          <span className="mx-auto h-12 w-12 border border-hexa-green/50 bg-hexa-green/10 flex items-center justify-center">
            <Check size={20} className="text-hexa-green" />
          </span>
          <p className="font-display font-extralight text-2xl text-ink mt-5">{room.unitNumber}</p>
          <p className="hx-prose text-[13px] mt-2">
            {fmt(date)} · {to12(start)} – {to12(end)}
          </p>
          <p className="hx-prose text-[12px] mt-4">
            Reference {done.reference}. Our team confirms requests — usually within the hour.
          </p>
          <BigButton onClick={onClose} className="mt-7">Done</BigButton>
        </div>
      ) : (
        <>
          <div className="text-center pt-1 pb-5">
            <p className="font-display font-extralight text-[28px] text-ink">{room.unitNumber}</p>
            <p className="hx-prose text-[13px] mt-1">{fmt(date)} · {to12(start)} – {to12(end)}</p>
          </div>
          <Rule className="mb-5" />
          <label className="hx-eyebrow block mb-2">Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client meeting"
            className="hx-input min-h-[48px] mb-5" />
          <div className="bg-bone border border-ink/10 p-4 space-y-2">
            <SheetLine k={`${hrs} hour${hrs !== 1 ? 's' : ''} × ${money0(rate)}`} v={cost ? `${money0(cost)} · ${credits} cr` : 'Free'} />
            <SheetLine k="Allowance remaining" v={`${balance} cr`} green={balance >= credits} />
            {overage > 0 && <SheetLine k="Over allowance" v={`${overage} cr · billed as a fee`} amber />}
          </div>
          {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
          <BigButton onClick={confirm} disabled={saving} className="mt-6">
            {saving ? 'Booking…' : 'Confirm booking'}
          </BigButton>
        </>
      )}
    </Sheet>
  )
}

function SheetLine({ k, v, green, amber }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="hx-prose text-[13px]">{k}</span>
      <span className={`font-heading uppercase tracking-nav text-[10px] ${green ? 'text-hexa-green' : amber ? 'text-amber-700' : 'text-ink'}`}>{v}</span>
    </div>
  )
}
