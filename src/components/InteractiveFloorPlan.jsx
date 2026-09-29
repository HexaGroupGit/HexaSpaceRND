import SearchSelect from './SearchSelect.jsx'
import { useState, useRef, Fragment } from 'react'
import { format, parseISO, isValid, differenceInDays } from 'date-fns'
import { X, MapPin, Crosshair, ZoomIn, ZoomOut, Maximize2, Presentation, Car, Armchair } from 'lucide-react'
import { moveOutDate, memberOptions, assignmentFor, contractFor, floorLabel, money } from './spaces/shared.jsx'
import {
  PARKING_PLANS, PARKING_BAYS, PARKING_RATE, PARKING_INCLUDED_LABEL, spaceForBay, missingParkingBays,
  retiredParkingSpaces, parkingSetupPrompt, parkingSetupSummary, normalisePlate,
} from '../lib/parkingBays.js'
import {
  DESK_POSITIONS, spaceForDesk, missingDeskPositions, deskSetupPrompt, deskSetupSummary,
} from '../lib/deskBays.js'

// Image-based interactive floorplan: your real plan as the backdrop, with each
// space pinned on it as a status-coloured marker. Positions persist on the space
// record as `pos: { x, y }` (percent of image). Drop the plan image at the `src`
// path below (a friendly placeholder shows until you do).
//
// Some things aren't pinned by hand — they have a fixed, traced position on the
// plan and are drawn as TILES carrying their number: car park bays on a parking
// level (lib/parkingBays.js) and the dedicated desks along Level 4
// (lib/deskBays.js). Click a tile to allocate it to a member; shift-click to
// pick several at once. Both kinds share one selection and one allocate panel —
// the only parking-specific bits are the number plate and "included in licence".
const FLOORPLANS = [
  { id: 'hexa-l2', floor: 'l2', label: 'Level 2', src: '/floorplans/hexa-l2.png', location: 'whitehorse', description: '830 Whitehorse Road, Box Hill VIC 3128' },
  { id: 'hexa-l4', floor: 'l4', label: 'Level 4', src: '/floorplans/hexa-l4.png', location: 'whitehorse', description: '830 Whitehorse Road, Box Hill VIC 3128' },
  { id: 'hexa-l5', floor: 'l5', label: 'Level 5', src: '/floorplans/hexa-l5.png', location: 'whitehorse', description: '830 Whitehorse Road, Box Hill VIC 3128' },
  ...PARKING_PLANS.map((p) => ({ ...p, kind: 'parking', location: 'whitehorse', description: '830 Whitehorse Road, Box Hill VIC 3128' })),
]

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2]

// Marker colour by derived state: occupied (dark), ending ≤3 months (yellow), vacant (green).
function statusDot(state) {
  if (state === 'ending') return 'bg-amber-400 text-amber-950 border-amber-500'
  if (state === 'occupied') return 'bg-gray-900 text-white border-gray-900'
  return 'bg-green-500 text-white border-green-600'
}

// Fixed-position tiles (bays, desks), in the same palette as the office markers.
const BAY_STYLE = {
  occupied: 'bg-gray-900 text-white border-black hover:bg-gray-700',
  ending:   'bg-amber-400 text-amber-950 border-amber-600 hover:bg-amber-300',
  reserved: 'bg-gray-400 text-white border-gray-600 hover:bg-gray-500',
  vacant:   'bg-green-500 text-white border-green-700 hover:bg-green-600',
  missing:  'bg-white text-gray-500 border-dashed border-gray-400 hover:bg-gray-50',
}
const BAY_LABEL = {
  occupied: 'Allocated',
  ending: 'Allocated · ends ≤3 months',
  reserved: 'Under offer',
  vacant: 'Available',
  missing: 'Not set up yet',
}

