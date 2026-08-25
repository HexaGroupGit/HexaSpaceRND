import { useState } from 'react'
import { Mic, ChevronDown, Clock, ShieldCheck } from 'lucide-react'
import { Page, PageHeader, Empty, RoomPhoto, Card } from './ui.jsx'
import PortalCalendar from './PortalCalendar.jsx'
import { isRequestGated, STUDIO_POLICY, SESSION_PHASES, CONFIRM_SLA, recordingMinutesFor } from '../lib/studio.js'

// Two different products live on this page and they book in different ways:
//   · Media studios  — instant booking, same as a meeting room.
//   · Podcast studio — staffed by our team, so it is REQUEST-to-book: pick a
//     slot, answer the pre-session questionnaire, accept the policy, and the
//     studio team confirms.
// They are split apart rather than mixed into one grid, because a member who
// picks a podcast slot expecting an instant booking is exactly the confusion
// this whole flow exists to prevent.

export default function PortalStudios({ spaces, allBookings, member, company, leases, settings }) {
  const studios = (spaces ?? []).filter((s) => s.type === 'studio' || s.type === 'podcast')
  const instant = studios.filter((s) => !isRequestGated(s))
  const gated = studios.filter(isRequestGated)

  return (
    <Page>
      <PageHeader kicker="Create · Media & Podcast" title="Studios">
        Media studios you can book on the spot, and a staff-operated podcast studio you request a session in.
      </PageHeader>

      {studios.length === 0 && <Empty label="No studios available." sub="Please check back soon." />}

      {gated.length > 0 && <PodcastSection
        rooms={gated} spaces={spaces} allBookings={allBookings}
        member={member} company={company} leases={leases} settings={settings} />}

      {instant.length > 0 && (
        <section className={gated.length > 0 ? 'mt-14' : ''}>
          <div className="mb-5">
            <p className="hx-eyebrow">Book instantly</p>
            <h2 className="font-display font-extralight text-2xl mt-1">Media studios</h2>
            <p className="hx-prose text-[13px] mt-1.5">Pick a slot and it's yours — your access pass opens the door 15 minutes before.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {instant.map((s) => (
              <div key={s.id}>
                <RoomPhoto room={s} className="w-full aspect-[3/2]" />
                <p className="font-display font-extralight text-xl mt-3">{s.unitNumber}</p>
                {s.size && <p className="hx-eyebrow mt-1">{s.size}</p>}
                {s.attributes && <p className="hx-prose text-[13px] mt-2">{s.attributes}</p>}
              </div>
            ))}
          </div>
          <PortalCalendar resources={instant} allBookings={allBookings} member={member}
            company={company} leases={leases} settings={settings} allSpaces={spaces} />
        </section>
      )}
    </Page>
  )
}

function PodcastSection({ rooms, spaces, allBookings, member, company, leases, settings }) {
  const [openPolicy, setOpenPolicy] = useState(false)
  const room = rooms[0]

  return (
    <section>
      <div className="mb-5">
        <p className="hx-eyebrow flex items-center gap-1.5"><Mic size={11} /> Request a session</p>
        <h2 className="font-display font-extralight text-2xl mt-1">The Podcast Studio</h2>
        <p className="hx-prose text-[13px] mt-1.5 max-w-2xl">
          Three-camera studio with broadcast microphones, run by our team. Because an operator is rostered for every
          session, the studio is <strong>requested rather than booked instantly</strong> — pick a slot below, tell us
          about your recording, and we'll confirm within {CONFIRM_SLA}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <RoomPhoto room={room} className="w-full aspect-[3/2]" />
        <div className="space-y-5">
          {/* What's in the room — the gear list, straight from the studio's own
              quick-settings sheet. Producers ask before they book. */}
          <div>
            <p className="hx-eyebrow mb-2">In the room</p>
            <ul className="hx-prose text-[13px] space-y-1.5">
              <li>Three cameras — host, guest and a wide centre angle, 4K</li>
              <li>Two broadcast microphones, recorded on separate tracks plus a mix</li>
              <li>Studio lighting set to a consistent preset for every session</li>
              <li>An operator running cameras, sound and lights throughout</li>
            </ul>
          </div>

          {/* The time budget — the single most misunderstood policy. */}
          <div className="border border-ink/10 p-4">
            <p className="hx-eyebrow flex items-center gap-1.5 mb-3"><Clock size={11} /> How an hour is spent</p>
            <div className="flex h-8 border border-ink/10 overflow-hidden">
              {SESSION_PHASES.map((p) => (
                <div key={p.key} style={{ flex: p.key === 'record' ? recordingMinutesFor(1) : p.mins }}
                  className={`flex items-center justify-center px-1 min-w-0 ${
                    p.key === 'record' ? 'bg-hexa-green/20' : 'bg-bone'} ${p.key !== 'setup' ? 'border-l border-ink/10' : ''}`}>
                  <span className="font-heading uppercase tracking-nav text-[8px] truncate">{p.label}</span>
                </div>
              ))}
            </div>
            <p className="hx-prose text-[12px] mt-2.5">
              Setup and file handover happen <strong>inside</strong> your booking, so a one-hour session leaves about{' '}
              {recordingMinutesFor(1)} minutes of recording. Book longer if you need more.
            </p>
          </div>
        </div>
      </div>

      {/* Policy — readable before requesting, not just at the tick-box. */}
      <Card className="mb-8 overflow-hidden">
        <button onClick={() => setOpenPolicy((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-bone transition-colors">
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-hexa-green" />
            <span className="font-heading uppercase tracking-nav text-[11px]">Studio policy</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="hx-prose text-[12px]">{openPolicy ? 'Hide' : 'Read before requesting'}</span>
            <ChevronDown size={15} className={`text-portal-muted transition-transform ${openPolicy ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {openPolicy && (
          <div className="border-t border-ink/10 divide-y divide-ink/5">
            {STUDIO_POLICY.map((t) => (
              <div key={t.title} className="px-5 py-3.5">
                <p className="font-heading uppercase tracking-nav text-[10px] mb-1">{t.title}</p>
                <p className="hx-prose text-[12px]">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <PortalCalendar resources={rooms} allBookings={allBookings} member={member}
        company={company} leases={leases} settings={settings} allSpaces={spaces} />
    </section>
  )
}
