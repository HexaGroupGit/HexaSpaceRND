// Seoul Bakery drinks — shared menu categories + the ordering-hours guard.
// Used by the member app (Food tab) and the admin Food Orders page so both
// agree on category order and on when ordering is open.
//
// We only sell drinks from the bakery, ordered 9:30am–5:00pm Melbourne time.

export const DRINK_CATEGORIES = [
  'Black Coffee',
  'White Coffee',
  'Non-Coffee',
  'Tea',
  'Iced Coffee',
  'Specialty Iced',
  'Non-Coffee Iced',
  'Seoul Sparkle',
]

// Kitchen hours, Melbourne time. Orders are refused outside this window on both
// the client (menu is disabled) and the server (payment endpoints reject).
export const ORDER_OPEN_MIN = 9 * 60 + 30 // 09:30
export const ORDER_CLOSE_MIN = 17 * 60 // 17:00
export const ORDER_HOURS_LABEL = '9:30am – 5:00pm'

// Minutes since midnight in Melbourne, DST-correct via the IANA zone.
export function melbourneMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const h = Number(parts.find((p) => p.type === 'hour').value)
  const m = Number(parts.find((p) => p.type === 'minute').value)
  return h * 60 + m
}

export function isOrderingOpen(date = new Date()) {
  const mins = melbourneMinutes(date)
  return mins >= ORDER_OPEN_MIN && mins < ORDER_CLOSE_MIN
}
