// The one price list behind every brochure and proposal PDF.
//
// Before this, the headline prices lived as typed text inside proposalPdf.js,
// the proposal form pre-filled its own numbers, and the platform held a third
// set — Sept 2026 had the brochure on $500 desks / $300 flexi while the
// platform listed $650, and the room table quoted rates and a $20 credit the
// booking engine has never charged. Now:
//   · headline plan prices are edited once, in Settings → Price List, and
//     stored on settings.priceList (these defaults fill any gap);
//   · Virtual Office prices are NOT editable there: VO_PACKAGES also decides
//     which inclusions the signed VO agreement prints (voInclusions keys on the
//     $150 Plus price), so a Settings edit would quote one thing and sign
//     another. Change them in virtualSuites.js;
//   · meeting-room rates are NOT kept here — they come live from each room's
//     hourly rate in Spaces, the same number bookings are charged at;
//   · credit value and credits per plan come from credits.js, the numbers the
//     booking engine actually draws down.

import { CREDIT_VALUE, MEMBERSHIP_CREDITS } from './credits.js'
import { VO_PACKAGES } from './virtualSuites.js'
import { PARKING_RATE } from './parkingBays.js'
import { DESK_RATE } from './deskBays.js'

export const PRICE_LIST_DEFAULTS = {
  privateOfficeFrom: 700, // per desk, per month
  dedicatedDesk: DESK_RATE,
  flexible: 450,
  voAddress: VO_PACKAGES.address,
  voPlus: VO_PACKAGES.plus,
  parking: PARKING_RATE,
  printingMonthly: 30,
  printBW: 0.3,
  printColour: 0.6,
}

// Labels for Settings → Price List, in display order.
export const PRICE_LIST_FIELDS = [
  { key: 'privateOfficeFrom', label: 'Private office — from', unit: '/ desk / month' },
  { key: 'dedicatedDesk', label: 'Dedicated desk', unit: '/ month' },
  { key: 'flexible', label: 'Flexible membership', unit: '/ month' },
  { key: 'parking', label: 'Car park', unit: '/ bay / month' },
  { key: 'printingMonthly', label: 'Printing', unit: '/ month' },
  { key: 'printBW', label: 'Printing — black & white', unit: '/ page', step: 0.05 },
  { key: 'printColour', label: 'Printing — colour', unit: '/ page', step: 0.05 },
]

// Defaults overlaid with whatever has been saved; a blank or non-numeric value
// falls back rather than printing "$0" on a brochure.
export function resolvePriceList(settings) {
  const saved = settings?.priceList ?? {}
  const out = { ...PRICE_LIST_DEFAULTS }
  for (const { key: k } of PRICE_LIST_FIELDS) {
    const n = Number(saved[k])
    if (saved[k] !== '' && saved[k] != null && Number.isFinite(n) && n >= 0) out[k] = n
  }
  return out
}

// Credits per plan and what they're worth — straight from the booking engine.
export function planCredits() {
  const value = (n) => n * CREDIT_VALUE
  return {
    creditValue: CREDIT_VALUE,
    flexible: { credits: MEMBERSHIP_CREDITS['Flexible Desk'], value: value(MEMBERSHIP_CREDITS['Flexible Desk']) },
    dedicated: { credits: MEMBERSHIP_CREDITS['Dedicated Desk'], value: value(MEMBERSHIP_CREDITS['Dedicated Desk']) },
    officePerDesk: { credits: MEMBERSHIP_CREDITS['Private Office'], value: value(MEMBERSHIP_CREDITS['Private Office']) },
  }
}

// What a room is for, shown after its name on the rate table.
const ROOM_NOTES = {
  hx_mr_sky: 'Consulting', hx_mr_earth: 'Consulting',
  hx_mr_east: 'Chinese Tearoom',
  hx_mr_central: 'Boardroom',
  hx_func: 'North + South + West',
}
const ROOM_NAMES = { hx_func: 'Function Space', hx_mr_east: 'East' }

const BOOKABLE = new Set(['meeting', 'studio', 'podcast'])

const trimNum = (n) => String(Math.round(n * 100) / 100)

// The rate table, built from the rooms themselves. Rooms with the same rate and
// capacity share a row ("North · South"), cheapest first. A room with no hourly
// rate is left off — it can't be booked at a price, so it can't be quoted.
export function roomRateRows(spaces = []) {
  const groups = new Map()
  for (const s of spaces ?? []) {
    if (!BOOKABLE.has(s?.type)) continue
    const rate = Number(s.hourlyRate)
    if (!Number.isFinite(rate) || rate <= 0) continue
    const cap = Number(s.capacity ?? s.pax) || null
    const key = `${rate}|${cap ?? ''}`
    const g = groups.get(key) ?? { rate, capacity: cap, names: [], note: '' }
    g.names.push(ROOM_NAMES[s.id] ?? s.unitNumber)
    g.note ||= ROOM_NOTES[s.id] ?? ''
    groups.set(key, g)
  }
  return [...groups.values()]
    .sort((a, b) => a.rate - b.rate || (a.capacity ?? 0) - (b.capacity ?? 0))
    .map((g) => ({
      room: g.names.join(' · ') + (g.note ? ` (${g.note})` : ''),
      capacity: g.capacity ? String(g.capacity) : '—',
      credits: trimNum(g.rate / CREDIT_VALUE),
      rate: g.rate,
    }))
}

export const fromRate = (rows) => (rows.length ? Math.min(...rows.map((r) => r.rate)) : null)
