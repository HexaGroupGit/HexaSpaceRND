// Export the Podcast Room "coming soon" post to PNG.
//
//   node scripts/gen-podcast-post.mjs                     # English, both sizes, all variants
//   node scripts/gen-podcast-post.mjs en,zh 45,34         # everything
//   node scripts/gen-podcast-post.mjs en 45 record        # one variant
//
// Variants: mic (the reveal) · record (the invitation) · video (the upsell)
// Output: marketing-out/podcast/<lang>/<w>x<h>/coming-soon-<variant>.png
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const R = 'C:/Hexa-Space-RND'
const PUB = `${R}/public`

const langs  = (process.argv[2] || 'en').split(',').map((s) => s.trim()).filter(Boolean)
const ratios = (process.argv[3] || '45,34').split(',').map((s) => s.trim()).filter(Boolean)
const want   = (process.argv[4] || '').trim()   // one variant, or blank for all

GlobalFonts.registerFromPath(`${PUB}/fonts/BigDailyShort-ExtraLight.otf`, 'HxDisplay')
GlobalFonts.registerFromPath(`${PUB}/fonts/ReworkMicro-Semibold.otf`, 'HxHeading')
GlobalFonts.registerFromPath(`${PUB}/fonts/GT-America-Standard-Thin.otf`, 'HxBody')
for (const [file, name] of [['msyh.ttc', 'Microsoft YaHei'], ['simsun.ttc', 'SimSun']]) {
  const p = `C:/Windows/Fonts/${file}`
  if (existsSync(p)) { try { GlobalFonts.registerFromPath(p, name) } catch {} }
}

const eng = await import(pathToFileURL(`${PUB}/marketing/podcast-render.js`).href)
const { renderPost, defaults, PHOTOS, RATIOS, W, LOGO_W, VARIANTS } = eng

const variants = want ? [want] : VARIANTS
for (const v of variants) {
  if (!VARIANTS.includes(v)) { console.error(`unknown variant "${v}" — try: ${VARIANTS.join(', ')}`); process.exit(1) }
}

const images = {}
for (const src of [...PHOTOS.map(([p]) => p), LOGO_W]) {
  try { images[src] = await loadImage(readFileSync(PUB + src)) }
  catch { console.warn('  ! missing asset', src) }
}

let n = 0
for (const lang of langs) {
  for (const ratio of ratios) {
    const H = RATIOS[ratio]
    if (!H) { console.warn('  ! unknown ratio', ratio); continue }
    const dir = `${R}/marketing-out/podcast/${lang}/${W}x${H}`
    mkdirSync(dir, { recursive: true })
    for (const v of variants) {
      const cv = createCanvas(W, H)
      renderPost(cv.getContext('2d'), defaults(lang, v), images, { H, lang })
      writeFileSync(`${dir}/coming-soon-${v}.png`, cv.toBuffer('image/png'))
      n++
    }
    console.log(`  ✓ ${lang} ${W}×${H}  → ${dir}  (${variants.join(', ')})`)
  }
}
console.log(`\n${n} PNG${n === 1 ? '' : 's'} written.`)
