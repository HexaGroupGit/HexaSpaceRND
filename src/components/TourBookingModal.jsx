import { useState } from 'react'
import { CalendarClock, X, Loader2, MapPin } from 'lucide-react'
import { sendEmail } from '../lib/sendEmail.js'
import {
  TOUR_NOTIFY, tourConfig, tourVars, buildTourIcs, icsBase64,
  tourConfirmedEmail, tourTeamEmail, addMinutes, tourWhenLabel, durationLabel,
} from '../lib/tourInvite.js'

// Book a tour for someone who rang up. Staff take their details, pick a time,
// and the prospect gets a real calendar invitation with the address and
// parking — the team gets the same invite so it's in their calendars too.
//
// Doubles as the reschedule path: re-booking an existing lead re-sends with a
// bumped SEQUENCE, so calendars update the event in place instead of creating
// a second one.

const DURATIONS = [15, 30, 45, 60, 90]

const INTEREST_TYPES = [
  'Private Office', 'Dedicated Desk', 'Flexible Desk', 'Virtual Office',
  'Enterprise Suites', 'Meeting Rooms', 'The Function Space',
  'Media Studios', 'The Podcast Studio', 'Membership',
]

const input = 'w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
const lbl = 'block text-xs font-medium text-muted-foreground mb-1'

