// Which floor a bookable space sits on — wayfinding for the member app
// ("Sun · Level 2") so nobody arrives on the wrong floor for their booking.
//
// Two sources, in order:
//  1. Sun, Moon and Central are Level 2 by name. That's the same rule
//     scripts/set-room-floors.mjs writes into Supabase; it lives here too so a
//     space record that predates that script (or the local seed) still reads
//     correctly rather than inheriting a stale `floor`.
//  2. the space's own `floor` field — 'l2' / 'l4' / 'l5', or a bare '2'.
//
// Meeting rooms with neither fall back to Level 4: the rest of them are up
// there. Other space types (desks, suites, studios) report no floor unless
// their record says so — better silent than wrong.

export const FLOOR_LABELS = { l2: 'Level 2', l4: 'Level 4', l5: 'Level 5' }

const LEVEL_2_ROOMS = new Set(['sun', 'moon', 'central'])
// "Sun (Ri / 日)" → "sun"
const leadWord = (name) => String(name ?? '').trim().toLowerCase().split(/[\s(/·—-]/)[0]

/** 'l2' | 'l4' | 'l5' | null — the floor code for a space. */
export function floorOf(space) {
  if (!space) return null
  if (LEVEL_2_ROOMS.has(leadWord(space.unitNumber))) return 'l2'
  const raw = String(space.floor ?? '').trim().toLowerCase()
  const code = /^\d+$/.test(raw) ? `l${raw}` : raw
  if (FLOOR_LABELS[code]) return code
  return space.type === 'meeting' ? 'l4' : null
}

/** 'Level 2' — or '' when the floor isn't known. */
export function floorLabel(space) {
  const code = floorOf(space)
  return code ? FLOOR_LABELS[code] : ''
}

/** 'Level 2' from a stored floor code ('l2' / '2'). */
export function floorLabelFor(code) {
  const c = String(code ?? '').trim().toLowerCase()
  const key = /^\d+$/.test(c) ? `l${c}` : c
  return FLOOR_LABELS[key] ?? (c ? `Level ${c.replace(/^l/, '')}` : '')
}
