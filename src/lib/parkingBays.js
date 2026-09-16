// Hexa Space's numbered car park bays at 830 Whitehorse Road.
//
// Traced from the "Car Park Panorama" drawings (podium Levels 2-4) and drawn on
// public/floorplans/hexa-parking-l*.png — the page sources are in
// docs/floorplans/parking. A bay's number is its drawing reference without the
// level dot (L4.12 → 412). `box` is [left, top, width, height] as a percentage of
// that level's plan image, the same convention as HIGHLIGHTS in floorplans.js.

export const PARKING_PLANS = [
  { id: 'hexa-p2', floor: 'l2', label: 'Car Park L2', src: '/floorplans/hexa-parking-l2.png' },
  { id: 'hexa-p3', floor: 'l3', label: 'Car Park L3', src: '/floorplans/hexa-parking-l3.png' },
  { id: 'hexa-p4', floor: 'l4', label: 'Car Park L4', src: '/floorplans/hexa-parking-l4.png' },
]

export const PARKING_BAYS = [
  { number: '201', ref: 'L2.01', lot: 'S72', floor: 'l2', box: [25.44, 46.73, 2.87, 7.15] },
  { number: '202', ref: 'L2.02', lot: 'S72', floor: 'l2', box: [28.35, 45.34, 2.66, 7.15] },
  { number: '207', ref: 'L2.07', lot: 'S6', floor: 'l2', box: [61.1, 46.33, 2.76, 7.12] },
  { number: '208', ref: 'L2.08', lot: 'S72', floor: 'l2', box: [64.91, 46.33, 2.76, 7.12] },
  { number: '209', ref: 'L2.09', lot: 'S72', floor: 'l2', box: [67.71, 46.33, 2.76, 7.12] },
  { number: '210', ref: 'L2.10', lot: 'S71', floor: 'l2', box: [71.45, 46.33, 2.76, 7.12] },
  { number: '211', ref: 'L2.11', lot: 'S71', floor: 'l2', box: [74.26, 46.33, 2.76, 7.12] },
  { number: '213', ref: 'L2.13', lot: 'S6', floor: 'l2', box: [61.1, 38.42, 2.76, 7.85] },
  { number: '214', ref: 'L2.14', lot: 'S72', floor: 'l2', box: [64.91, 38.42, 2.76, 7.85] },
  { number: '215', ref: 'L2.15', lot: 'S72', floor: 'l2', box: [67.71, 38.42, 2.76, 7.85] },
  { number: '216', ref: 'L2.16', lot: 'S71', floor: 'l2', box: [71.45, 38.42, 2.76, 7.85] },
  { number: '217', ref: 'L2.17', lot: 'S71', floor: 'l2', box: [74.26, 38.42, 2.76, 7.85] },
  { number: '224', ref: 'L2.24', lot: 'S71', floor: 'l2', box: [54.5, 62.36, 2.87, 7.15] },
  { number: '225', ref: 'L2.25', lot: 'S71', floor: 'l2', box: [51.59, 62.36, 2.87, 7.15] },
  { number: '226', ref: 'L2.26', lot: 'S71', floor: 'l2', box: [47.9, 62.36, 2.87, 7.15] },
  { number: '227', ref: 'L2.27', lot: 'S72', floor: 'l2', box: [44.99, 62.36, 2.87, 7.15] },
  { number: '308', ref: 'L3.08', lot: 'S8', floor: 'l3', box: [64.88, 46.33, 2.76, 7.12] },
  { number: '314', ref: 'L3.14', lot: 'S8', floor: 'l3', box: [64.88, 38.42, 2.76, 7.85] },
  { number: '405', ref: 'L4.05', lot: 'S34', floor: 'l4', box: [44.94, 45.86, 2.69, 7.15] },
  { number: '406', ref: 'L4.06', lot: 'S34', floor: 'l4', box: [58.28, 46.33, 2.76, 7.12] },
  { number: '407', ref: 'L4.07', lot: 'S34', floor: 'l4', box: [61.09, 46.33, 2.76, 7.12] },
  { number: '408', ref: 'L4.08', lot: 'S34', floor: 'l4', box: [64.88, 46.33, 2.76, 7.12] },
  { number: '409', ref: 'L4.09', lot: 'S35', floor: 'l4', box: [67.69, 46.33, 2.76, 7.12] },
  { number: '410', ref: 'L4.10', lot: 'S92', floor: 'l4', box: [71.48, 46.33, 2.76, 7.12] },
  { number: '411', ref: 'L4.11', lot: 'S92', floor: 'l4', box: [74.29, 46.33, 2.76, 7.12] },
  { number: '412', ref: 'L4.12', lot: 'S34', floor: 'l4', box: [58.28, 38.42, 2.76, 7.85] },
  { number: '413', ref: 'L4.13', lot: 'S34', floor: 'l4', box: [61.09, 38.42, 2.76, 7.85] },
  { number: '414', ref: 'L4.14', lot: 'S34', floor: 'l4', box: [64.88, 38.42, 2.76, 7.85] },
  { number: '415', ref: 'L4.15', lot: 'S35', floor: 'l4', box: [67.69, 38.42, 2.76, 7.85] },
  { number: '416', ref: 'L4.16', lot: 'S92', floor: 'l4', box: [71.48, 38.42, 2.76, 7.85] },
  { number: '417', ref: 'L4.17', lot: 'S92', floor: 'l4', box: [74.29, 38.42, 2.76, 7.85] },
  { number: '418', ref: 'L4.18', lot: 'S36', floor: 'l4', box: [74.29, 62.36, 2.86, 7.15] },
  { number: '419', ref: 'L4.19', lot: 'S36', floor: 'l4', box: [71.38, 62.36, 2.86, 7.15] },
  { number: '420', ref: 'L4.20', lot: 'S35', floor: 'l4', box: [67.69, 62.36, 2.87, 7.15] },
  { number: '421', ref: 'L4.21', lot: 'S35', floor: 'l4', box: [64.77, 62.36, 2.87, 7.15] },
  { number: '422', ref: 'L4.22', lot: 'S35', floor: 'l4', box: [61.09, 62.36, 2.87, 7.15] },
  { number: '423', ref: 'L4.23', lot: 'S35', floor: 'l4', box: [58.17, 62.36, 2.87, 7.15] },
  { number: '424', ref: 'L4.24', lot: 'S35', floor: 'l4', box: [54.48, 62.36, 2.87, 7.15] },
  { number: '425', ref: 'L4.25', lot: 'S35', floor: 'l4', box: [51.57, 62.36, 2.87, 7.15] },
  { number: '426', ref: 'L4.26', lot: 'S35', floor: 'l4', box: [47.88, 62.36, 2.86, 7.15] },
  { number: '427', ref: 'L4.27', lot: 'S92', floor: 'l4', box: [44.97, 62.36, 2.86, 7.15] },
  { number: '428', ref: 'L4.28', lot: 'S92', floor: 'l4', box: [41.28, 62.36, 2.86, 7.15] },
  { number: '429', ref: 'L4.29', lot: 'S92', floor: 'l4', box: [38.37, 62.36, 2.86, 7.15] },
  { number: '430', ref: 'L4.30', lot: 'S92', floor: 'l4', box: [34.67, 62.36, 2.87, 7.15] },
  { number: '431', ref: 'L4.31', lot: 'S92', floor: 'l4', box: [31.76, 62.36, 2.87, 7.15] },
]

