import { useMemo, useState, useRef, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { Check, Users, CreditCard } from 'lucide-react'
import { useApp } from '../context.js'
import { Screen, BackHeader, Label, Rule, Chip, Sheet, BigButton, RoomPhoto, DateDropdown, daysBetween, fmt, to12, money0 } from '../ui.jsx'
import { toDec, fromDec, isFree, spendableCredits, createBooking, CREDIT_VALUE } from '../lib/bookingActions.js'
import { blockingResourceIds } from '../../lib/roomConflicts.js'
import { priceBooking, requiresUpfrontPayment, bookingRate } from '../../lib/dropIn.js'
import { floorLabel } from '../../lib/roomFloor.js'
import { apiUrl, openPayment } from '../lib/native.js'
import { isPerkRoom, perkHoursUsed, companyPerk, round2, companyCanAfterHours, resourceBookingWindow, afterHoursConfig } from '../../lib/credits.js'

// Single-room day calendar — the app's version of the website's booking grid:
// a date dropdown + scrollable day strip on top, an hour column below with
// existing bookings blocked out, tap any open half-hour to book from there. The
// grid spans the extended (after-hours) window; slots outside a member's band
// are disabled.

const HOUR_H = 60 // px per hour → 30px per half-hour cell
const LABEL_PAD = 22 // room under the last gridline so the last label isn't clipped
const STRIP_DAYS = 28 // days always shown in the scrub strip
const MAX_DAYS_AHEAD = 180 // how far out the date dropdown lets a member book
// Durations run to a full day — the row scrolls, and anything that doesn't fit
// (room booked after this slot, closing time, office-perk cap) renders disabled.
const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240, 300, 360, 420, 480]
  .map((min) => ({ min, label: min === 30 ? '30 mins' : min === 60 ? '1 hour' : `${min / 60} hrs` }))