// Default to the next half-hour slot on the next weekday.
function defaultDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function TourBookingModal({ store, lead = null, onClose, onBooked }) {
  const {
    leads = [], pipelineStages = [], templates = [], settings = {},
    addLead, updateLead, appendLeadActivity,
  } = store

  const cfg = tourConfig(settings)
  const rescheduling = !!(lead?.tourBookedAt && lead?.tourStatus !== 'cancelled')

  const [f, setF] = useState({
    name: lead?.name ?? '',
    businessName: lead?.businessName ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    enquiryType: lead?.enquiryType ?? lead?.interest ?? '',
    date: lead?.tourDate || defaultDate(),
    time: lead?.tourTime || '10:00',
    durationMinutes: lead?.tourDurationMinutes || cfg.durationMinutes,
    host: lead?.tourHost ?? '',
    message: '',
    notes: '',
    emailGuest: true,
    notifyTeam: true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const chk = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.checked }))

  const whenLabel = tourWhenLabel(f.date, f.time)
  const canSave = f.name.trim() && f.date && f.time && (!f.emailGuest || f.email.trim())

  async function submit(e) {
    e.preventDefault()
    if (!canSave || busy) return
    setBusy(true); setError('')

    try {
      const email = f.email.trim().toLowerCase()
      const now = new Date().toISOString()
      const today = now.split('T')[0]
      const endTime = addMinutes(f.time, f.durationMinutes)

      // Reuse the lead we were opened from, else an existing lead with the same
      // email, else create one — so a phone booking never duplicates a lead
      // that already came in from the website.
      const target = lead ?? (email ? leads.find((l) => (l.email || '').toLowerCase() === email) : null)

      const tourFields = {
        name: f.name.trim(),
        businessName: f.businessName.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        enquiryType: f.enquiryType || null,
        tourBookedAt: target?.tourBookedAt || now,
        tourDate: f.date,
        tourTime: f.time,
        tourDurationMinutes: Number(f.durationMinutes),
        tourHost: f.host.trim(),
        tourStatus: 'confirmed',
        // Bumping the sequence is what makes a re-send update the existing
        // calendar entry rather than adding a second one.
        tourIcsSeq: (target?.tourIcsSeq ?? -1) + 1,
        // A booked tour supersedes the automated drip.
        nurture: { ...(target?.nurture ?? {}), done: true, lastAt: today },
      }

      let saved
      if (target) {
        updateLead(target.id, tourFields)
        saved = { ...target, ...tourFields }
      } else {
        const created = addLead({
          ...tourFields,
          source: 'phone',
          stageId: pipelineStages.find((s) => s.category === 'new')?.id ?? pipelineStages[0]?.id ?? '',
          value: 0,
          notes: f.notes.trim(),
          type: 'enquiry',
          read: true,
        })
        saved = created ?? { ...tourFields, id: `lead${Date.now()}` }
      }

      const vars = tourVars({
        lead: saved, date: f.date, startTime: f.time, endTime,
        durationMinutes: f.durationMinutes, host: f.host.trim(),
        message: f.message.trim(), settings,
      })

      const organiserEmail = settings?.emails?.replyTo || settings?.emails?.notificationEmail || 'info@hexaspace.com.au'
      const buildIcs = (attendees) => buildTourIcs({
        uid: `tour-${saved.id}@hexaspace.com.au`,
        sequence: tourFields.tourIcsSeq,
        date: f.date, startTime: f.time, endTime,
        summary: `${vars.company} tour — ${saved.businessName || saved.name}`,
        description: `Your tour of ${vars.company}.\n\n${cfg.arrival}\n\nParking:\n${cfg.parking.map((p) => `· ${p}`).join('\n')}`,
        location: cfg.address,
        organiserName: vars.company,
        organiserEmail,
        attendees,
      })

      const template = templates.find((t) => t.category === 'email' && t.emailType === 'tour_booked' && t.content)
      const sends = []

      if (f.emailGuest && saved.email) {
        const { subject, html } = tourConfirmedEmail({ template, vars, rescheduled: rescheduling })
        sends.push(sendEmail({
          to: saved.email, subject, html, settings, emailType: 'tour_booked',
          attachments: [{ filename: 'hexa-space-tour.ics', content: icsBase64(buildIcs([{ name: saved.name, email: saved.email }])) }],
        }))
      }

      if (f.notifyTeam) {
        const to = [...new Set([...TOUR_NOTIFY, settings?.emails?.notificationEmail].filter(Boolean).map((a) => a.toLowerCase()))]
        const { subject, html } = tourTeamEmail({ vars, lead: saved, notes: f.notes.trim(), bookedBy: f.host.trim(), rescheduled: rescheduling })
        sends.push(sendEmail({
          to, subject, html, settings, emailType: 'tour_booked_internal',
          attachments: [{ filename: 'hexa-space-tour.ics', content: icsBase64(buildIcs(to.map((a) => ({ name: a, email: a })))) }],
        }))
      }

      // The booking is already saved — a mail failure must surface, but not by
      // pretending the tour wasn't booked.
      const results = await Promise.allSettled(sends)
      const failed = results.filter((r) => r.status === 'rejected')

      appendLeadActivity?.(saved.id, {
        type: 'tour',
        text: `Tour ${rescheduling ? 'rescheduled' : 'booked'} — ${whenLabel} (${durationLabel(f.durationMinutes)})${f.host.trim() ? ` with ${f.host.trim()}` : ''}${failed.length ? ' · invite email failed' : ''}`,
      })

      if (failed.length) {
        setError(`Tour saved, but the invitation didn't send: ${failed[0].reason?.message ?? 'email error'}`)
        setBusy(false)
        return
      }

      onBooked?.(saved)
      onClose()
    } catch (err) {
      setError(err.message ?? 'Could not book the tour.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <CalendarClock size={17} /> {rescheduling ? 'Reschedule tour' : 'Book a tour'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-5">
          <p className="text-xs text-muted-foreground">
            For enquiries that come in by phone. Takes their details, adds them to the CRM, and emails a calendar
            invitation with the address and parking. {rescheduling && <span className="text-amber-600">This lead already has a tour on {lead.tourDate} — saving will move it and update their calendar.</span>}
          </p>

          <div>
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Who's coming in</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Contact name *</label>
                <input required value={f.name} onChange={set('name')} placeholder="e.g. Priya Nair" className={input} />
              </div>
              <div>
                <label className={lbl}>Business name</label>
                <input value={f.businessName} onChange={set('businessName')} placeholder="e.g. Nair Imports" className={input} />
              </div>
              <div>
                <label className={lbl}>Email {f.emailGuest && '*'}</label>
                <input type="email" value={f.email} onChange={set('email')} placeholder="name@business.com.au" className={input} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input value={f.phone} onChange={set('phone')} placeholder="04…" className={input} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Interested in</label>
                <select value={f.enquiryType} onChange={set('enquiryType')} className={input}>
                  <option value="">— Not sure yet —</option>
                  {INTEREST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">When</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Date *</label>
                <input required type="date" value={f.date} onChange={set('date')} className={input} />
              </div>
              <div>
                <label className={lbl}>Time *</label>
                <input required type="time" value={f.time} onChange={set('time')} className={input} />
              </div>
              <div>
                <label className={lbl}>Duration</label>
                <select value={f.durationMinutes} onChange={set('durationMinutes')} className={input}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{durationLabel(d)}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className={lbl}>Who's showing them around <span className="font-normal">(optional — appears on the invite)</span></label>
                <input value={f.host} onChange={set('host')} placeholder="e.g. Brittany" className={input} />
              </div>
            </div>
            {whenLabel && (
              <p className="text-xs text-muted-foreground mt-2">
                Invite will read <span className="text-foreground font-medium">{whenLabel}</span> · {durationLabel(f.durationMinutes)} · Melbourne time
              </p>
            )}
          </div>

          <div className="border-t border-border pt-5">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Message</div>
            <label className={lbl}>Personal note <span className="font-normal">(optional — appears in their email)</span></label>
            <textarea value={f.message} onChange={set('message')} rows={2}
              placeholder="I'll have the two Level 4 offices ready to show you." className={`${input} resize-none mb-3`} />
            <label className={lbl}>Internal notes <span className="font-normal">(CRM + team email only)</span></label>
            <textarea value={f.notes} onChange={set('notes')} rows={2}
              placeholder="Team of 4, moving from a serviced office, budget ~$3k." className={`${input} resize-none`} />
          </div>

          <div className="bg-muted/50 border border-border rounded-md p-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2 mb-2 text-foreground">
              <MapPin size={13} className="mt-0.5 shrink-0" />
              <span className="font-medium">{cfg.address}</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {cfg.parking.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <p className="mt-2">Editable under Settings → Tours. Email wording: Templates → Emails → "Tour — Booking confirmed".</p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2 text-foreground">
              <input type="checkbox" checked={f.emailGuest} onChange={chk('emailGuest')} className="accent-blue-600" />
              Email them the confirmation + calendar invitation
            </label>
            <label className="flex items-center gap-2 text-foreground">
              <input type="checkbox" checked={f.notifyTeam} onChange={chk('notifyTeam')} className="accent-blue-600" />
              Put it in the leasing team's calendars
            </label>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-xs">{error}</div>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-foreground border border-input rounded-md hover:bg-muted/50">Cancel</button>
            <button type="submit" disabled={!canSave || busy}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium disabled:opacity-40">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
              {rescheduling ? 'Reschedule & re-send invite' : 'Book tour & send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
