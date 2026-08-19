// Generate Play Store graphics on-brand: 512×512 icon (reuses the launcher
// hexagon mark) + 1024×500 feature graphic (lounge photo + wordmark).
//   node scripts/gen-store-graphics.mjs
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'

const R = 'C:/Hexa-Space-RND'
const OUT = `${R}/playstore`
mkdirSync(OUT, { recursive: true })

GlobalFonts.registerFromPath(`${R}/public/fonts/ReworkMicro-Semibold.otf`, 'Rework Micro')
GlobalFonts.registerFromPath(`${R}/public/fonts/BigDailyShort-ExtraLight.otf`, 'Big Daily Short')
GlobalFonts.registerFromPath(`${R}/public/fonts/GT-America-Standard-Thin.otf`, 'GT America')

const OLIVE = '#7F8B2F'

// Left-aligned tracked (letter-spaced) text; returns total width.
function tracked(ctx, text, x, y, spacing) {
  let cx = x
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing }
  return cx - x - spacing
}
function trackedWidth(ctx, text, spacing) {
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + spacing
  return w - spacing
}

// ── App icon 512×512 — the official Hexa Space pin/cube symbol ──────────────
{
  const BRAND = 'C:/Users/EricKuang/OneDrive - HEXA PACIFIC PTY LTD/Documents/HEXA Space Digital Files/Hexa Space Branding/Hexa Space logo'
  const S = 512, box = 300

  // Isolate the symbol from Logo.jpg (dark-on-white) → alpha from darkness, so
  // the white background AND the cube's white faces become transparent.
  const jpg = await loadImage(readFileSync(`${BRAND}/Logo.jpg`))
  const iw = jpg.width, ih = jpg.height
  const tmp = createCanvas(iw, ih); const tctx = tmp.getContext('2d')
  tctx.drawImage(jpg, 0, 0)
  const d = tctx.getImageData(0, 0, iw, ih); const px = d.data
  let minX = iw, minY = ih, maxX = 0, maxY = 0
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const i = (y * iw + x) * 4
    const L = (px[i] + px[i + 1] + px[i + 2]) / 3
    const a = Math.max(0, Math.min(255, 255 - L)) // dark → opaque, white → clear
    px[i + 3] = a
    if (a > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  }
  tctx.putImageData(d, 0, 0)
  const sw = maxX - minX + 1, sh = maxY - minY + 1
  const sym = createCanvas(sw, sh)
  sym.getContext('2d').drawImage(tmp, minX, minY, sw, sh, 0, 0, sw, sh)

  // Tint the symbol to a flat colour (preserves the alpha mask).
  const tint = (color) => {
    const t = createCanvas(sw, sh); const c = t.getContext('2d')
    c.drawImage(sym, 0, 0)
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = color; c.fillRect(0, 0, sw, sh)
    return t
  }
  const draw = (bg, symImg, out) => {
    const c = createCanvas(S, S); const ctx = c.getContext('2d')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S)
    const s = Math.min(box / sw, box / sh), w = sw * s, h = sh * s
    ctx.drawImage(symImg, (S - w) / 2, (S - h) / 2, w, h)
    writeFileSync(`${OUT}/${out}`, c.toBuffer('image/png'))
    console.log('✓', out)
  }
  draw('#161616', tint('#ffffff'), 'icon-512-dark.png')  // white symbol on charcoal
  draw('#F6F5F1', tint('#1A1A1A'), 'icon-512-light.png') // ink symbol on bone
}

// ── Feature graphic 1024×500 — lounge photo + wordmark ──────────────────────
{
  const W = 1024, H = 500
  const c = createCanvas(W, H)
  const ctx = c.getContext('2d')

  // Cover-fit the lounge photo.
  const photo = await loadImage(`${R}/public/app-home.jpg`)
  const s = Math.max(W / photo.width, H / photo.height)
  const pw = photo.width * s, ph = photo.height * s
  ctx.drawImage(photo, (W - pw) / 2, (H - ph) / 2, pw, ph)

  // Darken, heavier on the left where the text sits.
  const g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, 'rgba(18,18,15,0.92)')
  g.addColorStop(0.55, 'rgba(18,18,15,0.55)')
  g.addColorStop(1, 'rgba(18,18,15,0.12)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const x = 70
  // Kicker
  ctx.fillStyle = OLIVE
  ctx.font = '600 22px "Rework Micro"'
  ctx.textBaseline = 'alphabetic'
  tracked(ctx, 'MEMBER APP', x, 175, 6)
  // Thin olive rule
  ctx.strokeStyle = OLIVE; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x, 192); ctx.lineTo(x + 190, 192); ctx.stroke()
  // Wordmark
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 82px "Rework Micro"'
  tracked(ctx, 'HEXA SPACE', x, 285, 10)
  // Serif subline
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '300 34px "Big Daily Short"'
  ctx.fillText('Book rooms · unlock doors · manage your space.', x, 345)
  // Small footer
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '400 18px "GT America"'
  tracked(ctx, 'BOX HILL · MELBOURNE', x, 405, 3)

  // JPEG (no alpha) — matches Play's feature-graphic spec exactly.
  writeFileSync(`${OUT}/feature-1024x500.jpg`, c.toBuffer('image/jpeg', 92))
  console.log('✓ feature-1024x500.jpg')
}

console.log('\nSaved to', OUT)