export default function RoomDetail({ room, onBack }) {
  const { data, patch } = useApp()
  const { allBookings, member, company, leases, spaces, settings } = data

  // Grid spans the extended window; the member's own band (win) gates slots.
  const ahCfg = afterHoursConfig(settings)
  const DAY_START = ahCfg.extendedStart
  const DAY_END = ahCfg.extendedEnd
  const GRID_H = (DAY_END - DAY_START) * HOUR_H
  const canAfterHours = companyCanAfterHours(company?.id, leases, spaces, settings)
  // Studios gate to business hours for everyone (same as external bookings).
  const win = resourceBookingWindow(room, canAfterHours, settings)

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [slot, setSlot] = useState(null) // "HH:mm" start tapped

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const lastStr = format(addDays(new Date(), MAX_DAYS_AHEAD), 'yyyy-MM-dd')
  // The strip always covers four weeks, and stretches to reach a date picked
  // from the dropdown beyond that — so the chosen day is always on it.
  const stripLen = Math.min(MAX_DAYS_AHEAD + 1, Math.max(STRIP_DAYS, daysBetween(todayStr, date) + 7))
  const days = useMemo(() => Array.from({ length: stripLen }, (_, i) => addDays(new Date(), i)), [stripLen])
  const nowDec = new Date().getHours() + new Date().getMinutes() / 60

  // Include bookings on rooms that physically share this space (Function Space
  // vs North/South/West) so a hold on one blocks out the others.
  const dayBookings = useMemo(() => {
    const ids = new Set(blockingResourceIds(room.id, spaces))
    return (allBookings ?? [])
      .filter((b) => ids.has(b.resourceId) && b.date === date && b.status !== 'Cancelled')
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
  }, [allBookings, room.id, date, spaces])

  const rate = bookingRate(room, company?.id, leases) // members 30% off, drop-ins list rate
  const balance = spendableCredits(company, leases)
  const level = floorLabel(room) // 'Level 2' / 'Level 4' — which floor to walk to

  // Half-hour cells across the grid window
  const cells = []
  for (let d = DAY_START; d < DAY_END; d += 0.5) cells.push(d)
  const cellBooked = (d) => dayBookings.some((b) => toDec(b.startTime) < d + 0.5 && d < toDec(b.endTime))
  const cellPast = (d) => date === todayStr && d <= nowDec
  // Outside the member's bookable band → after-hours (needs 24/7 access).
  const cellAfterHours = (d) => d < win.start || d >= win.end

  return (
    <Screen>
      <BackHeader title={room.unitNumber} />

      {/* Arched hero — only when a photo exists */}
      <RoomPhoto room={room} fallback="none" className="app-arch w-full h-44 mb-5" />

      <div className="flex items-end justify-between gap-3 pt-1 pb-5">
        <div>
          <p className="font-display font-extralight text-[30px] leading-tight text-ink">{room.unitNumber}</p>
          <p className="hx-prose text-[13px] mt-1.5 flex items-center gap-3">
            <span>{rate ? `${money0(rate)}/hr` : '—'}</span>
            {room.pax && <span className="flex items-center gap-1"><Users size={12} /> up to {room.pax}</span>}
            {room.size && !/up\s*to/i.test(room.size) && <span>{room.size}</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {level && <Chip>{level}</Chip>}
          <Chip tone="green">{balance} cr</Chip>
        </div>
      </div>

      {/* Date — tap to open the month, or scrub the strip */}
      <DateDropdown
        value={date} min={todayStr} max={lastStr} inline
        onChange={(ds) => { setDate(ds); setSlot(null) }}
      />
      <DateStrip days={days} date={date} onPick={(ds) => { setDate(ds); setSlot(null) }} className="mt-3" />

      <div className="flex items-center justify-between mt-5 mb-3">
        <Label>Availability</Label>
        <span className="hx-prose text-[11px]">Tap an open slot</span>
      </div>

      {/* Day grid — one column, bookings blocked out */}
      <div className="bg-paper border border-ink/10 flex">
        {/* hour gutter */}
        <div className="w-14 shrink-0 border-r border-ink/10 relative" style={{ height: GRID_H + LABEL_PAD }}>
          {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i).map((h) => (
            <span key={h} style={{ top: (h - DAY_START) * HOUR_H + 3 }}
              className="absolute right-2 font-heading uppercase tracking-nav text-[9px] text-portal-muted">
              {h % 12 || 12} {h >= 12 ? 'pm' : 'am'}
            </span>
          ))}
        </div>
        {/* slots + booking overlays */}
        <div className="relative flex-1" style={{ height: GRID_H + LABEL_PAD }}>
          {cells.map((d) => {
            const booked = cellBooked(d)
            const past = cellPast(d)
            const afterHours = cellAfterHours(d)
            const open = !booked && !past && !afterHours
            return (
              <button key={d} disabled={!open}
                onClick={() => setSlot(fromDec(d))}
                style={{ top: (d - DAY_START) * HOUR_H, height: HOUR_H / 2 }}
                className={`absolute inset-x-0 border-b ${Number.isInteger(d) ? 'border-ink/10' : 'border-ink/5'} ${
                  past || afterHours ? 'bg-bone/70' : open ? 'active:bg-hexa-green/10' : ''
                }`}
                aria-label={open ? `Book from ${to12(fromDec(d))}` : afterHours ? (win.studioGated ? `Studios are bookable ${to12(fromDec(win.start))} – ${to12(fromDec(win.end))}` : 'After-hours — needs 24/7 access') : undefined}
              />
            )
          })}
          {dayBookings.map((b) => {
            const top = (Math.max(toDec(b.startTime), DAY_START) - DAY_START) * HOUR_H
            const height = Math.max(22, (Math.min(toDec(b.endTime), DAY_END) - Math.max(toDec(b.startTime), DAY_START)) * HOUR_H)
            const mine = b.companyId === company?.id
            return (
              <div key={b.id} style={{ top, height }}
                className={`absolute left-1 right-1 px-2.5 py-1 overflow-hidden pointer-events-none ${mine ? 'bg-hexa-green text-paper' : 'bg-charcoal text-paper/90'}`}>
                <span className="font-heading uppercase tracking-nav text-[9px] block truncate">
                  {mine ? (b.title || 'Your booking') : 'Booked'}
                </span>
                <span className="text-[10px] opacity-80 block truncate">{to12(b.startTime)} – {to12(b.endTime)}</span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="hx-prose text-[11px] mt-3">
        Open {to12(fromDec(win.start))} – {to12(fromDec(win.end))} · {win.studioGated
          ? 'studios keep business hours for all bookings.'
          : canAfterHours
            ? 'after-hours booking is on for your membership.'
            : 'after-hours is included with Private Office & Dedicated Desk memberships.'} Requests confirmed usually within the hour.
      </p>

      {slot && (
        <SlotSheet
          room={room} date={date} start={slot}
          member={member} company={company} allBookings={allBookings} balance={balance}
          leases={leases} spaces={spaces} settings={settings}
          onClose={() => setSlot(null)}
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

// Quick day scrub. The dropdown above it is how you travel — this is for
// nudging a day either side, so it carries no chevrons of its own.
function DateStrip({ days, date, onPick, className = '' }) {
  const ref = useRef(null)

  // Mouse-wheel → horizontal scroll (needs a non-passive listener to prevent
  // the page scrolling instead; React's onWheel is passive).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Pick a date from the dropdown and the strip follows it — centred, so a day
  // three weeks out isn't left off-screen behind the scroll.
  useEffect(() => {
    const el = ref.current
    const cell = el?.querySelector(`[data-day="${date}"]`)
    if (!el || !cell) return
    el.scrollTo({ left: cell.offsetLeft - el.clientWidth / 2 + cell.clientWidth / 2, behavior: 'smooth' })
  }, [date])

  return (
    <div ref={ref} className={`flex gap-2 overflow-x-auto no-scrollbar pb-1 ${className}`}>
      {days.map((d) => {
        const ds = format(d, 'yyyy-MM-dd')
        const on = ds === date
        return (
          <button key={ds} data-day={ds} onClick={() => onPick(ds)}
            className={`shrink-0 w-14 py-2.5 border text-center transition-colors ${on ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink border-ink/15 active:bg-bone'}`}>
            <span className={`block font-heading uppercase tracking-label text-[9px] ${on ? 'text-paper/60' : 'text-portal-muted'}`}>
              {format(d, 'EEE')}
            </span>
            <span className="block font-display font-extralight text-lg leading-tight mt-0.5">{format(d, 'd')}</span>
          </button>
        )
      })}
    </div>
  )
}

function SlotSheet({ room, date, start, member, company, allBookings, balance, leases, spaces, settings, onClose, onBooked }) {
  const [durMin, setDurMin] = useState(60)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  // Office perk: private-office (suite) companies book Sky/Earth/Sun/Moon free,
  // capped per booking + per company per day.
  const perk = companyPerk(company?.id, leases, spaces, settings)
  const isPerk = isPerkRoom(room, perk)
  const perkUsedToday = isPerk ? perkHoursUsed({ companyId: company?.id, date, bookings: allBookings, perk, spaces }) : 0
  const canAfterHours = companyCanAfterHours(company?.id, leases, spaces, settings)
  const win = resourceBookingWindow(room, canAfterHours, settings)

  const fits = (min) => {
    const end = toDec(start) + min / 60
    if (toDec(start) < win.start || end > win.end || !isFree(allBookings, room.id, date, start, fromDec(end), spaces)) return false
    if (isPerk && (min / 60 > perk.maxHoursPerBooking || perkUsedToday + min / 60 > perk.maxHoursPerDay)) return false
    return true
  }
  // If the default hour doesn't fit, fall back to the longest duration that does.
  const usable = DURATIONS.filter((d) => fits(d.min))
  // Index arithmetic, not .at(-1): Array.prototype.at needs WebView/Chrome 92+
  // and Safari 15.4+, and Vite polyfills no runtime methods — on an older phone
  // .at is undefined and this threw the instant a member tapped a slot.
  const effDur = usable.some((d) => d.min === durMin) ? durMin : (usable[usable.length - 1]?.min ?? 30)
  const longestFit = usable.length ? usable[usable.length - 1].min : 0
  const end = fromDec(toDec(start) + effDur / 60)

  const hrs = effDur / 60
  // Drop-ins pay the LIST rate (the member discount is a membership benefit) and
  // pay on the spot — a month-end fee collects nothing from someone who gets no
  // month-end bill. Members are unchanged.
  const quote = priceBooking({ room, hours: hrs, company, leases, isPerk })
  const { rate, cost, creditsUsed } = quote
  const credits = quote.needed
  const overage = quote.shortfallCredits
  const mustPay = requiresUpfrontPayment({ company, leases, isPerk, payNow: quote.payNow })
  const hasCard = !!company?.stripePaymentMethodId
  const payIncGst = Math.round(quote.payNow * 1.1 * 100) / 100

  async function addCard() {
    setSaving(true); setError('')
    try {
      const { authHeaders } = await import('../../lib/apiFetch.js')
      const r = await fetch(apiUrl('/api/stripe/setup'), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ returnTo: '/app' }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d.error ?? 'Could not start card setup.')
      await openPayment(d.url)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirm() {
    setSaving(true); setError('')
    try {
      if (mustPay) {
        // Server charges first and only then writes the booking, so a drop-in
        // can never hold a room they haven't paid for.
        const { authHeaders } = await import('../../lib/apiFetch.js')
        const r = await fetch(apiUrl('/api/bookings/pay-and-book'), {
          method: 'POST', headers: await authHeaders(),
          body: JSON.stringify({ resourceId: room.id, date, startTime: start, endTime: end, title }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? 'The payment could not be processed.')
        onBooked({ booking: d.booking, company, fee: null })
        setDone(d.booking)
        return
      }
      const result = await createBooking({ room, date, startTime: start, endTime: end, title, member, company, allBookings, leases, spaces, settings })
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
          <p className="hx-prose text-[13px] mt-2">{fmt(date)} · {to12(start)} – {to12(end)}</p>
          <p className="hx-prose text-[12px] mt-4">Reference {done.reference}. Our team confirms requests — usually within the hour.</p>
          <BigButton onClick={onClose} className="mt-7">Done</BigButton>
        </div>
      ) : (
        <>
          <div className="text-center pt-1 pb-5">
            <p className="font-display font-extralight text-[28px] text-ink">{room.unitNumber}</p>
            <p className="hx-prose text-[13px] mt-1">{fmt(date)} · from {to12(start)}</p>
          </div>
          <Rule className="mb-5" />

          <label className="hx-eyebrow block mb-2">Duration</label>
          <DurationRow durations={DURATIONS} value={effDur} fits={fits} onPick={setDurMin} />
          {longestFit < DURATIONS[DURATIONS.length - 1].min && (
            <p className="hx-prose text-[11px] mb-5 -mt-3">
              {longestFit
                ? `Up to ${DURATIONS.find((d) => d.min === longestFit).label} fits from ${to12(start)} — longer options are greyed out.`
                : 'Nothing fits from this slot — try another time.'}
              {isPerk ? ` ${room.unitNumber} is included up to ${perk.maxHoursPerBooking}h per booking.` : ''}
            </p>
          )}

          <label className="hx-eyebrow block mb-2">Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client meeting"
            className="hx-input min-h-[48px] mb-5" />

          {isPerk ? (
            <div className="bg-hexa-green/5 border border-hexa-green/30 p-4">
              <Line k={`${to12(start)} – ${to12(end)}`} v="Included" green />
              <p className="hx-prose text-[12px] text-portal-muted mt-1.5">Free with your membership — up to {perk.maxHoursPerBooking}h/booking, {perk.maxHoursPerDay}h/day per company. {round2(Math.max(0, perk.maxHoursPerDay - perkUsedToday))}h left today.</p>
            </div>
          ) : (
            <div className="bg-bone border border-ink/10 p-4 space-y-2">
              <Line k={`${to12(start)} – ${to12(end)}`} v={cost ? `${money0(cost)} · ${credits} cr` : 'Free'} />
              {mustPay ? (
                <>
                  {creditsUsed > 0 && <Line k="Credits applied" v={`${creditsUsed} cr`} green />}
                  <Line k="Pay now (inc GST)" v={money0(payIncGst)} />
                  <p className="hx-prose text-[12px] text-portal-muted mt-1.5">
                    {money0(rate)}/hr casual rate. Paid by card when you confirm — no account needed.
                  </p>
                </>
              ) : (
                <>
                  <Line k="Allowance remaining" v={`${balance} cr`} green={balance >= credits} />
                  {overage > 0 && <Line k="Over allowance" v={`${overage} cr · billed as a fee`} amber />}
                </>
              )}
            </div>
          )}

          {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

          {mustPay && !hasCard ? (
            <>
              <BigButton onClick={addCard} disabled={saving} className="mt-6">
                <CreditCard size={14} className="inline mr-2 -mt-0.5" />
                {saving ? 'Opening…' : 'Add a card to continue'}
              </BigButton>
              <p className="hx-prose text-[11px] text-center mt-3">
                Stripe takes your card securely — we never see the number. Come back here to confirm and pay.
              </p>
            </>
          ) : (
            <BigButton onClick={confirm} disabled={saving} className="mt-6">
              {saving ? (mustPay ? 'Taking payment…' : 'Booking…')
                : mustPay ? `Pay ${money0(payIncGst)} & confirm` : 'Confirm booking'}
            </BigButton>
          )}
          {mustPay && hasCard && (
            <p className="hx-prose text-[11px] text-center mt-3">
              Charging {(company.cardBrand || 'card').toUpperCase()} •••• {company.cardLast4}.
            </p>
          )}
        </>
      )}
    </Sheet>
  )
}

// Durations as a horizontal scroller rather than a fixed grid — half an hour
// through to a full day, without a wall of buttons. The live choice is scrolled
// into view, so a fallback pick (the longest that still fits) is never hidden.
function DurationRow({ durations, value, fits, onPick }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const chip = el?.querySelector(`[data-min="${value}"]`)
    if (!el || !chip) return
    el.scrollTo({ left: Math.max(0, chip.offsetLeft - el.clientWidth / 2 + chip.clientWidth / 2), behavior: 'smooth' })
  }, [value])

  return (
    <div ref={ref} className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-5 px-5">
      {durations.map((d) => {
        const ok = fits(d.min)
        const on = d.min === value
        return (
          <button key={d.min} data-min={d.min} disabled={!ok} onClick={() => onPick(d.min)}
            className={`shrink-0 min-h-[44px] px-4 border font-heading uppercase tracking-nav text-[10px] whitespace-nowrap transition-colors ${
              on ? 'bg-ink text-paper border-ink' : ok ? 'bg-paper text-ink border-ink/15 active:bg-bone' : 'bg-bone text-portal-muted border-ink/10 opacity-50'
            }`}>
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

function Line({ k, v, green, amber }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="hx-prose text-[13px]">{k}</span>
      <span className={`font-heading uppercase tracking-nav text-[10px] ${green ? 'text-hexa-green' : amber ? 'text-amber-700' : 'text-ink'}`}>{v}</span>
    </div>
  )
}
