// Hexa Space's dedicated desks on Level 4.
//
// Traced from public/floorplans/hexa-l4.png — the green "Dedicated Desks" band
// running under Offices 1-10. The band holds six pods; each pod is one desk
// block split down the middle with a chair either side, so a pod seats TWO
// members. Desks are numbered left to right as you read the plan: Desk 1 is the
// leftmost seat (nearest Office 1), Desk 12 the rightmost (nearest the phone
// booths).
//
// `box` is [left, top, width, height] as a percentage of the Level 4 plan image
// (2000x1414), the same convention as PARKING_BAYS in parkingBays.js. A desk's
// box is its own chair plus its half of the shared surface.

const POD_X = [359, 432, 503, 575, 648, 720] // pod left edge, in image pixels
const SEAT_W = 25.5                           // half a pod
const BAND_Y = 414
const BAND_H = 40
const IMG_W = 2000
const IMG_H = 1414

const pct = (n, total) => Math.round((n / total) * 10000) / 100

export const DESK_POSITIONS = POD_X.flatMap((x, pod) =>
  [0, 1].map((seat) => ({
    number: String(pod * 2 + seat + 1),
    pod: pod + 1,
    seat: seat === 0 ? 'left' : 'right',
    floor: 'l4',
    box: [
      pct(x + seat * SEAT_W, IMG_W),
      pct(BAND_Y, IMG_H),
      pct(SEAT_W, IMG_W),
      pct(BAND_H, IMG_H),
    ],
  })))

// The asking rate a newly set-up desk starts at. This is the LIST price the
// Spaces tab and the floor plan quote — a live contract keeps whatever it was
// signed at (billingEngine prices from the lease's schedule, never from here),
// which is why the two desks on contracts still run at $332.50 and $400.
export const DESK_RATE = 650

// Typed `desk` but NOT a desk on the floor: Flexible Access is a membership
// product with no seat of its own, so it must never claim a position.
export const NON_POSITION_DESK_IDS = ['hx_xa_flexibleaccess']

export const deskSpaceId = (number) => `hx_desk_${number}`

/** The Spaces record a desk starts life as. */
export function deskSpace(desk) {
  return {
    id: deskSpaceId(desk.number), unitNumber: `Dedicated Desk ${desk.number}`, type: 'desk',
    size: `Pod ${desk.pod} · ${desk.seat} seat`, monthlyRate: DESK_RATE, rate: DESK_RATE,
    status: 'vacant', location: 'whitehorse', address: '830 Whitehorse Rd, Box Hill',
    floor: desk.floor, attributes: '',
  }
}

/** A desk's space: its own id, or a desk space already carrying that number. */
export function spaceForDesk(desk, spaces = []) {
  if (!desk) return null
  return spaces.find((s) => s.id === deskSpaceId(desk.number)) ||
    spaces.find((s) => s.type === 'desk' && !NON_POSITION_DESK_IDS.includes(s.id) &&
      String(s.unitNumber ?? '').trim() === `Dedicated Desk ${desk.number}`) || null
}

export function missingDeskPositions(spaces = []) {
  return DESK_POSITIONS.filter((desk) => !spaceForDesk(desk, spaces))
}

/** Held by anyone: allocated to a member, tagged with an occupant, or on a live contract. */
export function isDeskSpaceInUse(space, leases = []) {
  if (!space) return false
  if (['occupied', 'reserved'].includes(space.status)) return true
  if (space.assignedMemberId || space.occupantTenantId || space.occupantName) return true
  return leases.some((l) => ['active', 'pending'].includes(l.status) &&
    [l.spaceId, ...(l.items ?? []).map((i) => i.spaceId)].includes(space.id))
}

/** What the set-up banner asks for, or '' when Spaces already matches the plan. */
export function deskSetupPrompt(missing = 0) {
  if (!missing) return ''
  return `${missing} dedicated desk${missing === 1 ? " isn't" : "s aren't"} in Spaces yet`
}

/** Plain-English result of a set-up run. */
export function deskSetupSummary({ created = 0 } = {}) {
  return created ? `Added ${created} dedicated desk${created === 1 ? '' : 's'}.` : 'Spaces already matches the Level 4 plan.'
}
