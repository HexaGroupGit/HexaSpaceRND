import { useEffect, useState } from 'react'

// Public self-serve notice page (/give-notice/<token>). Loads the lease behind
// the token, shows the computed last day, and records the notice on confirm.
// Deliberately NOT one-click: the tenant sees their vacate date and confirms,
// so a mis-click or an email link-preview bot can't end a membership.
const dmy = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '—')

export default function GiveNoticePage({ token }) {
  const [state, setState] = useState('loading') // loading | active | noticed | ended | done | invalid
  const [info, setInfo] = useState(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/renewal-notice?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setInfo(d); setState(d.state === 'active' ? 'active' : d.state === 'noticed' ? 'noticed' : 'ended') })
      .catch(() => setState('invalid'))
  }, [token])

  async function confirm() {
    setSubmitting(true); setErr('')
    try {
      const r = await fetch('/api/renewal-notice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'Something went wrong. Please email info@hexaspace.com.au.'); return }
      setInfo((p) => ({ ...p, ...d })); setState('done')
    } catch { setErr('Something went wrong. Please email info@hexaspace.com.au.') } finally { setSubmitting(false) }
  }

  const Shell = ({ children }) => (
    <div className="min-h-screen bg-[#f4f2ee] flex items-center justify-center p-5 font-sans text-[#1a1a1a]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-black text-white px-7 py-5">
          <div className="text-lg font-black tracking-[0.2em]">HEXA SPACE</div>
          <div className="text-[11px] tracking-[0.16em] uppercase text-white/60 mt-0.5">Membership notice</div>
        </div>
        <div className="px-7 py-7">{children}</div>
      </div>
    </div>
  )

  if (state === 'loading') return <Shell><p className="text-sm text-gray-500">Loading…</p></Shell>
  if (state === 'invalid') return <Shell><h1 className="text-xl font-bold mb-2">Link not valid</h1><p className="text-sm text-gray-600">This notice link is no longer valid. If you'd like to give notice, please email <a className="underline" href="mailto:info@hexaspace.com.au">info@hexaspace.com.au</a>.</p></Shell>
  if (state === 'ended') return <Shell><h1 className="text-xl font-bold mb-2">Already ended</h1><p className="text-sm text-gray-600">This membership has already ended. Nothing more to do — reach us at <a className="underline" href="mailto:info@hexaspace.com.au">info@hexaspace.com.au</a> with any questions.</p></Shell>

  const detail = (k, v) => (
    <div className="flex justify-between py-2.5 border-t border-gray-100 text-sm">
      <span className="text-[11px] tracking-[0.16em] uppercase text-gray-400 pt-0.5">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  )

  if (state === 'noticed' || state === 'done') {
    return (
      <Shell>
        <h1 className="text-xl font-bold mb-2">{state === 'done' ? 'Notice received' : 'Notice already on file'}</h1>
        <p className="text-sm text-gray-600 mb-4">
          {state === 'done'
            ? 'Thank you — your notice has been recorded. Your membership will continue until your last day below, and we\'ll be in touch about handover.'
            : 'We already have a notice on file for this membership. Here are the details.'}
        </p>
        <div className="mb-1">
          {detail('Business', info?.business || '—')}
          {detail('Contract', info?.contract || '—')}
          {info?.unit ? detail('Space', info.unit) : null}
          {detail('Last day', dmy(info?.vacateDate))}
        </div>
        <p className="text-xs text-gray-400 mt-4">Changed your mind? Email <a className="underline" href="mailto:info@hexaspace.com.au">info@hexaspace.com.au</a> and we'll help.</p>
      </Shell>
    )
  }

  // state === 'active' — confirm the notice
  return (
    <Shell>
      <h1 className="text-xl font-bold mb-2">Give notice</h1>
      <p className="text-sm text-gray-600 mb-4">
        You're letting us know you <strong>won't be renewing</strong>. Your membership stays active until your last day below — you won't be billed beyond it.
      </p>
      <div className="mb-4">
        {detail('Business', info?.business || '—')}
        {detail('Contract', info?.contract || '—')}
        {info?.unit ? detail('Space', info.unit) : null}
        {detail('Your last day', dmy(info?.vacateDate))}
      </div>
      <label className="block text-[11px] tracking-[0.16em] uppercase text-gray-400 mb-1.5">Anything we should know? (optional)</label>
      <textarea
        rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for leaving, feedback, or a handover note…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/10 mb-4"
      />
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      <button
        onClick={confirm} disabled={submitting}
        className="w-full bg-black text-white text-sm font-medium rounded-lg py-3 hover:bg-black/90 disabled:opacity-50"
      >
        {submitting ? 'Recording…' : `Confirm notice — last day ${dmy(info?.vacateDate)}`}
      </button>
      <p className="text-xs text-gray-400 mt-3 text-center">Didn't mean to open this? Just close the page — nothing changes until you confirm.</p>
    </Shell>
  )
}
