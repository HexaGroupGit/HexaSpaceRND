// Directory board exports: a PNG (print it, or drop it on a screen) and a
// self-contained HTML file (open it from a USB stick — the ground floor and the
// lower levels have no internet, so the live tv.html link is no use down there).
//
// Both render the same markup from directoryHtml.js. The PNG is composited in
// two passes: html2canvas draws the text on a transparent canvas, then the
// backdrop is painted natively underneath — html2canvas only partially
// understands multi-stop elliptical gradients, and the board is mostly backdrop.

import html2canvas from 'html2canvas'
import { boardBodyHtml, boardStyles, buildBoardDocument, layoutOf, BOARD_WIDTH } from './directoryHtml.js'
import { BOARD_LABELS } from './directoryData.js'

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

// Render a board offscreen and return a finished canvas.
export async function boardToCanvas(board, boards, { scale = 2 } = {}) {
  const layout = layoutOf(board)
  const width = BOARD_WIDTH[layout]
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;z-index:-1;pointer-events:none`
  host.innerHTML = `<style>${boardStyles(layout)}</style><div class="hxdir ${layout}">${boardBodyHtml(board, boards)}</div>`
  document.body.appendChild(host)
  try {
    try { await document.fonts?.ready } catch { /* fonts optional */ }
    // Let CJK glyphs and the multi-column list settle before measuring.
    await new Promise((r) => setTimeout(r, 200))
    const node = host.querySelector('.hxdir')
    const height = node.offsetHeight
    const content = await html2canvas(node, {
      scale,
      backgroundColor: null,
      logging: false,
      width, height,
      windowWidth: width,
      windowHeight: height,
    })
    const out = document.createElement('canvas')
    out.width = content.width
    out.height = content.height
    const ctx = out.getContext('2d')
    paintBackdrop(ctx, out.width, out.height, layout, scale)
    ctx.drawImage(content, 0, 0)
    return out
  } finally {
    document.body.removeChild(host)
  }
}

export async function downloadBoardPng(board, boards, { scale = 2 } = {}) {
  const canvas = await boardToCanvas(board, boards, { scale })
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not build the image.')
  download(blob, `${fileBase(board)}.png`)
}

export function downloadBoardHtml(board, boards) {
  const html = buildBoardDocument(board, boards, { generatedOn: today() })
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), `${fileBase(board)}.html`)
}
