import SearchSelect from './SearchSelect.jsx'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, X, Trash2, Loader2, KeyRound, Check, Ban } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { bookingRate } from '../lib/dropIn.js'
import { bufferedWindow, isWeekendDate } from '../lib/functionBooking.js'
import { authHeaders } from '../lib/apiFetch.js'
import CancelBookingDialog from './CancelBookingDialog.jsx'

// The building's staffed hours. Outside them — any weekend, or a window that
// starts before open / ends after close — the lift won't take anyone to Level 4
// unless building management programs it, so someone has to ask them.
// Mirrors roomAccessWindow() in api/bookings/access-request.js.
const OPEN = '09:00', CLOSE = '17:00'
function needsBuildingAccess(b) {
  if (!b?.date || !b?.startTime || !b?.endTime || b.status === 'Cancelled') return null
  const { blockStart, blockEnd } = bufferedWindow(b.startTime, b.endTime)
  const weekend = isWeekendDate(b.date)
  if (!weekend && blockStart >= OPEN && blockEnd <= CLOSE) return null
  return { weekend, blockStart, blockEnd }
}

const STATUS_STYLE = {
  Confirmed: 'bg-green-100 text-green-800',
  Pending: 'bg-amber-100 text-amber-800',
  Cancelled: 'bg-red-100 text-red-700',
}
const SOURCE_STYLE = {
  Admin: 'bg-red-600 text-white',
  Portal: 'bg-blue-600 text-white',
  Website: 'bg-gray-800 text-white',
}
const today = () => new Date().toISOString().split('T')[0]
const EMPTY = { resourceId: '', memberId: '', companyId: '', date: today(), startTime: '09:00', endTime: '10:00', status: 'Confirmed', source: 'Admin', repeat: 'none' }

