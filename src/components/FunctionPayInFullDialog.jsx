import { useEffect, useState } from 'react'
import { Loader2, CreditCard, X, AlertTriangle } from 'lucide-react'
import { authHeaders } from '../lib/apiFetch.js'

// Take the whole function booking on the card, now, instead of running the
// deposit cycle. The server prices it, re-checks the dates and charges — this
// only renders the answer and confirms the intent; see
// api/function-bookings/pay-and-confirm.js for why the order matters.
export default function FunctionPayInFullDialog({ booking, onClose, onDone }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const r = await fetch('/api/function-bookings/pay-and-confirm', {
          method: 'POST', headers: await authHeaders(),
          body: JSON.stringify({ id: booking.id, preview: true }),
        })
        const d = await r.json().catch(() => ({}))
        if (!live) return
        if (!r.ok) { setError(d.error ?? 'Could not price this booking.'); setPreview({ payable: false }); return }
        setPreview(d)
      } catch {
        if (live) { setError('Could not reach the payment service.'); setPreview({ payable: false }) }
      }
    })()
    return () => { live = false }
  }, [booking.id])

  const money = (v) => `$${(Number(v) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
  const b = preview?.breakdown

  async function confirm() {
    setError('')
    setBusy(true)
    try {
      const r = await fetch('/api/function-bookings/pay-and-confirm', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ id: booking.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'The payment could not be taken.')
      onDone(d)
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
          <h2 className="font-semibold text-foreground">Take payment in full</h2>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="text-sm text-foreground">
            <div className="font-medium">{booking.eventName || 'Function'}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              {preview?.sessionsLabel || '—'}{booking.ref ? ` · ${booking.ref}` : ''}
            </div>
          </div>

          {!preview && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Pricing and checking the dates…
            </div>
          )}

          {b && (
            <div className="border border-border rounded-md divide-y divide-border text-sm">
              <Row label={`Venue hire${b.sessions > 1 ? ` — ${b.sessions} sessions` : ''}, ${b.hours} hrs`} value={money(b.hire)} />
              <Row label="GST" value={money(b.gst)} />
              <Row label="Security deposit (refundable)" value={money(b.securityDeposit)} />
              <Row label="Charge now" value={money(b.fullDue)} strong />
            </div>
          )}

          {preview?.payable && (
            <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground flex gap-2">
              <CreditCard size={14} className="shrink-0 mt-0.5" />
              <span>
                Charged to {preview.card} on file. The 50% deposit and balance invoices are voided and replaced by
                one paid invoice, the sessions go on the calendar, and nothing is left to chase.
                {preview.clientEmail ? ` ${preview.clientEmail} gets the confirmation.` : ' No client email on file — tell them by hand.'}
              </span>
            </div>
          )}

          {preview && !preview.payable && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-900 flex gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{preview.reason || error || 'This booking cannot be paid in full right now.'}</span>
            </div>
          )}

          {error && preview?.payable && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-xs">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-foreground border border-input rounded-md hover:bg-muted/50 disabled:opacity-40">Close</button>
          <button onClick={confirm} disabled={busy || !preview?.payable}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {b ? `Charge ${money(b.fullDue)} & confirm` : 'Charge & confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span className={strong ? 'text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  )
}
