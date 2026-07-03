import { useState } from 'react'
import { LAYOUTS, ADDONS, TERMS, TERMS_INTRO } from '../lib/functionBooking.js'

// Public, on-brand "Book a time" page for the function space. Lives at
// /book-function; the brochure "Book a time" button links here with ?ref=<token>.
// Posts to /api/function-request → lands as a Booking Requested for admin review.
const EVENT_TYPES = ['Corporate', 'Conference / Seminar', 'Launch', 'Dinner', 'Celebration', 'Wedding', 'Workshop', 'Other']

export default function FunctionBookPage() {
  const ref = new URLSearchParams(window.location.search).get('ref') || ''
  const [f, setF] = useState({
    name: '', organisation: '', email: '', phone: '',
    eventName: '', eventType: 'Corporate', layout: 'Cocktail',
    eventDate: '', startTime: '18:00', endTime: '22:00', guests: '',
    catering: false, addons: { parking: false, nameTags: false, photographer: false },
    message: '', website: '', // honeypot
  })
  const [status, setStatus] = useState('idle') // idle | sending | done | error
  const [err, setErr] = useState('')
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setAddon = (k, v) => setF((p) => ({ ...p, addons: { ...p.addons, [k]: v } }))

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!f.name.trim() || !f.email.trim()) return setErr('Please add your name and email.')
    if (!f.eventDate) return setErr('Please choose a preferred date.')
    setStatus('sending')
    try {
      const res = await fetch('/api/function-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, ref }),
      })
      if (!res.ok) throw new Error('Request failed')
      setStatus('done')
    } catch {
      setStatus('error'); setErr('Something went wrong — please try again or email events@hexaspace.com.au.')
    }
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-bone flex items-center justify-center px-4 font-body">
        <div className="hx-card max-w-md w-full p-10 text-center">
          <div className="hx-eyebrow text-hexa-green mb-3">Request received</div>
          <h1 className="font-display font-extralight text-3xl text-ink mb-3">Thank you, {f.name.split(' ')[0] || 'there'}.</h1>
          <p className="hx-prose">We’ve received your function request for <strong>{f.eventDate}</strong>. Our team will check availability and be in touch shortly to confirm and get your booking underway.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bone font-body text-ink">
      {/* Header band */}
      <header className="bg-charcoal text-paper px-6 md:px-16 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="font-heading uppercase tracking-[0.3em] text-sm">Hexa&nbsp;Space</div>
          <h1 className="font-display font-extralight text-4xl md:text-5xl mt-4">Book the Function Space</h1>
          <p className="hx-prose text-paper/70 mt-3 max-w-xl">Tell us about your event and pick a date. We’ll review availability and send everything you need to confirm — 20–100 guests, cocktail, seminar or classroom.</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-16 py-12">
        <form onSubmit={submit} className="space-y-8">
          {/* Contact */}
          <section>
            <div className="hx-eyebrow mb-4">Your details</div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className="hx-eyebrow block mb-1.5">Name *</label><input className="hx-input" value={f.name} onChange={up('name')} required /></div>
              <div><label className="hx-eyebrow block mb-1.5">Organisation</label><input className="hx-input" value={f.organisation} onChange={up('organisation')} /></div>
              <div><label className="hx-eyebrow block mb-1.5">Email *</label><input type="email" className="hx-input" value={f.email} onChange={up('email')} required /></div>
              <div><label className="hx-eyebrow block mb-1.5">Phone</label><input className="hx-input" value={f.phone} onChange={up('phone')} /></div>
            </div>
          </section>

          {/* Event */}
          <section>
            <div className="hx-eyebrow mb-4">Your event</div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className="hx-eyebrow block mb-1.5">Event name</label><input className="hx-input" value={f.eventName} onChange={up('eventName')} placeholder="e.g. Product launch" /></div>
              <div><label className="hx-eyebrow block mb-1.5">Event type</label><select className="hx-input" value={f.eventType} onChange={up('eventType')}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="mt-5">
              <label className="hx-eyebrow block mb-2.5">Layout</label>
              <div className="grid sm:grid-cols-3 gap-3">
                {LAYOUTS.map((l) => (
                  <button type="button" key={l.name} onClick={() => setF({ ...f, layout: l.name })}
                    className={`text-left p-4 border transition-colors ${f.layout === l.name ? 'border-hexa-green bg-paper' : 'border-ink/15 bg-paper hover:border-ink/40'}`}>
                    <div className="font-display font-extralight text-xl">{l.name}</div>
                    <div className="font-heading uppercase tracking-nav text-[11px] text-hexa-green mt-1">{l.cap}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-4 gap-5 mt-5">
              <div className="sm:col-span-2"><label className="hx-eyebrow block mb-1.5">Preferred date *</label><input type="date" className="hx-input" value={f.eventDate} onChange={up('eventDate')} required /></div>
              <div><label className="hx-eyebrow block mb-1.5">From</label><input type="time" className="hx-input" value={f.startTime} onChange={up('startTime')} /></div>
              <div><label className="hx-eyebrow block mb-1.5">To</label><input type="time" className="hx-input" value={f.endTime} onChange={up('endTime')} /></div>
            </div>
            <div className="mt-5 max-w-[12rem]"><label className="hx-eyebrow block mb-1.5">Estimated guests</label><input type="number" min={1} max={120} className="hx-input" value={f.guests} onChange={up('guests')} placeholder="e.g. 60" /></div>
          </section>

          {/* Extras */}
          <section>
            <div className="hx-eyebrow mb-4">Anything extra?</div>
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 hx-prose text-[14px]"><input type="checkbox" className="accent-[#7F8B2F] h-4 w-4" checked={f.catering} onChange={(e) => setF({ ...f, catering: e.target.checked })} /> I’d like catering (quoted separately)</label>
              {ADDONS.map((a) => (
                <label key={a.key} className="flex items-center gap-2.5 hx-prose text-[14px]"><input type="checkbox" className="accent-[#7F8B2F] h-4 w-4" checked={!!f.addons[a.key]} onChange={(e) => setAddon(a.key, e.target.checked)} /> {a.label}</label>
              ))}
              <p className="hx-prose text-[12px] text-portal-muted">F&B &amp; AV staff ($40/hr) are added automatically for events over 80 guests.</p>
            </div>
            <div className="mt-5"><label className="hx-eyebrow block mb-1.5">Anything else we should know?</label><textarea rows={3} className="hx-input" value={f.message} onChange={up('message')} placeholder="Run sheet, AV, accessibility, special requests…" /></div>
          </section>

          {/* T&Cs */}
          <section>
            <div className="hx-eyebrow mb-3">Terms &amp; Conditions</div>
            <div className="hx-card p-6">
              <p className="hx-prose text-[12px] italic mb-3">{TERMS_INTRO}</p>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-2">
                {TERMS.map((t, i) => <div key={i} className="hx-prose text-[12px]"><strong className="text-ink">{i + 1}. {t.title}.</strong> {t.body}</div>)}
              </div>
              <p className="hx-prose text-[12px] mt-4">By submitting a request you acknowledge these terms. Your date is only secured once your deposit is received.</p>
            </div>
          </section>

          {/* Honeypot */}
          <input type="text" value={f.website} onChange={up('website')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{err}</div>}
          <div className="flex items-center gap-4">
            <button type="submit" disabled={status === 'sending'} className="hx-btn disabled:opacity-50">{status === 'sending' ? 'Sending…' : 'Request booking'}</button>
            <span className="hx-prose text-[12px]">We’ll review availability and reply by email.</span>
          </div>
        </form>
      </main>

      <footer className="bg-charcoal text-paper/60 px-6 md:px-16 py-8 mt-8">
        <div className="max-w-3xl mx-auto font-heading uppercase tracking-nav text-[11px]">Hexa Space · 402/830 Whitehorse Road, Box Hill VIC 3128 · hexaspace.com.au</div>
      </footer>
    </div>
  )
}