function hoursBetween(s, e) {
  const [sh, sm] = (s || '0:0').split(':').map(Number)
  const [eh, em] = (e || '0:0').split(':').map(Number)
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60)
}
function to12(t) {
  if (!t) return ''
  let [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}

// Asks Maxa OC + Pro Facility Management to unlock the front door and enable
// lift access for one after-hours booking. Manual on purpose: staff press it
// when they want it to go out.
//
// Exported because the Calendar's booking modal shows it too — a weekend
// booking is usually spotted on the calendar, not in the Bookings list.
export function UnlockButton({ booking }) {
  const need = needsBuildingAccess(booking)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  if (!need) return null

  const alreadySent = !!booking.accessRequestSentAt
  async function send() {
    const when = `${format(parseISO(booking.date), 'EEEE d MMM')}, ${to12(need.blockStart)} – ${to12(need.blockEnd)}`
    const lines = [
      'Ask building management to unlock the front door and lift for:',
      '',
      when,
      '',
      'Goes to Maxa OC and Pro Facility Management, cc the Hexa team.',
    ]
    if (alreadySent) lines.push('', 'A request has already been sent for this booking — this sends another.')
    if (!confirm(lines.join('\n'))) return
    setBusy(true); setError(''); setResult('')
    try {
      const r = await fetch('/api/bookings/access-request', {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify({ id: booking.id }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Could not send the request.')
      setResult(j.needed === false ? (j.note || 'Not needed.') : 'Unlock requested ✓')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button onClick={send} disabled={busy}
        title={need.weekend ? 'Weekend booking — the lift needs unlocking' : 'Runs outside staffed hours — the lift needs unlocking'}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold border disabled:opacity-40 ${
          alreadySent
            ? 'border-border text-muted-foreground hover:bg-muted/50'
            : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : alreadySent ? <Check size={12} /> : <KeyRound size={12} />}
        {busy ? 'Sending…' : alreadySent ? 'Resend unlock' : 'Request lift unlock'}
      </button>
      {alreadySent && !result && !error && (
        <span className="text-[10px] text-muted-foreground">
          Sent {format(parseISO(booking.accessRequestSentAt.split('T')[0]), 'd MMM')}
        </span>
      )}
      {result && <span className="text-[10px] text-green-600 max-w-[190px] text-right">{result}</span>}
      {error && <span className="text-[10px] text-red-600 max-w-[190px] text-right">{error}</span>}
    </div>
  )
}

export default function Bookings() {
  const { bookings = [], spaces = [], members = [], tenants = [], leases = [], addBooking, updateBooking, deleteBooking } = useOutletContext()
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [cancelling, setCancelling] = useState(null) // booking awaiting the cancel/refund dialog

  const resource = (id) => spaces.find((s) => s.id === id)
  const member = (id) => members.find((m) => m.id === id)
  const companyName = (id) => tenants.find((t) => t.id === id)?.businessName
  // Meeting rooms AND media/podcast studios — an admin booking a studio on
  // someone's behalf had no way to select it before.
  const rooms = spaces.filter((s) => ['meeting', 'studio', 'podcast'].includes(s.type))

  const rows = bookings
    .map((b) => {
      const room = resource(b.resourceId)
      const m = member(b.memberId)
      const hrs = hoursBetween(b.startTime, b.endTime)
      // The 30% discount follows an active MEMBERSHIP, not merely having a
      // company record — drop-ins and externals both pay the listed rate.
      const cost = room?.hourlyRate ? hrs * bookingRate(room, b.companyId || m?.companyId, leases) : 0
      return { ...b, room, memberName: m?.name, companyName: companyName(b.companyId), hrs, cost }
    })
    .filter((b) => {
      if (from && b.date < from) return false
      if (to && b.date > to) return false
      if (companyFilter && b.companyId !== companyFilter) return false
      return [b.reference, b.memberName, b.companyName, b.room?.unitNumber].join(' ').toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => (b.date + (b.startTime || '')).localeCompare(a.date + (a.startTime || '')))

  function submit() {
    if (!form.resourceId) return
    const m = members.find((x) => x.id === form.memberId)
    addBooking({ ...form, companyId: m?.companyId || form.companyId, createdBy: 'Admin' })
    setShowForm(false)
  }

  // Cancelling from the list uses the same dialog as the calendar, so a
  // card-paid booking can be refunded here too. Where the server refunded it,
  // it has already written the row and emailed the client — mirror it silently
  // rather than sending a second cancellation email over the top.
  //
  // NOTE this list has no credit reconciliation of its own (the calendar owns
  // that), so a non-refund cancel here only sets the status. Credit-paid
  // bookings are cancelled from the calendar, which returns the credits.
  function finishCancel(result) {
    const b = cancelling
    setCancelling(null)
    if (!b) return
    if (result.refunded) {
      updateBooking?.(b.id, result.booking ?? { status: 'Cancelled' }, { silent: true })
      if (result.message) window.alert(result.message)
      return
    }
    updateBooking?.(b.id, { status: 'Cancelled' })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
        <button onClick={() => { setForm({ ...EMPTY, date: today() }); setShowForm(true) }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"><Plus size={15} /> New Booking</button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Every room & space booking — made here, from the calendar, the website, or the members portal.</p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="text" placeholder="Search bookings…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[180px] max-w-xs border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm bg-card" />
        <span className="text-muted-foreground text-sm">–</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm bg-card" />
        <SearchSelect aria-label="Company" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm bg-card">
          <option value="">All companies</option>
          {tenants.map((t) => <option key={t.id} value={t.id} data-search={[t.email, t.contactName, t.phone].filter(Boolean).join(' ')}>{t.businessName}</option>)}
        </SearchSelect>
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} bookings</span>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {['Booking', 'Reference', 'Member', 'Resource', 'Summary', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No bookings yet. They’ll appear here from the calendar, the website and the members portal — or add one with <strong>New Booking</strong>.</td></tr>
            )}
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{b.date ? format(parseISO(b.date), 'd MMM yyyy') : '—'} · {to12(b.startTime)} – {to12(b.endTime)}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground">{b.hrs} hour{b.hrs !== 1 ? 's' : ''}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_STYLE[b.status] || 'bg-gray-100 text-gray-600'}`}>{b.status}</span>
                    {b.source && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SOURCE_STYLE[b.source] || 'bg-gray-200 text-gray-700'}`}>{b.source}</span>}
                    {b.repeat && b.repeat !== 'none' && <span className="text-[10px] text-muted-foreground">↻ {b.repeat}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.reference}</td>
                <td className="px-4 py-3"><div className="text-foreground">{b.memberName || '—'}</div><div className="text-xs text-muted-foreground">{b.companyName}</div></td>
                <td className="px-4 py-3"><div className="text-foreground">{b.room?.unitNumber || '—'}</div><div className="text-xs text-muted-foreground">Hexa Space</div></td>
                <td className="px-4 py-3 text-foreground">{b.cost ? `A$${b.cost.toLocaleString('en-AU')}` : 'Free'}</td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <UnlockButton booking={b} />
                    {b.status !== 'Cancelled' && (
                      <button onClick={() => setCancelling(b)} title="Cancel this booking (and refund it, if it was paid by card)"
                        className="p-1 rounded hover:bg-amber-50 text-muted-foreground hover:text-amber-600"><Ban size={14} /></button>
                    )}
                    <button onClick={() => { if (confirm('Delete this booking?')) deleteBooking(b.id) }} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <BookingModal form={form} setForm={setForm} rooms={rooms} members={members} tenants={tenants} onClose={() => setShowForm(false)} onSubmit={submit} />}

      {cancelling && (
        <CancelBookingDialog
          booking={cancelling}
          roomName={resource(cancelling.resourceId)?.unitNumber}
          onClose={() => setCancelling(null)}
          onDone={finishCancel}
        />
      )}
    </div>
  )
}

const ic = 'w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
function L({ label, children }) { return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>{children}</label> }

function BookingModal({ form, setForm, rooms, members, tenants, onClose, onSubmit }) {
  const up = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">New Booking</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <L label="Resource"><SearchSelect aria-label="Room or space" value={form.resourceId} onChange={up('resourceId')} className={ic}><option value="">Select room / space</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.unitNumber}{r.hourlyRate ? ` — $${r.hourlyRate}/hr` : ''}</option>)}</SearchSelect></L>
          <L label="Member"><SearchSelect aria-label="Member or contact" value={form.memberId} onChange={up('memberId')} className={ic}><option value="">Select member</option>{members.map((m) => <option key={m.id} value={m.id} data-search={[m.email, m.phone, m.search].filter(Boolean).join(' ')}>{m.name}{tenants.find((t) => t.id === m.companyId) ? ` — ${tenants.find((t) => t.id === m.companyId).businessName}` : ''}</option>)}</SearchSelect></L>
          <L label="Date"><input type="date" value={form.date} onChange={up('date')} className={ic} /></L>
          <div className="grid grid-cols-2 gap-4">
            <L label="Start"><input type="time" value={form.startTime} onChange={up('startTime')} className={ic} /></L>
            <L label="End"><input type="time" value={form.endTime} onChange={up('endTime')} className={ic} /></L>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <L label="Status"><select value={form.status} onChange={up('status')} className={ic}><option>Confirmed</option><option>Pending</option><option>Cancelled</option></select></L>
            <L label="Source"><select value={form.source} onChange={up('source')} className={ic}><option>Admin</option><option>Portal</option><option>Website</option></select></L>
            <L label="Repeat"><select value={form.repeat} onChange={up('repeat')} className={ic}><option value="none">None</option><option value="weekly">Weekly</option><option value="daily">Daily</option><option value="monthly">Monthly</option></select></L>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground border border-input rounded-md hover:bg-muted/50">Close</button>
          <button onClick={() => { if (!form.resourceId) return; onSubmit() }} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">Add</button>
        </div>
      </div>
    </div>
  )
}
