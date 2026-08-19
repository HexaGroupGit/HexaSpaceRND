import { Page, PageHeader, Empty, RoomPhoto } from './ui.jsx'
import PortalCalendar from './PortalCalendar.jsx'

export default function PortalStudios({ spaces, allBookings, member, company, leases, settings }) {
  const studios = (spaces ?? []).filter(s => s.type === 'studio' || s.type === 'podcast')
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'studio' ? -1 : 1))

  return (
    <Page>
      <PageHeader kicker="Create · Media & Podcast" title="Studios">
        Media studios and a broadcast-ready podcast room. Choose a slot to request your session —
        recurring bookings welcome.
      </PageHeader>
      {studios.length === 0
        ? <Empty label="No studios available." sub="Please check back soon." />
        : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-10">
              {studios.map((s) => (
                <div key={s.id}>
                  <RoomPhoto room={s} className="w-full aspect-[3/2]" />
                  <p className="font-display font-extralight text-xl mt-3">{s.unitNumber}</p>
                  {s.size && <p className="hx-eyebrow mt-1">{s.size}</p>}
                  {s.attributes && <p className="hx-prose text-[13px] mt-2">{s.attributes}</p>}
                </div>
              ))}
            </div>
            <PortalCalendar resources={studios} allBookings={allBookings} member={member} company={company} leases={leases} settings={settings} allSpaces={spaces} />
          </>
        )}
    </Page>
  )
}
