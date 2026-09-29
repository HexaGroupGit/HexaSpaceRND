// Office boxes for the interactive floor plan.
//
// The offices were already traced once — HIGHLIGHTS in floorplans.js, calibrated
// by Eric in July 2026 with the drag/stretch mapper and verified visually. Those
// coordinates are percentages of the PROPOSAL plan images (proposal-l*.png).
// The interactive plan renders the branded board images (hexa-l*.png), which are
// the same drawing at a different scale and offset inside the same 2000x1414
// canvas — the board versions sit in a white card below a logo and above a
// legend, so the plan itself is smaller and pushed down.
//
// Rather than keep a second copy of 42 boxes that could drift out of step, the
// interactive boxes are DERIVED from that one calibration. Re-trace an office
// for the proposal and the floor plan follows automatically.
//
// The transform per floor was measured by taking the bounding box of the line
// work in each image pair (ignoring the board's header and legend bands, and
// skipping transparent pixels — the proposal PNGs carry an alpha channel, so a
// naive RGB test reads the transparent margin as black). Checked against an
// independent landmark on Level 4, the green dedicated-desk band, which agreed
// to within two pixels. To redo it: measure the same bounding boxes and refit.

import { HIGHLIGHTS } from './floorplans.js'

const IMG_W = 2000
const IMG_H = 1414

// hexa_px = scale * proposal_px + offset, per floor, in image pixels.
const TRANSFORM = {
  l2: { sx: 0.86819, sy: 0.86898, ox: 107.14, oy: 25.43 },
  l4: { sx: 0.87742, sy: 0.87612, ox: 141.64, oy: 24.22 },
  l5: { sx: 0.69533, sy: 0.69202, ox: 406.20, oy: 140.35 },
}

const round2 = (n) => Math.round(n * 100) / 100

/** A proposal-space box as a box on the interactive plan, or null. */
function toPlanBox(floor, box) {
  const t = TRANSFORM[floor]
  if (!t || !box) return null
  const [left, top, width, height] = box
  return [
    round2(t.sx * left + (t.ox / IMG_W) * 100),
    round2(t.sy * top + (t.oy / IMG_H) * 100),
    round2(t.sx * width),
    round2(t.sy * height),
  ]
}

// Every number in a unit name: "Office 4" → ["4"], "Suite 15" → ["15"], and
// "Suite 15 + 16" → ["15", "16"]. Suites get merged for a tenant who takes two,
// and the merged space is one record — so it needs one box covering both.
const keysOf = (unitNumber) => String(unitNumber ?? '').match(/\d+/g) ?? []

/** The smallest box containing all of them. */
function union(boxes) {
  const right = Math.max(...boxes.map(([l, , w]) => l + w))
  const bottom = Math.max(...boxes.map(([, t, , h]) => t + h))
  const left = Math.min(...boxes.map(([l]) => l))
  const top = Math.min(...boxes.map(([, t]) => t))
  return [left, top, right - left, bottom - top]
}

/** The traced box for this office on this floor, or null if it has none. */
export function officeBoxFor(floor, unitNumber) {
  const map = HIGHLIGHTS[floor]
  if (!map) return null
  const boxes = keysOf(unitNumber).map((k) => map[k]).filter(Boolean)
  if (!boxes.length) return null
  return toPlanBox(floor, boxes.length === 1 ? boxes[0] : union(boxes))
}

/** Every office on a floor that has a traced box, as tile definitions. */
export function officeBoxesOn(floor, spaces = []) {
  return spaces
    .filter((s) => s.type === 'office' && s.floor === floor)
    .map((space) => ({ space, box: officeBoxFor(floor, space.unitNumber) }))
    .filter((t) => t.box)
}

/** Offices on this floor with no traced box — they still use a pinned marker. */
export function officesWithoutBoxes(floor, spaces = []) {
  return spaces.filter((s) => s.type === 'office' && s.floor === floor && !officeBoxFor(floor, s.unitNumber))
}
