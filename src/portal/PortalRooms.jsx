import { useMemo, useState } from 'react'
import { Page, PageHeader, Empty } from './ui.jsx'
import PortalCalendar from './PortalCalendar.jsx'
import { isFunctionSpace } from './functionSpace.js'
import { FLOORS, floorLabel } from '../components/spaces/shared.jsx'

export default function PortalRooms({ spaces, allBookings, member, company, leases, settings }) {
  // Function Space is booked via its own (approval-based) tab — keep it out of the hourly calendar.
  const rooms = useMemo(() => (spaces ?? []).filter(s => s.type === 'meeting' && !isFunctionSpace(s))
    .sort((a, b) => (a.hourlyRate ?? a.rate ?? 0) - (b.hourlyRate ?? b.rate ?? 0)), [spaces])

  // Group by floor so members can pick which level's rooms to view. Ordered by
  // the canonical FLOORS list, then any stray/unassigned floors after.
  const floors = useMemo(() => {
    const present = [...new Set(rooms.map((r) => r.floor ?? ''))]
    const known = FLOORS.map((f) => f.id).filter((id) => present.includes(id))
    const extra = present.filter((id) => !FLOORS.some((f) => f.id === id))
    return [...known, ...extra]
  }, [rooms])

  // Default to whichever floor has the most rooms (typically Level 4).
  const [floor, setFloor] = useState(() => {
    if (floors.length <= 1) return floors[0] ?? ''
    return [...floors].sort((a, b) =>
      rooms.filter((r) => (r.floor ?? '') === b).length - rooms.filter((r) => (r.floor ?? '') === a).length)[0]
  })

  const shown = floors.length > 1 ? rooms.filter((r) => (r.floor ?? '') === floor) : rooms

  return (
    <Page>
      <PageHeader kicker="Book · By the hour" title="Meeting Rooms">
        Pick an open slot on the calendar to request a booking — recurring options available.
        Our team confirms availability.
      </PageHeader>
      {floors.length > 1 && (
        <div className="flex items-center gap-3 mb-5">
          <label htmlFor="floor-select" className="hx-eyebrow">Level</label>
          <select
            id="floor-select"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className="hx-input w-auto min-w-[9rem]"
          >
            {floors.map((id) => (
              <option key={id} value={id}>
                {floorLabel(id)} · {rooms.filter((r) => (r.floor ?? '') === id).length} rooms
              </option>
            ))}
          </select>
        </div>
      )}
      {shown.length === 0
        ? <Empty label="No rooms available." sub="Please check back soon." />
        : <PortalCalendar key={floor} resources={shown} allBookings={allBookings} member={member} company={company} leases={leases} settings={settings} allSpaces={spaces} />}
    </Page>
  )
}
