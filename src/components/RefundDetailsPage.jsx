import { useEffect, useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'

// Public, token-gated page where a function client gives us the account their
// security deposit should be returned to. Reached from the refund email; the
// token belongs to one credit note, so a link only ever exposes that refund.
const money = (v) => `$${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`

export default function RefundDetailsPage({ token }) {
  const [state, setState] = useState({ status: 'loading' })
  const [f, setF] = useState({ accountName: '', bsb: '', accountNumber: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/refund-bank-details', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'load' }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? 'This link is not valid.')
        setState({ status: 'ready', ...d })
        if (d.saved) setF((p) => ({ ...p, accountName: d.saved.accountName ?? '' }))
      })
      .catch((e) => setState({ status: 'error', error: e.message }))
  }, [token])

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const r = await fetch('/api/refund-bank-details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'save', bank: f }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not save those details.')
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (state.status === 'loading') return <Shell><p className="hx-prose">Loading…</p></Shell>
  if (state.status === 'error') return <Shell><p className="hx-prose">{state.error}</p></Shell>

  if (done || state.alreadyPaid) {
    return (
      <Shell>
        <span className="mx-auto h-12 w-12 border border-hexa-green/50 bg-hexa-green/10 flex items-center justify-center mb-5">
          <CheckCircle2 size={20} className="text-hexa-green" />
        </span>
        <h1 className="font-display font-extralight text-2xl text-ink text-center">
          {state.alreadyPaid ? 'This refund has already been paid' : 'Thank you — we have your details'}
        </h1>
        <p className="hx-prose text-center mt-3">
          {state.alreadyPaid
            ? 'Nothing further is needed. If it hasn’t reached your account, reply to our email and we’ll trace it.'
            : `We’ll transfer ${money(state.amount)} to that account. Please allow a few business days.`}
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <p className="hx-eyebrow text-center">Security deposit refund</p>
      <h1 className="font-display font-extralight text-[34px] text-ink text-center mt-2">{money(state.amount)}</h1>
      <p className="hx-prose text-center mt-2">{state.reference}</p>
      <p className="hx-prose text-[13px] mt-6">
        Hi {state.clientName || 'there'} — tell us where to send your deposit and we’ll transfer it.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="hx-eyebrow block mb-1.5">Account name</label>
          <input className="hx-input min-h-[48px]" value={f.accountName} required
            onChange={(e) => setF({ ...f, accountName: e.target.value })} placeholder="As it appears on the account" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="hx-eyebrow block mb-1.5">BSB</label>
            <input className="hx-input min-h-[48px]" value={f.bsb} required inputMode="numeric"
              onChange={(e) => setF({ ...f, bsb: e.target.value })} placeholder="000-000" />
          </div>
          <div>
            <label className="hx-eyebrow block mb-1.5">Account number</label>
            <input className="hx-input min-h-[48px]" value={f.accountNumber} required inputMode="numeric"
              onChange={(e) => setF({ ...f, accountNumber: e.target.value })} placeholder="12345678" />
          </div>
        </div>
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
        <button type="submit" disabled={busy}
          className="w-full min-h-[52px] bg-ink text-paper font-heading uppercase tracking-nav text-[11px] disabled:opacity-60">
          {busy ? 'Saving…' : 'Send my details'}
        </button>
      </form>

      <p className="hx-prose text-[11px] mt-5 flex items-start gap-2">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>We only ever need your BSB and account number for a refund — never a card number, password or ID. This link is private to your refund.</span>
      </p>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bone flex items-start justify-center p-5">
      <div className="bg-paper border border-ink/10 w-full max-w-md p-8 my-10">{children}</div>
    </div>
  )
}
