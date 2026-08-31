import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle, CreditCard, X } from 'lucide-react'
import { authHeaders } from '../lib/apiFetch.js'

// One door for cancelling a booking, whether or not money has to go back.
//
// WHY it is one door: staff cancel from wherever they spotted the booking — the
// calendar, usually — and that is the moment the refund decision is actually
// made. A separate "refunds" queue in Billing would mean cancelling here and
// remembering to go there, which is how a website booking got cancelled with the
// client's $739.20 still sitting in our account. So the refund rides on the
// cancel: the server is asked up front what CAN be refunded, and staff say yes
// or no to it in the same click.
//
// The dialog never decides policy itself — api/bookings/refund.js does, in
// preview mode, and this renders the answer.
export default function CancelBookingDialog({ booking, roomName, onClose, onDone }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [doRefund, setDoRefund] = useState(true)
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const r = await fetch('/api/bookings/refund', {
          method: 'POST', headers: await authHeaders(),
          body: JSON.stringify({ bookingId: booking.id, preview: true }),
        })
        const d = await r.json().catch(() => ({}))
        if (!live) return
        if (!r.ok) { setError(d.error ?? 'Could not check this booking for a refund.'); setPreview({ refundable: false, blockers: [] }); return }
        setPreview(d)
        setDoRefund(!!d.refundable)
      } catch {
        if (live) { setError('Could not reach the refund service — you can still cancel without refunding.'); setPreview({ refundable: false, blockers: [] }) }
      }
    })()
    return () => { live = false }
  }, [booking.id])

  const money = (v) => `$${Number(v || 0).toFixed(2)}`
  const refunding = !!preview?.refundable && doRefund
  const blocked = refunding && preview?.needsOverride && !override
  // Opened from Billing's "cancelled but not refunded" list, the booking is
  // already cancelled — there is nothing left to decide about the room, only
  // the money. Same dialog, different words.
  const refundOnly = booking.status === 'Cancelled'

  async function confirm() {
    setError('')
    // Not refunding — hand back to the caller, which does the ordinary local
    // cancel (credit reconcile, fee removal, member email).
    if (!refunding) { onDone({ refunded: false }); return }

    setBusy(true)
    try {
      const r = await fetch('/api/bookings/refund', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ bookingId: booking.id, reason: reason.trim(), override }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'The refund could not be processed.')
      onDone({ refunded: true, booking: d.booking, message: d.message })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-card rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{refundOnly ? 'Refund this booking?' : 'Cancel this booking?'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="text-sm text-foreground">
            <div className="font-medium">{roomName || booking.resourceName || 'Room'} · {String(booking.date || '').split('-').reverse().join('/')}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              {booking.startTime}–{booking.endTime}
              {booking.reference ? ` · ${booking.reference}` : ''}
              {booking.companyName ? ` · ${booking.companyName}` : ''}
            </div>
          </div>

          {!preview && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Checking what was paid…
            </div>
          )}

          {preview?.refundable && (
            <div className="border border-border rounded-md p-3 space-y-3">
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" checked={doRefund} onChange={(e) => setDoRefund(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="font-medium flex items-center gap-1.5"><CreditCard size={13} /> Refund {money(preview.amount)}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Back to {preview.card || 'the card they paid with'}, 5–10 business days.
                    {preview.invoiceNumber ? ` A credit note against ${preview.invoiceNumber} is raised so Xero reverses the income.` : ''}
                    {preview.clientEmail ? ` ${preview.clientEmail} is emailed automatically.` : ' No client email on file — tell them by hand.'}
                  </span>
                </span>
              </label>

              {preview.needsOverride && doRefund && (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-2">
                  <div className="flex gap-2 text-xs text-amber-900">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>This booking has been used — {preview.usedReason}. It is charged whether or not it is now cancelled.</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-amber-900">
                    <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                    Refund it anyway as a goodwill call
                  </label>
                </div>
              )}

              {doRefund && (
                <label className="block">
                  <span className="block text-xs font-medium text-muted-foreground mb-1">Reason (optional — kept on the booking and the credit note)</span>
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. client cancelled, outside the 24-hour window"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
                </label>
              )}
            </div>
          )}

          {preview && !preview.refundable && preview.blockers?.length > 0 && (
            <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground block mb-1">No card refund for this one</span>
              {preview.blockers.map((b, i) => <div key={i}>{b}</div>)}
            </div>
          )}

          {!refundOnly && (
            <p className="text-xs text-muted-foreground">
              Cancelling frees the room straight away — and, for North/South/West, the rest of the Function Space with it.
              Any door access granted for the booking is withdrawn automatically.
            </p>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-xs">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-foreground border border-input rounded-md hover:bg-muted/50 disabled:opacity-40">
            {refundOnly ? 'Close' : 'Keep booking'}
          </button>
          <button onClick={confirm} disabled={busy || !preview || blocked || (refundOnly && !refunding)}
            className="px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {refunding ? (refundOnly ? `Refund ${money(preview.amount)}` : `Cancel & refund ${money(preview.amount)}`) : 'Cancel booking'}
          </button>
        </div>
      </div>
    </div>
  )
}