// Seeded rooms carry `size` ("Up to 8"); rooms added via the Meeting Rooms tab
// carry a numeric `capacity`. Show whichever is there.
function roomSeats(s) {
  if (s.capacity != null && s.capacity !== '') return `Up to ${s.capacity}`
  return s.size || ''
}
function roomTitle(s) {
  const bits = [roomSeats(s), s.hourlyRate ? `$${s.hourlyRate}/hr` : ''].filter(Boolean)
  return `${s.unitNumber} meeting room${bits.length ? ' — ' + bits.join(' · ') : ''}`
}

export default function InteractiveFloorPlan({ spaces, leases, tenants, members = [], updateSpace, setUpParkingBays, setUpDesks, onNewContract }) {
  const [planId, setPlanId] = useState(FLOORPLANS[0].id)
  const [zoom, setZoom] = useState(1)
  const [placingId, setPlacingId] = useState(null) // space currently being pinned
  const [selectedId, setSelectedId] = useState(null)
  const [imgError, setImgError] = useState(false)
  const [showRooms, setShowRooms] = useState(true) // meeting-room name labels
  const [bayPick, setBayPick] = useState([]) // tile numbers selected on this plan
  const [assignTo, setAssignTo] = useState('') // member the selected tiles go to
  const [setupNote, setSetupNote] = useState('')
  const imgWrapRef = useRef(null)

  const plan = FLOORPLANS.find((p) => p.id === planId)
  const isParking = plan.kind === 'parking'
  // Floor plan carries private offices (status markers) and meeting rooms (name
  // labels, so staff can tell West from Central) — not virtual, desks or parking.
  const planSpaces = isParking ? [] : spaces.filter(
    (s) => (s.location || 'whitehorse') === plan.location && (s.type === 'office' || s.type === 'meeting')
  )
  const isRoom = (s) => s.type === 'meeting'
  const visible = planSpaces.filter((s) => showRooms || !isRoom(s))
  // pinned to THIS floor
  const placed = visible.filter((s) => s.pos && typeof s.pos.x === 'number' && s.floor === plan.floor)
  // not yet pinned anywhere — can be dropped onto any floor
  const unplaced = visible.filter((s) => !s.pos || typeof s.pos.x !== 'number')

  const getActiveLease = (spaceId) => leases.find((l) => l.spaceId === spaceId && l.status === 'active')
  const getTenant = (spaceId) => {
    const lease = getActiveLease(spaceId)
    return lease ? tenants.find((t) => t.id === lease.tenantId) : null
  }
  // Derived marker state: vacant (no occupant) → green; occupied with a lease
  // ending within 3 months → yellow; otherwise occupied → dark.
  const spaceState = (s) => {
    const lease = leases.find((l) => l.spaceId === s.id && l.status === 'active')
    const occupied = !!(s.occupantTenantId || s.occupantName || lease)
    if (!occupied) return 'vacant'
    // Use the effective move-out date so a served-notice / scheduled termination
    // (which sets a vacate date, not a new end date) still flags yellow.
    const out = moveOutDate(lease)
    const end = out ? parseISO(out) : null
    if (end && isValid(end)) {
      const days = differenceInDays(end, new Date())
      if (days >= 0 && days <= 90) return 'ending'
    }
    return 'occupied'
  }

  const selected = selectedId ? planSpaces.find((s) => s.id === selectedId) : null
  const selRoom = selected ? isRoom(selected) : false
  const selectedTenant = selected && !selRoom ? getTenant(selected.id) : null
  const selectedLease = selected && !selRoom ? getActiveLease(selected.id) : null
  const selState = selected && !selRoom ? spaceState(selected) : null
  const selStateLabel = selState === 'ending' ? 'Lease ending soon' : selState === 'occupied' ? 'Occupied' : 'Vacant'

  // ── Car park bays ──────────────────────────────────────────────────────────
  // A member or a live contract holds the bay → allocated (yellow when that
  // contract moves out within 3 months); a pending contract → under offer.
  const bayState = (space, contract) => {
    if (!space) return 'missing'
    if (space.assignedMemberId || contract?.status === 'active' || space.occupantTenantId || space.occupantName || space.status === 'occupied') {
      const out = contract?.status === 'active' ? moveOutDate(contract) : null
      const end = out ? parseISO(out) : null
      if (end && isValid(end)) {
        const days = differenceInDays(end, new Date())
        if (days >= 0 && days <= 90) return 'ending'
      }
      return 'occupied'
    }
    if (contract || space.status === 'reserved') return 'reserved'
    return 'vacant'
  }
  const tileRow = (tile) => {
    const space = tile.findSpace(spaces)
    const contract = space ? contractFor(space, leases) : null
    return { tile, space, contract, state: bayState(space, contract) }
  }
  const holderOf = ({ space, contract }) => {
    if (!space) return null
    const member = assignmentFor(space, members, tenants)
    if (member) return member
    if (!contract) return null
    return {
      name: tenants.find((t) => t.id === contract.tenantId)?.businessName ?? '—',
      company: contract.contractNumber ? `Contract ${contract.contractNumber}` : 'On a contract',
    }
  }

  // What this plan draws as tiles. A parking level draws its bays; Level 4 also
  // draws the dedicated desks that run under the offices. Each definition knows
  // how to find its own Spaces record, so the rest of the tile code is shared.
  const tileDefs = isParking
    ? PARKING_BAYS.filter((b) => b.floor === plan.floor).map((b) => ({
        kind: 'parking', number: b.number, box: b.box, noun: 'bay',
        title: `Bay ${b.number}`, detail: `${b.ref} · Lot ${b.lot}`,
        findSpace: (all) => spaceForBay(b, all),
      }))
    : DESK_POSITIONS.filter((d) => d.floor === plan.floor).map((d) => ({
        kind: 'desk', number: d.number, box: d.box, noun: 'desk',
        title: `Dedicated Desk ${d.number}`, detail: `Pod ${d.pod} · ${d.seat} seat`,
        findSpace: (all) => spaceForDesk(d, all),
      }))
  const planTiles = tileDefs.map(tileRow)
  const hasTiles = planTiles.length > 0
  const setupPrompt = isParking
    ? parkingSetupPrompt(missingParkingBays(spaces).length, retiredParkingSpaces(spaces, leases).length)
    : deskSetupPrompt(missingDeskPositions(spaces).filter((d) => d.floor === plan.floor).length)
  const picked = bayPick.map((n) => planTiles.find((r) => r.tile.number === n)).filter(Boolean)
  // Tiles a member can take: set up, and not already sold on a contract.
  const allocatable = picked.filter((r) => r.space && !r.contract)
  const memberHeld = picked.filter((r) => r.space?.assignedMemberId)
  const onContract = picked.filter((r) => r.contract).length
  const notSetUp = picked.filter((r) => !r.space).length
  const memberOpts = hasTiles ? memberOptions(members, tenants) : []
  const tileNoun = picked[0]?.tile.noun ?? 'bay'

  function switchPlan(id) {
    setPlanId(id); setSelectedId(null); setPlacingId(null); setBayPick([]); setAssignTo('')
  }

  function handleImageClick(e) {
    if (!placingId || imgError) return
    const rect = imgWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    updateSpace(placingId, { pos: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }, floor: plan.floor })
    setPlacingId(null)
  }

  function clickBay(e, number) {
    e.stopPropagation()
    const several = e.shiftKey || e.metaKey || e.ctrlKey
    setBayPick((p) => (several
      ? (p.includes(number) ? p.filter((n) => n !== number) : [...p, number])
      : (p.length === 1 && p[0] === number ? [] : [number])))
  }

  function allocate() {
    const m = members.find((x) => x.id === assignTo)
    if (!m) return
    allocatable.forEach((r) => updateSpace(r.space.id, { assignedMemberId: m.id, assignedCompanyId: m.companyId || undefined, status: 'occupied' }))
    setAssignTo('')
  }

  function unassign() {
    // A bay that's also on a contract stays held by that contract.
    memberHeld.forEach((r) => updateSpace(r.space.id, {
      assignedMemberId: undefined, assignedCompanyId: undefined, status: r.contract ? r.space.status : 'vacant',
    }))
  }

  function runSetup() {
    if (isParking) { if (setUpParkingBays) setSetupNote(parkingSetupSummary(setUpParkingBays())) }
    else if (setUpDesks) setSetupNote(deskSetupSummary(setUpDesks()))
  }

  function savePlate(space, value) {
    const plate = normalisePlate(value)
    if (plate !== (space.numberPlate || '')) updateSpace(space.id, { numberPlate: plate || undefined })
  }

  // A bay that comes with the member's licence has no price of its own;
  // unticking puts it back on the standard rate.
  function setIncluded(space, on) {
    const rate = on ? 0 : PARKING_RATE
    updateSpace(space.id, { includedInContract: on || undefined, monthlyRate: rate, rate })
  }

  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {FLOORPLANS.map((p, i) => (
            <Fragment key={p.id}>
              {p.kind === 'parking' && FLOORPLANS[i - 1]?.kind !== 'parking' && <span className="w-px h-6 bg-border mx-1" />}
              <button
                onClick={() => switchPlan(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  planId === p.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {p.kind === 'parking' && <Car size={14} />}
                {p.label}
              </button>
            </Fragment>
          ))}
          {!isParking && (
            <button
              onClick={() => { setShowRooms((v) => !v); setPlacingId(null) }}
              title="Show meeting-room name labels on the plan"
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                showRooms ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Presentation size={14} /> Meeting rooms
            </button>
          )}
          <div className={`flex items-center gap-1 border border-border rounded-md overflow-hidden ${isParking ? 'ml-auto' : ''}`}>
            <button onClick={() => setZoom((z) => ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(z) - 1)])} className="px-2.5 py-1.5 hover:bg-muted" title="Zoom out"><ZoomOut size={14} /></button>
            <span className="text-xs text-muted-foreground px-2 min-w-[42px] text-center font-medium">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(z) + 1)])} className="px-2.5 py-1.5 hover:bg-muted" title="Zoom in"><ZoomIn size={14} /></button>
            <button onClick={() => setZoom(1)} className="px-2.5 py-1.5 hover:bg-muted border-l border-border" title="Reset"><Maximize2 size={14} /></button>
          </div>
        </div>

        {placingId && (
          <div className="mb-3 flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-md px-3 py-2">
            <Crosshair size={15} /> Click on the plan to place <strong>{planSpaces.find((s) => s.id === placingId)?.unitNumber}</strong>
            <button onClick={() => setPlacingId(null)} className="ml-auto text-blue-500 hover:text-blue-800"><X size={14} /></button>
          </div>
        )}

        {setupPrompt && (
          <div className="mb-3 flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-3 py-2">
            {isParking ? <Car size={15} className="shrink-0" /> : <Armchair size={15} className="shrink-0" />}
            <span>{setupPrompt} — update Spaces to match the {isParking ? 'car park plans' : 'Level 4 plan'}.</span>
            {(isParking ? setUpParkingBays : setUpDesks) && (
              <button onClick={runSetup} className="ml-auto shrink-0 text-xs font-semibold bg-amber-900 text-white px-2.5 py-1.5 rounded-md hover:bg-amber-800">
                {isParking ? 'Update bays' : 'Add desks'}
              </button>
            )}
          </div>
        )}
        {setupNote && (
          <div className="mb-3 flex items-center gap-2 text-sm bg-green-50 border border-green-200 text-green-800 rounded-md px-3 py-2">
            {setupNote}
            <button onClick={() => setSetupNote('')} className="ml-auto text-green-600 hover:text-green-900"><X size={14} /></button>
          </div>
        )}

        {/* Plan image with markers */}
        <div className="border border-border rounded-md overflow-auto bg-muted" style={{ maxHeight: '72vh' }}>
          {imgError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <MapPin size={36} className="text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Floor plan image not found</p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                Drop your plan at{' '}
                <code className="bg-card border border-border px-1.5 py-0.5 rounded text-foreground">public{plan.src.replace(/\//g, '\\')}</code>
                {' '}— markers can still be placed once the image is present.
              </p>
            </div>
          ) : (
            <div style={{ transformOrigin: 'top left', transform: `scale(${zoom})`, width: `${100 / zoom}%` }}>
              <div
                ref={imgWrapRef}
                className={`relative ${placingId ? 'cursor-crosshair' : ''}`}
                // Tile numbers size with the plan, not the window.
                style={hasTiles ? { containerType: 'inline-size' } : undefined}
                // Pinning wins while it's armed; otherwise a click on bare plan
                // clears the tile selection.
                onClick={(e) => { if (placingId) handleImageClick(e); else if (hasTiles) setBayPick([]) }}
              >
                <img src={plan.src} alt={plan.label} className="w-full h-auto block select-none" draggable={false}
                  onError={() => setImgError(true)} onLoad={() => setImgError(false)} />
                {placed.map((s) => {
                  const room = isRoom(s)
                  const tenant = room ? null : getTenant(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedId((p) => (p === s.id ? null : s.id)) }}
                      title={room ? roomTitle(s) : `${s.unitNumber}${tenant ? ' — ' + tenant.businessName : ''}`}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 border shadow-sm text-[10px] font-bold px-2 py-1 leading-none whitespace-nowrap transition-transform hover:scale-110 ${
                        room ? 'rounded-md bg-indigo-600 text-white border-indigo-700 uppercase tracking-wide' : `rounded-full ${statusDot(spaceState(s))}`
                      } ${selectedId === s.id ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                      style={{ left: `${s.pos.x}%`, top: `${s.pos.y}%` }}
                    >
                      {s.unitNumber}
                    </button>
                  )
                })}
                {planTiles.map((r) => {
                  const [left, top, width, height] = r.tile.box
                  const holder = holderOf(r)
                  return (
                    <button
                      key={r.tile.number}
                      type="button"
                      onClick={(e) => clickBay(e, r.tile.number)}
                      title={`${r.tile.title} · ${r.tile.detail} — ${holder ? holder.name : BAY_LABEL[r.state]}${r.space?.numberPlate ? ` · ${r.space.numberPlate}` : ''}`}
                      className={`absolute flex items-center justify-center border rounded-[3px] font-bold leading-none tabular-nums shadow-sm transition-colors ${BAY_STYLE[r.state]} ${
                        bayPick.includes(r.tile.number) ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''
                      }`}
                      // A desk tile is half the width of a bay, so its number
                      // needs the smaller type to stay inside the seat.
                      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
                        fontSize: r.tile.kind === 'desk' ? 'clamp(5px, 0.55cqw, 11px)' : 'clamp(7px, 0.8cqw, 16px)' }}
                    >
                      {r.tile.number}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend + unplaced */}
        {!isParking && (
          <div className="flex gap-5 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-900 inline-block" /> Occupied</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Lease ending ≤3 months</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Vacant</span>
            {showRooms && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block" /> Meeting room</span>}
          </div>
        )}
        {hasTiles && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-muted-foreground">
            {!isParking && <span className="font-semibold text-foreground">Dedicated desks</span>}
            {['occupied', 'ending', 'reserved', 'vacant'].map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm border inline-block ${BAY_STYLE[k]}`} /> {BAY_LABEL[k]}
              </span>
            ))}
            <span className="ml-auto">Click a {isParking ? 'bay' : 'desk'} to allocate it · shift-click to select several</span>
          </div>
        )}

        {unplaced.length > 0 && (
          <div className="mt-4 border border-dashed border-input rounded-md p-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Unplaced spaces ({unplaced.length}) — click to pin onto the plan
            </div>
            <div className="flex flex-wrap gap-2">
              {unplaced.map((s) => {
                const room = isRoom(s)
                return (
                  <button
                    key={s.id}
                    onClick={() => setPlacingId(s.id)}
                    title={room ? roomTitle(s) : undefined}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      placingId === s.id ? 'bg-blue-600 text-white border-blue-600'
                      : room ? 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                      : 'bg-card border-input text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {room ? <Presentation size={11} className="inline mr-1" /> : <MapPin size={11} className="inline mr-1" />}
                    {s.unitNumber}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Allocation panel — car park bays and dedicated desks alike */}
      {picked.length > 0 && (
        <div className="w-64 shrink-0 bg-card border border-border rounded-xl p-4 sticky top-4 self-start">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-bold text-foreground text-base">
                {picked.length === 1 ? picked[0].tile.title : `${picked.length} ${tileNoun}s selected`}
              </div>
              {picked.length === 1 && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {floorLabel(plan.floor)} · {picked[0].tile.detail}
                </div>
              )}
            </div>
            <button onClick={() => setBayPick([])} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>

          <div className="space-y-1.5 mb-3 max-h-64 overflow-y-auto">
            {picked.map((r) => {
              const holder = holderOf(r)
              return (
                <div key={r.tile.number} className="flex items-center gap-2 text-sm">
                  <span className={`w-10 shrink-0 text-center text-[11px] font-bold rounded-[3px] border py-0.5 ${BAY_STYLE[r.state]}`}>{r.tile.number}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {holder
                      ? <><span className="text-foreground">{holder.name}</span>{holder.company && <span className="text-muted-foreground"> · {holder.company}</span>}</>
                      : <span className="text-muted-foreground">{BAY_LABEL[r.state]}</span>}
                  </span>
                  {picked.length > 1 && r.space?.numberPlate && (
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-muted-foreground">{r.space.numberPlate}</span>
                  )}
                </div>
              )
            })}
          </div>

          {picked.length === 1 && picked[0].space && (() => {
            const sp = picked[0].space
            return (
              <div className="space-y-2.5 text-xs border-t border-border pt-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monthly</span>
                  <span className="font-semibold text-foreground">{sp.includedInContract ? PARKING_INCLUDED_LABEL : money(sp.monthlyRate ?? sp.rate)}</span>
                </div>
                {!isParking && <p className="text-muted-foreground">Repriced in Spaces → Dedicated Desks.</p>}
                {isParking && (<>
                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                  <input type="checkbox" checked={!!sp.includedInContract} onChange={(e) => setIncluded(sp, e.target.checked)} />
                  Included in licence — no separate charge
                </label>
                <label className="block">
                  <span className="block text-muted-foreground mb-1">Number plate</span>
                  <input
                    key={sp.id}
                    defaultValue={sp.numberPlate || ''}
                    placeholder="e.g. ABC123"
                    onBlur={(e) => savePlate(sp, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    className="w-full border border-input rounded-md px-2 py-1.5 text-sm uppercase tracking-wider bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                </label>
                </>)}
              </div>
            )
          })()}

          {allocatable.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <SearchSelect aria-label="Member or contact"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="w-full border border-input rounded-md px-2 py-1.5 text-sm bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">Choose a member…</option>
                {memberOpts.map((m) => <option key={m.id} value={m.id} data-search={[m.email, m.phone, m.search].filter(Boolean).join(' ')}>{m.label}</option>)}
              </SearchSelect>
              <button
                onClick={allocate}
                disabled={!assignTo}
                className="w-full bg-primary text-primary-foreground text-xs font-semibold py-2 rounded hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {`${allocatable.every((r) => r.space.assignedMemberId) ? 'Reassign' : 'Allocate'} ${allocatable.length === 1 ? tileNoun : `${allocatable.length} ${tileNoun}s`}`}
              </button>
            </div>
          )}
          {memberHeld.length > 0 && (
            <button onClick={unassign} className="w-full mt-2 text-xs text-muted-foreground hover:text-red-600 border border-input rounded py-1.5">
              {picked.length === 1 ? `Unassign ${tileNoun}` : `Unassign ${memberHeld.length} ${tileNoun}${memberHeld.length === 1 ? '' : 's'}`}
            </button>
          )}
          {onContract > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {picked.length === 1 ? `This ${tileNoun} is on a contract` : `${onContract} of these ${tileNoun}s ${onContract === 1 ? 'is' : 'are'} on a contract`} — change {onContract === 1 ? 'it' : 'them'} from the contract.
            </p>
          )}
          {notSetUp > 0 && (
            <p className="text-xs text-amber-700 mt-3">
              {picked.length === 1 ? `This ${tileNoun} isn’t` : `${notSetUp} of these ${tileNoun}s aren’t`} set up yet — use “{isParking ? 'Update bays' : 'Add desks'}” above.
            </p>
          )}
          {picked.length === 1 && <p className="text-[11px] text-muted-foreground mt-3">Shift-click more {tileNoun}s to allocate several at once.</p>}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="w-60 shrink-0 bg-card border border-border rounded-xl p-4 sticky top-4 self-start">
          <div className="flex items-start justify-between mb-3">
            <div className="font-bold text-foreground text-base">{selected.unitNumber}</div>
            <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          {selRoom ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Type</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-600 text-white">Meeting room</span>
              </div>
              {roomSeats(selected) && (
                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Capacity</span><span className="text-sm text-foreground">{roomSeats(selected)}</span></div>
              )}
              {selected.hourlyRate > 0 && (
                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Hourly</span><span className="text-sm font-semibold text-foreground">${Number(selected.hourlyRate).toLocaleString('en-AU')}</span></div>
              )}
              {selected.attributes && <p className="text-xs text-muted-foreground pt-1 leading-relaxed">{selected.attributes}</p>}
            </div>
          ) : (
          <>
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                selState === 'occupied' ? 'bg-gray-900 text-white'
                : selState === 'ending' ? 'bg-amber-50 text-amber-800 border border-amber-300'
                : 'bg-green-50 text-green-800 border border-green-200'}`}>{selStateLabel}</span>
            </div>
            {selected.size && <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Size</span><span className="text-sm text-foreground">{selected.size}</span></div>}
            {selected.monthlyRate != null && <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Monthly</span><span className="text-sm font-semibold text-foreground">${Number(selected.monthlyRate).toLocaleString('en-AU')}</span></div>}
          </div>
          {selectedTenant && (
            <div className="pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current tenant</div>
              <div className="font-semibold text-foreground text-sm">{selectedTenant.businessName}</div>
              {selectedLease?.endDate && isValid(parseISO(selectedLease.endDate)) && <div className="text-xs text-muted-foreground mt-1">Lease to {format(parseISO(selectedLease.endDate), 'dd/MM/yyyy')}</div>}
            </div>
          )}
          {selState === 'vacant' && onNewContract && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-green-700 font-semibold mb-2">Available now</p>
              <button onClick={() => onNewContract(selected)} className="w-full bg-primary text-primary-foreground text-xs font-semibold py-2 rounded hover:bg-primary/90">+ New Contract</button>
            </div>
          )}
          </>
          )}
          <div className="pt-3 mt-1 border-t border-border">
            <button onClick={() => { updateSpace(selected.id, { pos: null, floor: null }); setSelectedId(null) }} className="text-xs text-muted-foreground hover:text-red-600">Unpin from plan</button>
          </div>
        </div>
      )}
    </div>
  )
}
