import { useEffect, useState } from 'react'

const money = (n) => `$${Number(n || 0).toLocaleString('en-AU')}`

// Public upgrade page: an existing member reviews the larger suite(s) we've
// offered against what they hold today, picks a changeover date and accepts →
// new licence agreement raised + sent to e-sign, old contract wound down.
// No company-details form here (unlike the lead proposal) — we already have them.
export default function UpgradeAccept({ token }) {
  const [state, setState] = useState('loading') // loading | review | done | invalid | expired | declined | superseded | closed
  const [data, setData] = useState(null)
  const [sel, setSel] = useState([])
  const [selParking, setSelParking] = useState([])
  const [changeover, setChangeover] = useState('')
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const toggle = (id, list, setList) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  useEffect(() => {
    fetch(`/api/upgrade?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setState('invalid'); return }
        if (['expired', 'declined', 'superseded'].includes(d.status)) { setState(d.status); return }
        // The contract this offer sits on has ended, been given notice, or has
        // already been superseded — the offer can't be acted on any more.
        if (['ended', 'leaving', 'missing'].includes(d.status)) { setState('closed'); return }
        setData(d)
        setChangeover(d.changeoverDate || d.today || '')
        if ((d.offices || []).length === 1) setSel([d.offices[0].spaceId])
        if (d.status === 'accepted') { setResult({ alreadyAccepted: true }); setState('done'); return }
        setState('review')
      })
      .catch(() => setState('invalid'))
  }, [token])

  async function decline() {
    const reason = window.prompt("No problem. Anything you'd like us to know? (optional)")
    if (reason === null) return
    try {
      const res = await fetch('/api/upgrade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErr(d.error || 'Something went wrong. Please try again.')
        return
      }
      setState('declined')
    } catch {
      setErr('Something went wrong. Please try again.')
    }
  }

  async function accept() {
    if (sel.length === 0) { setErr('Please choose a suite.'); return }
    if (!changeover) { setErr('Please choose a changeover date.'); return }
    setSubmitting(true); setErr('')
    try {
      const res = await fetch('/api/upgrade-accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, officeIds: sel, parkingIds: selParking, changeoverDate: changeover }),
      })
      const d = await res.json()
      if (res.status === 410) { setState(d.superseded ? 'superseded' : 'expired'); return }
      if (!res.ok) { setErr(d.error || 'Something went wrong. Please try again.'); setSubmitting(false); return }
      setResult(d); setState('done')
    } catch { setErr('Something went wrong. Please try again.'); setSubmitting(false) }
  }

  const offices = data?.offices || []
  const parking = data?.parking || []
  const chosen = [...offices.filter((o) => sel.includes(o.spaceId)), ...parking.filter((o) => selParking.includes(o.spaceId))]
  const total = chosen.reduce((s, o) => s + Number(o.price || 0), 0)
  const currentRent = Number(data?.current?.rent || 0)
  const delta = total - currentRent

  const TERM_LABEL = { mtm: 'Month-to-month', '6mo': '6-month term', '12mo': '12-month term' }
  const termMonths = data?.term === '6mo' ? 6 : 12
  const endFrom = (s) => {
    if (!s) return ''
    const d = new Date(`${s}T00:00:00`)
    d.setMonth(d.getMonth() + termMonths); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }
  const fmtD = (s) => { try { return new Date(`${s}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return s } }
  const dayBefore = (s) => { if (!s) return ''; const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] }

  const Closed = ({ eyebrow, children }) => (
    <div className="p-10 text-center space-y-3">
      <div className="hx-eyebrow">{eyebrow}</div>
      <p className="hx-prose text-[14px]">{children}</p>
      <p className="hx-prose text-[13px] text-portal-muted">info@hexaspace.com.au</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-bone font-body text-ink py-10 px-4">
      <div className="max-w-xl mx-auto">
        <header className="bg-charcoal text-paper px-8 py-8 rounded-t-lg">
          <div className="font-heading uppercase tracking-[0.3em] text-sm">Hexa&nbsp;Space</div>
          <div className="font-display font-extralight text-3xl mt-3">Room to grow</div>
        </header>

        <div className="bg-paper border border-ink/10 border-t-0 rounded-b-lg">
          {state === 'loading' && <div className="p-10 text-center hx-prose">Loading your offer…</div>}
          {state === 'invalid' && <Closed eyebrow="Link not valid">This upgrade link is invalid or has expired. Please contact us for a new one.</Closed>}
          {state === 'expired' && <Closed eyebrow="Offer expired">This offer has expired — contact us and we&apos;ll refresh it with current availability and pricing.</Closed>}
          {state === 'superseded' && <Closed eyebrow="Newer offer available">This offer has been updated since this link was sent — please use the link in our most recent email, or contact us and we&apos;ll resend it.</Closed>}
          {state === 'declined' && <Closed eyebrow="Offer declined">No problem — thanks for letting us know. Your current contract carries on exactly as it is. If anything changes, we&apos;d love to hear from you.</Closed>}
          {state === 'closed' && <Closed eyebrow="No longer available">This offer relates to a contract that has since changed, so it can&apos;t be accepted here. Get in touch and we&apos;ll sort out the right option.</Closed>}

          {state === 'review' && data && (
            <div className="p-8 space-y-6">
              <p className="hx-prose text-[15px]">
                Hi {data.contactName || 'there'}, {data.message ? data.message : `here's what we can offer ${data.businessName || 'you'} if you're ready for more space.`}
              </p>

              {/* What they hold today — the anchor for every number below. */}
              <div className="bg-bone border border-ink/10 px-4 py-3">
                <div className="hx-eyebrow mb-1.5">Your suite today</div>
                <div className="flex items-baseline justify-between">
                  <span className="font-heading uppercase tracking-nav text-[12px] text-ink">
                    {data.current?.unit || '—'}{data.current?.pax ? ` · ${data.current.pax} pax` : ''}
                  </span>
                  <span className="font-body text-[15px] text-ink tabular-nums">{money(currentRent)}<span className="text-portal-muted">/mo</span></span>
                </div>
              </div>

              <div>
                <div className="hx-eyebrow mb-2">{offices.length > 1 ? 'Choose your new suite' : 'Your new suite'}</div>
                <div className="space-y-2">
                  {offices.map((o) => {
                    const on = sel.includes(o.spaceId)
                    const meta = [o.level, o.pax ? `${o.pax} pax` : '', o.note].filter(Boolean).join(' · ')
                    const step = Number(o.price || 0) - currentRent
                    return (
                      <button type="button" key={o.spaceId} onClick={() => toggle(o.spaceId, sel, setSel)}
                        className={`w-full flex items-center gap-3 text-left border p-3 transition-colors ${on ? 'border-hexa-green bg-bone' : 'border-ink/15 bg-paper hover:border-ink/40'}`}>
                        <span className={`h-4 w-4 shrink-0 border ${on ? 'bg-hexa-green border-hexa-green' : 'border-ink/30'}`} />
                        <span className="flex-1 min-w-0">
                          <span className="block font-heading uppercase tracking-nav text-[12px] text-ink">{o.unit}</span>
                          {meta && <span className="block hx-prose text-[12px] text-portal-muted mt-0.5">{meta}</span>}
                        </span>
                        <span className="text-right">
                          <span className="block font-body text-[15px] text-ink tabular-nums">{money(o.price)}<span className="text-portal-muted">/mo</span></span>
                          {currentRent > 0 && step !== 0 && (
                            <span className="block hx-prose text-[11px] text-portal-muted tabular-nums">{step > 0 ? '+' : '−'}{money(Math.abs(step))} vs today</span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {offices.length > 1 && <p className="hx-prose text-[12px] text-portal-muted mt-2">Pick the one you&apos;d like — or select more than one to take several suites.</p>}

                {parking.length > 0 && (
                  <>
                    <div className="hx-eyebrow mb-2 mt-5">Optional parking</div>
                    <div className="space-y-2">
                      {parking.map((o) => {
                        const on = selParking.includes(o.spaceId)
                        return (
                          <button type="button" key={o.spaceId} onClick={() => toggle(o.spaceId, selParking, setSelParking)}
                            className={`w-full flex items-center gap-3 text-left border p-3 transition-colors ${on ? 'border-hexa-green bg-bone' : 'border-ink/15 bg-paper hover:border-ink/40'}`}>
                            <span className={`h-4 w-4 shrink-0 border ${on ? 'bg-hexa-green border-hexa-green' : 'border-ink/30'}`} />
                            <span className="flex-1 font-heading uppercase tracking-nav text-[12px] text-ink">Car parking {o.unit}</span>
                            <span className="font-body text-[15px] text-ink tabular-nums">{money(o.price)}<span className="text-portal-muted">/mo</span></span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}

                <div className="flex items-baseline justify-between border-t border-ink/10 mt-4 pt-4">
                  <span className="font-heading uppercase tracking-nav text-[11px] text-ink">New total / month (ex GST)</span>
                  <span className="font-display text-2xl">{total ? money(total) : '—'}</span>
                </div>
                {total > 0 && currentRent > 0 && (
                  <p className="hx-prose text-[12px] text-portal-muted text-right mt-1 tabular-nums">
                    {delta === 0 ? 'Same as your current rent' : `${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}/month compared with today`}
                  </p>
                )}
              </div>

              <div className="bg-bone border border-ink/10 px-4 py-3">
                <div className="flex items-baseline justify-between"><span className="hx-prose text-[13px] text-portal-muted">Term</span><span className="font-heading uppercase tracking-nav text-[11px] text-ink">{TERM_LABEL[data.term] || '12-month term'}</span></div>
                {data.freeMonths > 0 && <div className="flex items-baseline justify-between mt-1.5"><span className="hx-prose text-[13px] text-portal-muted">Included</span><span className="font-heading uppercase tracking-nav text-[11px] text-hexa-green">Final {data.freeMonths} month{data.freeMonths > 1 ? 's' : ''} rent-free</span></div>}
                <div className="flex items-baseline justify-between mt-1.5"><span className="hx-prose text-[13px] text-portal-muted">Security deposit</span><span className="font-heading uppercase tracking-nav text-[11px] text-ink">Carried over</span></div>
              </div>

              <div>
                <div className="hx-eyebrow mb-1.5">Changeover date</div>
                <input type="date" value={changeover} min={data.today} onChange={(e) => setChangeover(e.target.value)} className="hx-input" />
                {changeover && (
                  <p className="hx-prose text-[12px] text-portal-muted mt-2">
                    Your new agreement runs {fmtD(changeover)} → {fmtD(endFrom(changeover))}. {data.current?.unit || 'Your current suite'} stays yours until {fmtD(dayBefore(changeover))}, then closes off automatically — nothing for you to cancel.
                  </p>
                )}
              </div>

              <p className="hx-prose text-[12px] text-portal-muted">
                Valid for {data.validityDays} days. Pricing excludes GST and is subject to a signed licence agreement. Your deposit transfers across — if the new suite calls for a larger one, we&apos;ll invoice only the difference.
              </p>

              {err && <p className="hx-prose text-[13px] text-red-700">{err}</p>}
              <button onClick={accept} disabled={submitting} className="hx-btn w-full disabled:opacity-50">
                {submitting ? 'Setting up…' : 'Accept & set up my agreement'}
              </button>
              <button onClick={decline} className="block w-full text-center hx-prose text-[12px] text-portal-muted underline underline-offset-2 hover:text-ink">
                Not right now — we&apos;ll stay where we are
              </button>
            </div>
          )}

          {state === 'done' && (
            <div className="p-10 text-center space-y-4">
              <div className="hx-eyebrow text-hexa-green">{result?.alreadyAccepted ? 'Already accepted' : 'Upgrade accepted'}</div>
              <h2 className="font-display font-extralight text-3xl text-ink">{result?.alreadyAccepted ? "You're all set." : 'More room, coming up. 🎉'}</h2>
              <p className="hx-prose text-[14px]">
                Your new licence agreement{result?.contractNumber ? ` (${result.contractNumber})` : ''} is ready to sign — we&apos;ve emailed you the link too.
                {result?.changeoverDate ? ` You move in on ${fmtD(result.changeoverDate)}.` : ''}
              </p>
              {result?.depositTopUp > 0 && (
                <p className="hx-prose text-[13px] text-portal-muted">Your existing deposit carries over; a {money(result.depositTopUp)} top-up will be invoiced once the agreement is signed.</p>
              )}
              {result?.signLink && <a href={result.signLink} className="hx-btn inline-block">Review &amp; sign now →</a>}
            </div>
          )}
        </div>

        <p className="text-center hx-eyebrow mt-6 normal-case tracking-normal text-portal-muted">402/830 Whitehorse Road, Box Hill VIC 3128 · hexaspace.com.au</p>
      </div>
    </div>
  )
}
