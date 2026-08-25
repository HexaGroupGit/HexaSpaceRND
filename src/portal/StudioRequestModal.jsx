import { useState } from 'react'
import { X, Check, Mic, ChevronRight, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { blockingResourceIds } from '../lib/roomConflicts.js'
import {
  QUESTIONNAIRE_FIELDS, emptyQuestionnaire, validateQuestionnaire, validateStudioSlot,
  buildStudioPayload, STUDIO_POLICY, SESSION_PHASES, recordingMinutesFor, CONFIRM_SLA,
  STUDIO_POLICY_VERSION, melbourneToday,
} from '../lib/studio.js'

// Request a podcast-studio session from the portal.
//
// This is deliberately NOT the meeting-room BookingModal. The studio is staffed,
// so a member can't confirm their own slot: they answer the pre-session
// questionnaire (Operations Guide §2), accept the studio policy, and the booking
// is written as 'Pending' for the studio team to approve. No credits are drawn
// and no fee is raised here — charging happens on approval, so nobody is billed
// for a session we then can't staff.

const toDec = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h + m / 60 }
const fromDec = (d) => `${String(Math.floor(d)).padStart(2, '0')}:${String(Math.round((d % 1) * 60)).padStart(2, '0')}`
const overlaps = (aS, aE, bS, bE) => toDec(aS) < toDec(bE) && toDec(bS) < toDec(aE)
const to12 = (t) => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}` }

// Whole hours only — the studio is staffed and rostered in hour blocks.
const DURATIONS = [1, 2, 3, 4]

export default function StudioRequestModal({ slot, resources, member, company, allSpaces, onClose, onRequested }) {
  const [step, setStep] = useState(1) // 1 = slot & questionnaire, 2 = policy
  const [f, setF] = useState({
    resourceId: slot.resourceId,
    date: slot.date,
    startTime: slot.startTime,
    hours: 1,
    title: '',
  })
  const [q, setQ] = useState(emptyQuestionnaire)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState([])
  const [done, setDone] = useState(null)

  const room = resources.find((r) => r.id === f.resourceId)
  const endTime = fromDec(toDec(f.startTime) + f.hours)
  const recordMins = recordingMinutesFor(f.hours)
  const wantMins = Number(q.expectedRecordingMins) || 0
  const tooShort = wantMins > recordMins

  const upQ = (key, value) => setQ((prev) => ({ ...prev, [key]: value }))

  function next() {
    // Exactly the rules the server enforces — weekday and past-date included —
    // so the form can't accept something the endpoint would then reject.
    const errs = [
      ...validateStudioSlot({ date: f.date, startTime: f.startTime, hours: f.hours }),
      ...validateQuestionnaire(q, { hours: f.hours }),
    ]
    setErrors(errs)
    if (errs.length === 0) setStep(2)
  }

  async function submit() {
    setErrors([])
    if (!accepted) return setErrors(['Please accept the studio policy to send your request.'])
    setSaving(true)
    try {
      // Server-truth clash check right before writing — the page's snapshot goes
      // stale while a tab sits open. Fails CLOSED, same as the room path.
      const blockIds = [...new Set(blockingResourceIds(f.resourceId, allSpaces ?? resources))]
      const { data: liveRows, error: availErr } = await supabase
        .from('booking_availability')
        .select('resource_id,date,start_time,end_time,status')
        .in('resource_id', blockIds)
        .eq('date', f.date)
      if (availErr) throw new Error('We couldn’t check the studio is still free — please try again.')
      const clash = (liveRows ?? []).some((r) => r.status !== 'Cancelled' &&
        overlaps(f.startTime, endTime, r.start_time, r.end_time))
      if (clash) throw new Error('That time has just been taken — please choose another slot.')

      const nowIso = new Date().toISOString()
      const booking = {
        id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        reference: `BKG-${Math.floor(100000 + Math.random() * 900000)}`,
        resourceId: f.resourceId,
        memberId: member?.id ?? '',
        companyId: company?.id ?? '',
        date: f.date,
        startTime: f.startTime,
        endTime,
        title: f.title || 'Podcast session',
        memberName: member?.name || company?.contactName || '',
        companyName: company?.businessName || '',
        attendees: [],
        // The gate. Pending holds the slot but grants no door access — the
        // Salto sweep only ever acts on Confirmed bookings.
        status: 'Pending',
        source: 'Portal',
        repeat: 'none',
        createdBy: 'Member',
        createdAt: nowIso.split('T')[0],
        // No credits drawn and no fee raised until the team approves.
        creditsUsed: 0,
        paidBy: 'pending_approval',
        studio: buildStudioPayload({
          questionnaire: q,
          acceptedBy: member?.name || company?.contactName || '',
          contact: {
            name: member?.name || company?.contactName || '',
            email: member?.email || company?.email || '',
            phone: member?.phone || company?.phone || '',
            businessName: company?.businessName || '',
          },
          source: 'Portal',
        }),
      }

      const { error: dbErr } = await supabase.from('bookings')
        .upsert({ id: booking.id, data: booking, updated_at: nowIso })
      if (dbErr) throw new Error(dbErr.message)

      // Tell the studio team a request is waiting. Best-effort: the request is
      // already saved and shows in the admin queue regardless.
      ;(async () => {
        try {
          const { authHeaders } = await import('../lib/apiFetch.js')
          await fetch('/api/studio/notify-request', {
            method: 'POST', headers: await authHeaders(),
            body: JSON.stringify({ bookingId: booking.id, kind: 'requested' }),
          })
        } catch { /* the admin queue is the safety net */ }
      })()

      onRequested?.(booking)
      setDone(booking)
    } catch (e) {
      setErrors([e.message])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
          <div>
            <p className="hx-eyebrow flex items-center gap-1.5"><Mic size={11} /> {done ? 'Request sent' : `Request a session · step ${step} of 2`}</p>
            <h2 className="font-display font-extralight text-2xl mt-1">{room?.unitNumber || 'Podcast Studio'}</h2>
          </div>
          <button onClick={onClose} className="text-portal-muted hover:text-ink"><X size={18} /></button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <span className="mx-auto h-12 w-12 border border-hexa-green/50 bg-hexa-green/10 flex items-center justify-center">
              <Check size={20} className="text-hexa-green" />
            </span>
            <p className="font-display font-extralight text-2xl mt-5">Request sent</p>
            <p className="hx-prose text-[13px] mt-2">
              {done.date.split('-').reverse().join('/')} · {to12(done.startTime)} – {to12(done.endTime)}
            </p>
            <div className="bg-bone border border-ink/10 p-4 mt-5 text-left">
              <p className="hx-prose text-[13px]">
                Your slot is held while the studio team confirms an operator — usually within {CONFIRM_SLA}.
                You'll get an email with your confirmation and the guest recording guide. Nothing is charged yet.
              </p>
            </div>
            <p className="hx-prose text-[12px] mt-4">Reference {done.reference}</p>
            <button onClick={onClose} className="hx-btn mt-6 w-full justify-center">Done</button>
          </div>
        ) : step === 1 ? (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-bone border border-ink/10 p-4">
              <p className="hx-prose text-[13px]">
                The studio is run by our team, so sessions are <strong>requested, not booked instantly</strong>.
                Tell us about your recording and we'll confirm within {CONFIRM_SLA}.
              </p>
              <p className="hx-prose text-[12px] mt-2">
                Studio sessions are charged to your account and don't use meeting-room credits —
                your allowance is untouched. Nothing is charged until we confirm.
              </p>
            </div>

            {/* Slot */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="hx-eyebrow block mb-1.5">Date</label>
                <input type="date" min={melbourneToday()} value={f.date}
                  onChange={(e) => setF({ ...f, date: e.target.value })} className="hx-input" />
              </div>
              <div>
                <label className="hx-eyebrow block mb-1.5">Start</label>
                <input type="time" step="1800" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} className="hx-input" />
              </div>
            </div>

            <div>
              <label className="hx-eyebrow block mb-1.5">How long do you need the studio?</label>
              <div className="flex gap-2">
                {DURATIONS.map((h) => (
                  <button key={h} type="button" onClick={() => setF({ ...f, hours: h })}
                    className={`flex-1 font-heading uppercase tracking-nav text-[10px] px-3 py-2.5 border transition-colors ${
                      f.hours === h ? 'bg-ink text-paper border-ink' : 'border-ink/15 hover:bg-bone'}`}>
                    {h} hr{h > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* The time budget, made unmissable */}
            <div className="border border-ink/10 p-4">
              <p className="hx-eyebrow mb-3">What fits in {f.hours} hour{f.hours > 1 ? 's' : ''}</p>
              <div className="flex h-9 border border-ink/10 overflow-hidden">
                {SESSION_PHASES.map((p) => {
                  const mins = p.key === 'record' ? recordMins : p.mins
                  return (
                    <div key={p.key} style={{ flex: Math.max(mins, 1) }}
                      className={`flex items-center justify-center px-1 min-w-0 ${
                        p.key === 'record' ? 'bg-hexa-green/20' : 'bg-bone'} ${p.key === 'pack' ? 'border-l border-ink/10' : ''} ${p.key === 'setup' ? 'border-r border-ink/10' : ''}`}>
                      <span className="font-heading uppercase tracking-nav text-[8px] truncate">{p.label}</span>
                    </div>
                  )
                })}
              </div>
              <p className="hx-prose text-[12px] mt-2.5">
                Setup and file transfer happen <strong>inside</strong> your booking — that leaves about{' '}
                <strong>{recordMins} minutes</strong> of recording. {to12(f.startTime)} – {to12(endTime)}.
              </p>
            </div>

            {/* Questionnaire */}
            <div className="pt-1">
              <p className="hx-eyebrow mb-3">About your recording</p>
              <div className="space-y-4">
                {QUESTIONNAIRE_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="hx-eyebrow block mb-1.5">
                      {field.label}{field.required ? '' : ' (optional)'}
                    </label>
                    {field.type === 'select' && (
                      <select value={q[field.key] ?? ''} onChange={(e) => upQ(field.key, e.target.value)} className="hx-input">
                        <option value="">Select…</option>
                        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {field.type === 'number' && (
                      <input type="number" min={field.min} max={field.max} value={q[field.key] ?? ''}
                        onChange={(e) => upQ(field.key, e.target.value === '' ? '' : Number(e.target.value))} className="hx-input" />
                    )}
                    {field.type === 'boolean' && (
                      <div className="flex gap-2">
                        {[['Yes', true], ['No', false]].map(([label, v]) => (
                          <button key={label} type="button" onClick={() => upQ(field.key, v)}
                            className={`flex-1 font-heading uppercase tracking-nav text-[10px] px-3 py-2.5 border transition-colors ${
                              q[field.key] === v ? 'bg-ink text-paper border-ink' : 'border-ink/15 hover:bg-bone'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {field.type === 'textarea' && (
                      <textarea rows={3} value={q[field.key] ?? ''} placeholder={field.placeholder}
                        onChange={(e) => upQ(field.key, e.target.value)} className="hx-input resize-none" />
                    )}
                    {field.help && <p className="hx-prose text-[11px] mt-1.5">{field.help}</p>}
                  </div>
                ))}
              </div>
            </div>

            {tooShort && (
              <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
                {wantMins} minutes of recording won't fit in a {f.hours}-hour booking (about {recordMins} minutes of
                recording time). Add another hour above, or shorten the recording.
              </div>
            )}

            {errors.length > 0 && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 space-y-1">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={onClose} className="hx-btn-ghost">Cancel</button>
              <button onClick={next} className="hx-btn">Continue <ChevronRight size={13} /></button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <p className="hx-eyebrow">Studio policy</p>
            <p className="hx-prose text-[13px]">
              Please read before sending your request. These terms apply to every session.
            </p>
            <div className="border border-ink/10 max-h-72 overflow-y-auto divide-y divide-ink/5">
              {STUDIO_POLICY.map((t) => (
                <div key={t.title} className="px-4 py-3">
                  <p className="font-heading uppercase tracking-nav text-[10px] mb-1">{t.title}</p>
                  <p className="hx-prose text-[12px]">{t.body}</p>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-3 border border-ink/15 p-4 cursor-pointer hover:bg-bone transition-colors">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-hexa-green shrink-0" />
              <span className="hx-prose text-[13px]">
                I have read and agree to the studio policy ({STUDIO_POLICY_VERSION}) on behalf of
                {' '}<strong>{company?.businessName || member?.name || 'my organisation'}</strong>.
              </span>
            </label>

            {errors.length > 0 && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 space-y-1">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button onClick={() => { setStep(1); setErrors([]) }} className="hx-btn-ghost"><ChevronLeft size={13} /> Back</button>
              <button onClick={submit} disabled={saving || !accepted} className="hx-btn disabled:opacity-50">
                <Check size={13} /> {saving ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
