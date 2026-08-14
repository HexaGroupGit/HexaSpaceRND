// Batch-export the Private Offices carousel to PNG, using the exact same
// drawing engine the browser editor uses (public/marketing/carousel-render.js).
//
//   node scripts/gen-po-carousel.mjs                  → English, both sizes
//   node scripts/gen-po-carousel.mjs zh               → 中文
//   node scripts/gen-po-carousel.mjs en,zh,bi 45      → pick languages / ratio
//
// Output: marketing-out/private-offices/<lang>/<ratio>/card-N.png
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const R = 'C:/Hexa-Space-RND'
const PUB = `${R}/public`

const langs  = (process.argv[2] || 'en').split(',').map((s) => s.trim()).filter(Boolean)
const ratios = (process.argv[3] || '45,34').split(',').map((s) => s.trim()).filter(Boolean)

// Brand faces, registered under the same family names the engine asks for.
GlobalFonts.registerFromPath(`${PUB}/fonts/BigDailyShort-ExtraLight.otf`, 'HxDisplay')
GlobalFonts.registerFromPath(`${PUB}/fonts/ReworkMicro-Semibold.otf`, 'HxHeading')
GlobalFonts.registerFromPath(`${PUB}/fonts/GT-America-Standard-Thin.otf`, 'HxBody')
// CJK fallback for the 中文 decks — node-canvas has no system stack of its own.
for (const [file, name] of [['msyh.ttc', 'Microsoft YaHei'], ['simsun.ttc', 'SimSun']]) {
  const p = `C:/Windows/Fonts/${file}`
  if (existsSync(p)) { try { GlobalFonts.registerFromPath(p, name) } catch {} }
}

const eng = await import(pathToFileURL(`${PUB}/marketing/carousel-render.js`).href)
const { renderCard, defaults, PHOTOS, RATIOS, W, LOGO_W, LOGO_B } = eng

// The engine addresses assets by web path; map those onto the public folder.
const images = {}
for (const src of [...PHOTOS.map(([p]) => p), LOGO_W, LOGO_B]) {
  try { images[src] = await loadImage(readFileSync(PUB + src)) }
  catch (e) { console.warn('  ! missing asset', src) }
}

let n = 0
for (const lang of langs) {
  const deck = defaults(lang === 'zh' ? 'zh' : 'en')   // 'bi' rides on the EN deck
  for (const ratio of ratios) {
    const H = RATIOS[ratio]
    if (!H) { console.warn('  ! unknown ratio', ratio); continue }
    const dir = `${R}/marketing-out/private-offices/${lang}/${W}x${H}`
    mkdirSync(dir, { recursive: true })
    for (let i = 0; i < 5; i++) {
      const cv = createCanvas(W, H)
      renderCard(cv.getContext('2d'), deck[i], i, images, { H, lang })
      writeFileSync(`${dir}/card-${i + 1}.png`, cv.toBuffer('image/png'))
      n++
    }
    console.log(`  ✓ ${lang} ${W}×${H}  → ${dir}`)
  }
}
console.log(`\n${n} PNGs written.`)
