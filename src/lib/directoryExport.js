// Directory board exports: a PNG (print it, or drop it on a screen) and a
// self-contained HTML file (open it from a USB stick — the ground floor and the
// lower levels have no internet, so the live tv.html link is no use down there).
//
// Both render the same markup from directoryHtml.js. The PNG is composited in
// two passes: html2canvas draws the text on a transparent canvas, then the
// backdrop is painted natively underneath — html2canvas only partially
// understands multi-stop elliptical gradients, and the board is mostly backdrop.
//
// The PNG comes out at a fixed portrait size (see PNG_SIZE): the panels are
// printed to one physical size, so every board has to be the same file size
// whatever it happens to contain. The board is laid out to fill that panel
// rather than float in the middle of it — see fillWidth.

import html2canvas from 'html2canvas'
import { boardBodyHtml, boardStyles, buildBoardDocument, layoutOf, BOARD_WIDTH } from './directoryHtml.js'
import { BOARD_LABELS } from './directoryData.js'

// Exact pixel size of every exported PNG — the printed panel dimensions.
export const PNG_SIZE = { width: 1510, height: 2644 }

const today = () => new Date().toISOString().slice(0, 10)

function fileBase(board) {
  const label = BOARD_LABELS[board?.level] || `Level ${board?.level ?? ''}`
  return `hexa-directory-${label.toLowerCase().replace(/\s+/g, '-')}-${today()}`
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// ── Backdrop, painted to match BOARD_BACKDROP in directoryHtml.js ───────────
// CSS radial-gradients are elliptical; canvas gradients are circular. Squash
// the context so one circle draws as the right ellipse.
function radial(ctx, cx, cy, rx, ry, stops) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  stops.forEach(([at, color]) => g.addColorStop(at, color))
  ctx.fillStyle = g
  // Big enough to cover the whole (unsquashed) canvas from this origin.
  const reach = (Math.max(ctx.canvas.width, ctx.canvas.height) * 2) / (ry / rx)
  ctx.fillRect(-reach, -reach, reach * 2, reach * 2)
  ctx.restore()
}

// The faint 135° pinstripe texture: 1px lines, 9px apart.
function stripes(ctx, w, h, color, gap) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.translate(w / 2, h / 2)
  ctx.rotate(-Math.PI / 4)
  const reach = Math.max(w, h)
  for (let x = -reach; x <= reach; x += gap) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, -reach)
    ctx.lineTo(x + 0.5, reach)
    ctx.stroke()
  }
  ctx.restore()
}

// Layers paint bottom-up (CSS lists them top-down).
function paintBackdrop(ctx, w, h, layout, scale) {
  if (layout === 'lobby') {
    ctx.fillStyle = '#0b0b0e'
    ctx.fillRect(0, 0, w, h)
    radial(ctx, 0.5 * w, 0.24 * h, 1.2 * w, 1.1 * h, [[0, '#191919'], [0.48, '#111114'], [1, '#08080a']])
    stripes(ctx, w, h, 'rgba(255,255,255,0.014)', 9 * scale)
    radial(ctx, 0.12 * w, 0, 0.9 * w, 0.6 * h, [[0, 'rgba(200,167,94,0.10)'], [1, 'rgba(11,11,14,0)']])
  } else {
    ctx.fillStyle = '#14151a'
    ctx.fillRect(0, 0, w, h)
    radial(ctx, 0.5 * w, 0.26 * h, 1.25 * w, 1.15 * h, [[0, '#1e2126'], [0.45, '#14151a'], [1, '#0a0a0c']])
    stripes(ctx, w, h, 'rgba(255,255,255,0.016)', 9 * scale)
    radial(ctx, 0.22 * w, 0.06 * h, 1.15 * w, 0.75 * h, [[0, 'rgba(140,150,170,0.13)'], [0.55, 'rgba(20,21,26,0)'], [1, 'rgba(20,21,26,0)']])
  }
}

// The design width the board is laid out at. Narrower than the panel means the
// same markup wraps taller, and it's then scaled up more to reach the panel
// width — so shrinking the design width is how the board grows into a tall
// panel without stretching the type. FILL_MIN caps how far that can go before
// long business names start wrapping badly.
const FILL_MIN = 0.62

// Pick the design width whose scaled-to-fit render comes closest to filling the
// panel height. Scaled height is 1/width-ish, so it falls as the width grows —
// a plain bisection finds the width that lands on outH.
function fillWidth(node, baseWidth, outW, outH) {
  // Height the board ends up with once it's blown up to the full panel width.
  const fittedHeight = (w) => {
    node.style.width = `${w}px`
    return (outW / w) * node.offsetHeight
  }
  let hi = baseWidth
  // Already taller than the panel at full width — nothing to gain by narrowing.
  if (fittedHeight(hi) >= outH - 1) return hi
  let lo = Math.round(baseWidth * FILL_MIN)
  // As narrow as we're willing to go and still short — take it and let the
  // board sit a little shy of the bottom rather than wrap to shreds.
  if (fittedHeight(lo) <= outH) return lo
  for (let i = 0; i < 12 && hi - lo > 4; i++) {
    const mid = Math.round((lo + hi) / 2)
    if (fittedHeight(mid) > outH) lo = mid
    else hi = mid
  }
  return hi
}

// Render a board offscreen and return a finished canvas of exactly outW × outH.
export async function boardToCanvas(board, boards, { width: outW = PNG_SIZE.width, height: outH = PNG_SIZE.height } = {}) {
  const layout = layoutOf(board)
  const baseWidth = BOARD_WIDTH[layout]
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${baseWidth}px;z-index:-1;pointer-events:none`
  host.innerHTML = `<style>${boardStyles(layout)}</style><div class="hxdir ${layout}">${boardBodyHtml(board, boards)}</div>`
  document.body.appendChild(host)
  try {
    try { await document.fonts?.ready } catch { /* fonts optional */ }
    // Let CJK glyphs and the multi-column list settle before measuring.
    await new Promise((r) => setTimeout(r, 200))
    const node = host.querySelector('.hxdir')
    const width = fillWidth(node, baseWidth, outW, outH)
    host.style.width = `${width}px`
    node.style.width = `${width}px`
    const height = node.offsetHeight
    // Biggest scale that still fits the panel — with the width chosen above
    // that lands on a board which fills the panel top to bottom.
    const scale = Math.min(outW / width, outH / height)
    const content = await html2canvas(node, {
      scale,
      backgroundColor: null,
      logging: false,
      width, height,
      windowWidth: width,
      windowHeight: height,
    })
    const out = document.createElement('canvas')
    out.width = outW
    out.height = outH
    const ctx = out.getContext('2d')
    paintBackdrop(ctx, outW, outH, layout, scale)
    ctx.drawImage(content, Math.round((outW - content.width) / 2), Math.round((outH - content.height) / 2))
    return out
  } finally {
    document.body.removeChild(host)
  }
}

export async function downloadBoardPng(board, boards, size) {
  const canvas = await boardToCanvas(board, boards, size)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not build the image.')
  download(blob, `${fileBase(board)}.png`)
}

export function downloadBoardHtml(board, boards) {
  const html = buildBoardDocument(board, boards, { generatedOn: today() })
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), `${fileBase(board)}.html`)
}
