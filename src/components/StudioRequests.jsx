import { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Mic, Check, X, CalendarClock, AlertTriangle, Clock, User, Building2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { authHeaders } from '../lib/apiFetch.js'
import {
  isRequestGated, studioRequestState, STUDIO_STATE_STYLE, questionnaireRows,
  recordingMinutesFor, staleRequests, CONFIRM_SLA, RETENTION_DAYS, creditsAllowed,
  gbForHours,
} from '../lib/studio.js'
import { bookingRate } from '../lib/dropIn.js'
import { bookingFeeName, round2 } from '../lib/credits.js'

// The studio request queue.
//
// Approving is the pivotal action in the whole podcast-studio flow: it is the
// one event that turns a held slot into a real session — door access (which is
// granted only to Confirmed bookings), the confirmation + guest-guide emails,
// and the charge all hang off it. Nothing here approves automatically; a human
// checks an operator can cover the slot first.

const to12 = (t) => { let [h, m] = String(t || '0:0').split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap}` }
const hoursBetween = (s, e) => {
  const [sh, sm] = (s || '0:0').split(':').map(Number)
  const [eh, em] = (e || '0:0').split(':').map(Number)
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60)
}

export default function StudioRequests() {
  const ctx = useOutletContext()
  const { bookings = [], spaces = [], members = [], tenants = [], leases = [], updateBooking } = ctx
  const [tab, setTab] = useState('pending') // pending | upcoming | all
  const [selected, setSelected] = useState(null)

  const studioSpaces = useMemo(() => spaces.filter(isRequestGated), [spaces])
  const studioIds = useMemo(() => new Set(studioSpaces.map((s) => s.id)), [studioSpaces])

  const rows = useMemo(() => bookings
    .filter((b) => studioIds.has(b.resourceId))
    .map((b) => ({
      ...b,
      state: studioRequestState(b),
      room: spaces.find((s) => s.id === b.resourceId),
      member: members.find((m) => m.id === b.memberId),
      company: tenants.find((t) => t.id === b.companyId),
      hrs: hoursBetween(b.startTime, b.endTime),
    }))
    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || ''))),
    [bookings, studioIds, spaces, members, tenants])

  const todayStr = new Date().toISOString().split('T')[0]
  const pending = rows.filter((r) => r.state === 'pending')
  const upcoming = rows.filter((r) => r.state === 'approved' && r.date >= todayStr)
  const stale = staleRequests(bookings, spaces, 48)
  const visible = tab === 'pending' ? pending : tab === 'upcoming' ? upcoming : rows

  if (studioSpaces.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Studio Requests</h1>
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Mic size={22} className="mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            No podcast studio is set up yet. Add a space with type <strong>Podcast Room</strong> under
            {' '}<a href="/spaces" className="underline">Spaces</a> and its session requests will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Mic size={20} /> Studio Requests</h1>
        {pending.length > 0 && (
          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
            {pending.length} awaiting decision
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        The podcast studio is staff-operated, so every session is requested and confirmed here — never booked
        automatically. Approving grants door access and sends the confirmation; target turnaround is {CONFIRM_SLA}.
      </p>

      {stale.length > 0 && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 mb-4 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>{stale.length} request{stale.length > 1 ? 's have' : ' has'} been waiting more than 48 hours.</strong>{' '}
            Someone is holding a slot without an answer — approve, propose another time, or decline so they can plan.
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        {[['pending', `Awaiting decision (${pending.length})`], ['upcoming', `Confirmed & upcoming (${upcoming.length})`], ['all', `All (${rows.length})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {['Session', 'Requested by', 'Recording', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                {tab === 'pending' ? 'Nothing waiting — every request has been answered.' : 'No sessions here yet.'}
              </td></tr>
            )}
            {visible.map((r) => {
              const style = STUDIO_STATE_STYLE[r.state]
              const q = r.studio?.questionnaire
              return (
                <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{r.date ? format(parseISO(r.date), 'EEE d MMM yyyy') : '—'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{to12(r.startTime)} – {to12(r.endTime)} · {r.hrs} hr{r.hrs !== 1 ? 's' : ''} · {r.room?.unitNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{r.memberName || r.member?.name || r.studio?.contact?.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.companyName || r.company?.businessName || (r.source === 'Website' ? 'Website enquiry' : '—')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{q?.recordingType || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {q?.peopleOnCamera ? `${q.peopleOnCamera} on camera` : ''}
                      {q?.expectedRecordingMins ? ` · ${q.expectedRecordingMins} min` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${style.cls}`}>{style.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">Review →</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <RequestDrawer
          request={selected} ctx={ctx} leases={leases}
          onClose={() => setSelected(null)}
          onUpdated={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ── Review drawer ────────────────────────────────────────────────────────────

function RequestDrawer({ request: r, ctx, leases, onClose, onUpdated }) {
  const { updateBooking, bookings = [], spaces = [], addFee, updateTenant } = ctx
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState(null) // null | 'decline' | 'propose'
  const [reason, setReason] = useState('')
  const [slot, setSlot] = useState({ date: r.date, startTime: r.startTime, endTime: r.endTime })

  const q = r.studio?.questionnaire
  const accepted = r.studio?.policyAccepted
  const hrs = hoursBetween(r.startTime, r.endTime)
  const rate = bookingRate(r.room, r.companyId, leases)
  const wantMins = Number(q?.expectedRecordingMins) || 0
  const fits = wantMins <= recordingMinutesFor(hrs)

  // Any other studio booking already holding this slot (excluding this one).
  const clash = bookings.find((b) => b.id !== r.id && b.resourceId === r.resourceId &&
    b.date === slot.date && b.status !== 'Cancelled' &&
    (slot.startTime < b.endTime && b.startTime < slot.endTime))

  async function notify(kind, extra = {}) {
    try {
      await fetch('/api/studio/notify-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ bookingId: r.id, kind, ...extra }),
      })
    } catch { /* email is best-effort — the decision itself is already saved */ }
  }

  // Charging happens HERE, not at request time — nobody is billed for a session
  // we might decline.
  //
  // The studio takes NO CREDITS. Credits are an allowance for rooms; a studio
  // session is staffed labour, so it is always billed as cash on the month-end
  // invoice and the company's credit balance is never touched (see
  // creditsAllowed in lib/studio.js). A requester with no company record (a
  // website request) is quoted separately, so nothing is raised for them here.
  function raiseCharge() {
    if (!r.companyId || !r.room) return null
    if (creditsAllowed(r.room)) return null // not reachable today; guards a future widening
    const price = round2(rate * hrs)
    if (price <= 0 || !addFee) return null

    const fee = addFee({
      name: bookingFeeName({
        roomName: r.room.unitNumber, rate, date: r.date,
        startTime: r.startTime, endTime: r.endTime, usedCredits: 0,
      }),
      type: 'Booking Fee', memberId: r.memberId ?? null, companyId: r.companyId,
      date: r.date || new Date().toISOString().split('T')[0],
      price,
      status: 'Not Paid',
      notes: `Podcast studio session approved · ${hrs}h @ A$${rate}/hr · credits not applicable`,
    })
    return { creditsUsed: 0, paidBy: 'fee', feeId: fee?.id ?? null }
  }

  async function approve() {
    setBusy('approve'); setError('')
    try {
      if (clash) throw new Error(`That slot clashes with another studio session (${to12(clash.startTime)}–${to12(clash.endTime)}). Propose a different time instead.`)
      const charge = raiseCharge()
      updateBooking(r.id, {
        status: 'Confirmed',
        ...(charge ?? {}),
        studio: {
          ...(r.studio ?? {}),
          approval: { approvedAt: new Date().toISOString(), approvedBy: 'Admin' },
        },
      })
      // Confirmation + the guest recording guide, in one send.
      await notify('approved')
      onUpdated()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function decline() {
    if (!reason.trim()) return setError('Please give a reason — it goes in the email so they know what to do next.')
    setBusy('decline'); setError('')
    try {
      updateBooking(r.id, {
        // Cancelling frees the slot for someone else immediately.
        status: 'Cancelled',
        cancelledAt: new Date().toISOString(),
        studio: {
          ...(r.studio ?? {}),
          approval: { declinedAt: new Date().toISOString(), declinedBy: 'Admin', reason: reason.trim() },
        },
      })
      await notify('declined', { reason: reason.trim() })
      onUpdated()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function propose() {
    setBusy('propose'); setError('')
    try {
      if (clash) throw new Error('That time clashes with another studio session — pick another.')
      if (hoursBetween(slot.startTime, slot.endTime) <= 0) throw new Error('The end time must be after the start time.')
      updateBooking(r.id, {
        date: slot.date, startTime: slot.startTime, endTime: slot.endTime,
        status: 'Pending', // still theirs to accept — we've only moved it
        studio: { ...(r.studio ?? {}), proposedAt: new Date().toISOString() },
      })
      await notify('rescheduled')
      onUpdated()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Studio session request</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STUDIO_STATE_STYLE[r.state].cls}`}>{STUDIO_STATE_STYLE[r.state].label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {r.reference} · requested {r.studio?.requestedAt ? format(parseISO(r.studio.requestedAt.split('T')[0]), 'd MMM yyyy') : '—'} from {r.studio?.requestSource || r.source}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* The slot */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Session</h3>
            <div className="bg-muted/40 border border-border rounded-lg p-4 grid sm:grid-cols-2 gap-3 text-sm">
              <Field icon={CalendarClock} label="When" value={`${r.date ? format(parseISO(r.date), 'EEE d MMM yyyy') : '—'} · ${to12(r.startTime)} – ${to12(r.endTime)}`} />
              <Field icon={Clock} label="Length" value={`${hrs} hour${hrs !== 1 ? 's' : ''} · about ${recordingMinutesFor(hrs)} min recording`} />
              <Field icon={User} label="Requested by" value={r.memberName || r.member?.name || r.studio?.contact?.name || '—'} sub={r.member?.email || r.studio?.contact?.email} />
              <Field icon={Building2} label="Company" value={r.companyName || r.company?.businessName || (r.source === 'Website' ? 'Website (no account)' : '—')} sub={rate
                ? `A$${rate}/hr · ${hrs} hr = A$${(rate * hrs).toLocaleString('en-AU')} + GST${r.companyId ? ' · billed on the month-end invoice, no credits' : ' · quote separately'}`
                : 'Rate not set on the space'} />
            </div>
            {!fits && (
              <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                They've asked for {wantMins} minutes of recording but this booking only allows about {recordingMinutesFor(hrs)}.
                Consider proposing a longer session.
              </p>
            )}
            {clash && (
              <p className="flex items-start gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                This clashes with another studio session at {to12(clash.startTime)}–{to12(clash.endTime)}.
              </p>
            )}
          </section>

          {/* Questionnaire */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pre-session questionnaire</h3>
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {questionnaireRows(q).map(([k, v]) => (
                <div key={k} className="flex gap-4 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground w-44 shrink-0">{k}</span>
                  <span className="text-foreground">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use this to prep: card set, seating, mic count and lighting are all decided from these answers before the client arrives.
              {q?.ownCards === true
                ? ' They are bringing their own cards — return them at the end.'
                : ` Confirm the card set and what drive they're bringing in the pre-booking call — ${hrs}h of recording is roughly ${gbForHours(hrs)} GB. Working copy kept ${RETENTION_DAYS} days.`}
            </p>
          </section>

          {/* Policy acceptance */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Policy</h3>
            {accepted?.at ? (
              <p className="text-sm text-foreground bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <Check size={13} className="inline -mt-0.5 mr-1.5 text-green-700" />
                Accepted by <strong>{accepted.name || 'the requester'}</strong> ({accepted.version}) on{' '}
                {format(parseISO(accepted.at.split('T')[0]), 'd MMM yyyy')}.
              </p>
            ) : (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                No policy acceptance recorded — this request predates the policy, or was created by an admin. Confirm the
                terms with the client before approving.
              </p>
            )}
          </section>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

          {/* Actions */}
          {r.state === 'pending' && mode === null && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={approve} disabled={!!busy}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                <Check size={15} /> {busy === 'approve' ? 'Approving…' : 'Approve & confirm'}
              </button>
              <button onClick={() => { setMode('propose'); setError('') }} disabled={!!busy}
                className="flex items-center gap-2 border border-input px-4 py-2 rounded-md text-sm font-medium hover:bg-muted/50">
                <CalendarClock size={15} /> Propose another time
              </button>
              <button onClick={() => { setMode('decline'); setError('') }} disabled={!!busy}
                className="flex items-center gap-2 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50">
                <X size={15} /> Decline
              </button>
            </div>
          )}

          {mode === 'propose' && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Propose another time</p>
              <p className="text-xs text-muted-foreground">The request stays pending and the client is emailed the new time. It only becomes confirmed once you approve it.</p>
              <div className="grid grid-cols-3 gap-3">
                <label className="block"><span className="block text-xs text-muted-foreground mb-1">Date</span>
                  <input type="date" value={slot.date} onChange={(e) => setSlot({ ...slot, date: e.target.value })} className="w-full border border-input rounded-md px-3 py-2 text-sm" /></label>
                <label className="block"><span className="block text-xs text-muted-foreground mb-1">Start</span>
                  <input type="time" value={slot.startTime} onChange={(e) => setSlot({ ...slot, startTime: e.target.value })} className="w-full border border-input rounded-md px-3 py-2 text-sm" /></label>
                <label className="block"><span className="block text-xs text-muted-foreground mb-1">End</span>
                  <input type="time" value={slot.endTime} onChange={(e) => setSlot({ ...slot, endTime: e.target.value })} className="w-full border border-input rounded-md px-3 py-2 text-sm" /></label>
              </div>
              <div className="flex gap-2">
                <button onClick={propose} disabled={!!busy} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                  {busy === 'propose' ? 'Sending…' : 'Send new time'}
                </button>
                <button onClick={() => setMode(null)} className="border border-input px-4 py-2 rounded-md text-sm">Back</button>
              </div>
            </div>
          )}

          {mode === 'decline' && (
            <div className="border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Decline this request</p>
              <p className="text-xs text-muted-foreground">The slot is freed straight away and the client is emailed your reason, so give them something they can act on.</p>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. No operator available that morning — we could do Thursday 10am or Friday any time before 2pm."
                className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none" />
              <div className="flex gap-2">
                <button onClick={decline} disabled={!!busy} className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {busy === 'decline' ? 'Declining…' : 'Decline & notify'}
                </button>
                <button onClick={() => setMode(null)} className="border border-input px-4 py-2 rounded-md text-sm">Back</button>
              </div>
            </div>
          )}

          {r.state === 'approved' && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-900">
              <Check size={14} className="inline -mt-0.5 mr-1.5" />
              Confirmed{r.studio?.approval?.approvedAt ? ` on ${format(parseISO(r.studio.approval.approvedAt.split('T')[0]), 'd MMM yyyy')}` : ''}.
              Door access is scheduled automatically and the client has their confirmation and recording guide.
            </div>
          )}
          {r.state === 'declined' && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-900">
              Declined{r.studio?.approval?.reason ? ` — "${r.studio.approval.reason}"` : ''}.
            </div>
          )}
          {r.state === 'cancelled' && (
            <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground">
              This session was cancelled.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex gap-2.5">
      <Icon size={15} className="text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}
