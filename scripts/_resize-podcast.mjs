// Resize the podcast shoot for the marketing site: long edge 2400px, JPEG q82,
// matching the existing /public/photos convention (originals are 4-5MB each).
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFileSync, writeFileSync, statSync } from 'node:fs'

const SRC = 'C:/Users/EricKuang/OneDrive - HEXA PACIFIC PTY LTD/Pictures/Podcast Room'
const OUT = 'C:/Hexa Space Website/site/public/photos'
const MAX = 2400

const JOBS = [
  ['DSCF0752.JPG', 'podcast-studio.jpg'],  // hero — moody console, dark, text-friendly
  ['DSCF0739.jpg', 'podcast-mic.jpg'],     // portrait mic — home section + gallery
  ['DSCF0744.JPG', 'podcast-console.jpg'], // fader macro
  ['DSCF0748.JPG', 'podcast-camera.jpg'],  // teleprompter + monitor
  ['DSCF0767.JPG', 'podcast-room.jpg'],    // the room, wide
]

for (const [from, to] of JOBS) {
  const img = await loadImage(readFileSync(`${SRC}/${from}`))
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const cv = createCanvas(w, h)
  const ctx = cv.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(`${OUT}/${to}`, buf)
  console.log(`  ${to.padEnd(22)} ${w}×${h}  ${(buf.length / 1024).toFixed(0)} KB   (from ${from}, ${(statSync(`${SRC}/${from}`).size / 1024 / 1024).toFixed(1)} MB)`)
}