// Monthly rate a newly set-up bay starts at; change any bay in Spaces → Parking.
export const PARKING_RATE = 200

// Shown instead of a price for a bay that comes with the member's licence.
export const PARKING_INCLUDED_LABEL = 'Included in licence'

// Billing tells parking lines from rent by the `_park_` in a space id, so every
// bay keeps this id shape.
export const parkingSpaceId = (number) => `hx_park_${number}`

// Spaces the numbered layout replaced: the P1–P4 placeholders, and bays that
// turned out not to be ours. Set-up removes them unless one is still in use.
export const RETIRED_PARKING_IDS = ['hx_park_1', 'hx_park_2', 'hx_park_3', 'hx_park_4', 'hx_park_432']

// The Spaces record a bay starts life as.
export function parkingBaySpace(bay) {
  return {
    id: parkingSpaceId(bay.number), unitNumber: bay.number, type: 'parking',
    size: `${bay.ref} · Lot ${bay.lot}`, monthlyRate: PARKING_RATE, rate: PARKING_RATE,
    status: 'vacant', location: 'whitehorse', address: '830 Whitehorse Rd, Box Hill',
    floor: bay.floor, attributes: '',
  }
}

// A bay's space: its own id, or a parking space already given the same number.
export function spaceForBay(bay, spaces = []) {
  return spaces.find((s) => s.id === parkingSpaceId(bay.number)) ||
    spaces.find((s) => s.type === 'parking' && String(s.unitNumber) === bay.number) || null
}

export function missingParkingBays(spaces = []) {
  return PARKING_BAYS.filter((bay) => !spaceForBay(bay, spaces))
}

// Held by anyone: allocated to a member, tagged with an occupant, or on a live contract.
export function isParkingSpaceInUse(space, leases = []) {
  if (['occupied', 'reserved'].includes(space.status)) return true
  if (space.assignedMemberId || space.occupantTenantId || space.occupantName) return true
  return leases.some((l) => ['active', 'pending'].includes(l.status) &&
    [l.spaceId, ...(l.items ?? []).map((i) => i.spaceId)].includes(space.id))
}

// Retired spaces nothing uses any more — the ones set-up may remove.
export function retiredParkingSpaces(spaces = [], leases = []) {
  return spaces.filter((s) => RETIRED_PARKING_IDS.includes(s.id) && !isParkingSpaceInUse(s, leases))
}

// Plate as recorded: upper case, single spaces.
export const normalisePlate = (value) => String(value ?? '').toUpperCase().replace(/\s+/g, ' ').trim()

// What the set-up banner asks for, or '' when Spaces already matches the plans.
export function parkingSetupPrompt(missing = 0, retired = 0) {
  return [
    missing ? `${missing} numbered car park bay${missing === 1 ? ' isn’t' : 's aren’t'} in Spaces yet` : '',
    retired ? `${retired} old bay${retired === 1 ? '' : 's'} to remove` : '',
  ].filter(Boolean).join(' · ')
}

// One-line result of the store's setUpParkingBays(), for a confirmation banner.
export function parkingSetupSummary({ created = 0, removed = [], kept = [] } = {}) {
  return [
    created ? `Added ${created} car park bay${created === 1 ? '' : 's'} at $${PARKING_RATE}/mo.` : '',
    removed.length ? `Removed ${removed.join(', ')} — no longer in the car park layout.` : '',
    kept.length ? `Kept ${kept.join(', ')} — still assigned or on a contract.` : '',
  ].filter(Boolean).join(' ') || 'Car park bays are already up to date.'
}
