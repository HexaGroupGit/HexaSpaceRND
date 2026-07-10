import { useState, useEffect, useCallback } from 'react'
import { KeyRound, Check, DoorOpen, ArrowUpRight, Clock, CalendarClock } from 'lucide-react'
import { useApp } from '../context.js'
import { Sheet, BigButton, Chip, fmt, to12, bookingName } from '../ui.jsx'
import { apiUrl } from '../lib/native.js'
import { authHeaders } from '../../lib/apiFetch.js'
import { saltoWebUrl } from '../lib/doorAccess.js'
import {
  bookingPhase, canModifyBooking, cancelBooking, amendBooking,
} from '../lib/bookingActions.js'

// Booking detail sheet: unlock the door while the booking is live, or change
// its time / cancel it while it's still upcoming. Amend & cancel are locked once
// the booking has started, so a live booking can't be dropped for a refund.
export default function BookingSheet({ booking, onClose }) {
  const { data, patch } = useApp()
  const { spaces, company, member, leases, settings, allBookings } = data
  const room = (spaces ?? []).find((s) => s.id === booking.resourceId)
  const phase = bookingPhase(booking)
  const modifiable = canModifyBooking(booking)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ date: booking.date, startTime: booking.startTime, endTime: booking.endTime })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // ── Door unlock (only while the booking is live) ─────────────────────────
  const [door, setDoor] = useState(undefined) // undefined=loading | null=none | {door}
  const loadDoor = useCallback(async () => {
    if (phase !== 'active') { setDoor(null); return }
    try {
      const r = await fetch(apiUrl('/api/salto/open'), { headers: await authHeaders() })
      const d = r.ok ? await r.json() : null
      const match = (d?.doors ?? []).find((x) => x.id === `room:${booking.id}`)
      setDoor(match ?? null)
    } catch { setDoor(null) }
  }, [phase, booking.id])
  useEffect(() => { loadDoor() }, [loadDoor])

  const [unlockPhase, setUnlockPhase] = useState('idle') // idle | unlocking | open | error
  async function unlock() {
    if (unlockPhase === 'unlocking' || unlockPhase === 'open') return
    setUnlockPhase('unlocking'); setError('')
    try {
      const r = await fetch(apiUrl('/api/salto/open'), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ doorId: door.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Could not unlock — try your pass or the Salto app.')
      setUnlockPhase('open')
      if (navigator.vibrate) navigator.vibrate(30)
      setTimeout(() => setUnlockPhase('idle'), 6000)
    } catch (e) { setError(e.message); setUnlockPhase('error'); setTimeout(() => setUnlockPhase('idle'), 6000) }
  }

  // ── Cancel / amend ───────────────────────────────────────────────────────
  async function doCancel() {
    if (!window.confirm('Cancel this booking? Any credits used will return to your allowance.')) return
    setBusy(true); setError('')
    try {
      const { booking: updated, company: updatedCompany } = await cancelBooking({ booking, company })
      patch((prev) => ({
        ...prev,
        company: updatedCompany,
        bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)),
        allBookings: prev.allBookings.map((b) => (b.id === updated.id ? updated : b)),
      }))
      onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function doSave() {
    setBusy(true); setError('')
    try {
      const { booking: updated, company: updatedCompany } = await amendBooking({
        booking, room, date: form.date, startTime: form.startTime, endTime: form.endTime,
        member, company, allBookings, leases, spaces, settings,
      })
      patch((prev) => ({
        ...prev,
        company: updatedCompany,
        bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)),
        allBookings: prev.allBookings.map((b) => (b.id === updated.id ? updated : b)),
      }))
      onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const title = bookingName(spaces, booking)
  const timeStr = `${to12(booking.startTime)} – ${to12(booking.endTime)}`

  return (
    <Sheet open onClose={onClose} title="Your booking">
      <div className="text-center mb-5">
        <p className="font-display font-extralight text-[28px] leading-tight text-ink">{title}</p>
        <p className="hx-prose text-[13px] mt-1">{fmt(booking.date)} · {timeStr}</p>
        <div className="mt-3 flex justify-center">
          {phase === 'active' ? <Chip tone="green">Happening now</Chip>
            : phase === 'past' ? <Chip tone="ink">Ended</Chip>
            : booking.status === 'Cancelled' ? <Chip tone="ink">Cancelled</Chip>
            : <Chip tone="ink">Upcoming</Chip>}
        </div>
      </div>

      {/* Live → unlock */}
      {phase === 'active' && booking.status !== 'Cancelled' && (
        <div className="mb-5">
          {door === undefined ? (
            <div className="border border-ink/10 p-4 text-center"><p className="hx-prose text-[12px]">Checking your key…</p></div>
          ) : door ? (
            <button onClick={unlock} disabled={unlockPhase === 'unlocking'}
              className={`w-full flex items-center gap-4 p-4 border transition-all active:scale-[0.99] ${
                unlockPhase === 'open' ? 'bg-hexa-green border-hexa-green text-paper'
                  : unlockPhase === 'unlocking' ? 'bg-ink border-ink text-paper animate-pulse'
                  : 'bg-paper border-ink/15 text-ink active:bg-bone'}`}>
              <span className="h-11 w-11 shrink-0 rounded-full border border-current/20 flex items-center justify-center">
                {unlockPhase === 'open' ? <Check size={20} /> : unlockPhase === 'unlocking' ? <DoorOpen size={20} /> : <KeyRound size={20} />}
              </span>
              <span className="flex-1 min-w-0 text-left">
                <span className="font-display font-extralight text-xl block truncate">{room?.unitNumber ?? 'Your room'}</span>
                <span className="hx-prose text-[12px] block truncate" style={{ color: unlockPhase === 'open' || unlockPhase === 'unlocking' ? 'var(--color-paper)' : undefined }}>
                  {unlockPhase === 'open' ? 'Unlocked — give it a moment, then push.'
                    : unlockPhase === 'unlocking' ? 'Unlocking…' : 'Tap to unlock'}
                </span>
              </span>
            </button>
          ) : (
            <div className="border border-hexa-green/40 bg-hexa-green/5 p-4">
              <p className="hx-prose text-[13px] text-ink">
                Your key is live for this booking — open the door with your access pass or the Salto app at the reader.
              </p>
              <button onClick={() => window.open(saltoWebUrl(settings), '_blank', 'noopener')}
                className="mt-3 w-full min-h-[44px] border border-ink/15 font-heading uppercase tracking-nav text-[11px] text-ink flex items-center justify-center gap-2 active:bg-bone">
                <ArrowUpRight size={14} /> Open the Salto app
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upcoming → change time / cancel */}
      {modifiable && !editing && (
        <div className="space-y-2.5">
          <BigButton tone="outline" onClick={() => setEditing(true)}><Clock size={14} className="inline -mt-0.5 mr-2" />Change time</BigButton>
          <button onClick={doCancel} disabled={busy}
            className="w-full min-h-[48px] font-heading uppercase tracking-nav text-[11px] text-red-700 border border-red-200 active:bg-red-50 disabled:opacity-50">
            {busy ? 'Cancelling…' : 'Cancel booking'}
          </button>
          <p className="hx-prose text-[11px] text-center pt-1">Free to change or cancel until your booking starts.</p>
        </div>
      )}

      {modifiable && editing && (
        <div className="space-y-4">
          <div>
            <label className="hx-eyebrow block mb-1.5">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full border border-ink/15 bg-paper px-3 py-2.5 text-[15px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="hx-eyebrow block mb-1.5">From</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full border border-ink/15 bg-paper px-3 py-2.5 text-[15px]" />
            </div>
            <div>
              <label className="hx-eyebrow block mb-1.5">To</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full border border-ink/15 bg-paper px-3 py-2.5 text-[15px]" />
            </div>
          </div>
          <p className="hx-prose text-[11px]">Credits are recalculated for the new time — you're refunded the old and charged the new; anything over your allowance bills as a fee.</p>
          <div className="space-y-2.5 pt-1">
            <BigButton onClick={doSave} disabled={busy}><Check size={14} className="inline -mt-0.5 mr-2" />{busy ? 'Saving…' : 'Save new time'}</BigButton>
            <button onClick={() => { setEditing(false); setForm({ date: booking.date, startTime: booking.startTime, endTime: booking.endTime }) }}
              className="w-full min-h-[44px] font-heading uppercase tracking-nav text-[11px] text-portal-muted active:bg-bone">Back</button>
          </div>
        </div>
      )}

      {/* Started / ended / cancelled → no changes */}
      {!modifiable && phase !== 'active' && (
        <div className="border border-ink/10 p-4 text-center">
          <CalendarClock size={18} className="mx-auto text-portal-muted" strokeWidth={1.4} />
          <p className="hx-prose text-[12px] mt-2">
            {booking.status === 'Cancelled' ? 'This booking was cancelled.'
              : phase === 'past' ? 'This booking has ended.'
              : 'This booking has started and can no longer be changed.'}
          </p>
        </div>
      )}
      {phase === 'active' && !modifiable && (
        <p className="hx-prose text-[11px] text-center mt-4">A booking in progress can't be changed or cancelled.</p>
      )}

      {error && <div className="mt-4 text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
    </Sheet>
  )
}
