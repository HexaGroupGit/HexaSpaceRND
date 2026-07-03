// Generates the branded Hexa Space function-space brochure PDF into /public.
// Run: node scripts/genFunctionBrochure.mjs
// Committed output (public/hexa-space-function-brochure.pdf) is attached to the
// brochure emails via Resend `path`. Uses jsPDF built-in fonts for portability.
import { readFileSync, writeFileSync } from 'fs'
import { jsPDF } from 'jspdf'

const OLIVE = [127, 139, 47]
const INK = [26, 26, 26]
const MUTE = [110, 110, 110]
const HAIR = [227, 225, 230]

const doc = new jsPDF({ unit: 'pt', format: 'a4' })
const W = doc.internal.pageSize.getWidth()
const H = doc.internal.pageSize.getHeight()
const M = 48

const img = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`

function logo(y) {
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal').setFontSize(13)
  doc.text('H E X A   S P A C E', W / 2, y, { align: 'center', charSpace: 1 })
  doc.setTextColor(...OLIVE).setFontSize(11)
  doc.text('六合空间', W / 2 + 92, y, { align: 'left' })
}

function heading(t, x, y, size = 26) {
  doc.setTextColor(...INK).setFont('times', 'normal').setFontSize(size)
  doc.text(t, x, y)
}
function kicker(t, x, y) {
  doc.setTextColor(...OLIVE).setFont('helvetica', 'bold').setFontSize(9)
  doc.text(t.toUpperCase(), x, y, { charSpace: 2 })
}
function para(t, x, y, w, size = 10.5, lead = 15) {
  doc.setTextColor(58, 58, 58).setFont('helvetica', 'normal').setFontSize(size)
  const lines = doc.splitTextToSize(t, w)
  doc.text(lines, x, y, { lineHeightFactor: lead / size })
  return y + lines.length * lead
}

// ── Page 1 — cover ──────────────────────────────────────────────────────────
doc.setFillColor(255, 255, 255).rect(0, 0, W, H, 'F')
logo(56)
// hero image
try {
  doc.addImage(img('public/proposal/event-space.jpg'), 'JPEG', M, 84, W - M * 2, 250)
} catch { /* image optional */ }
doc.setDrawColor(...OLIVE).setLineWidth(2).line(M, 366, M + 60, 366)
kicker('Function Space Hire', M, 392)
heading('The Function Space', M, 428, 32)
let y = para(
  'A light-filled, versatile venue in the heart of Box Hill — designed for launches, dinners, conferences, workshops and celebrations. Flexible layouts for 20–100 guests, natural light, AV-ready, and a dedicated team to help your event run beautifully.',
  M, 462, W - M * 2, 12, 18)
y += 8
kicker('Where', M, y + 6)
doc.setTextColor(...INK).setFont('helvetica', 'normal').setFontSize(11)
doc.text('Hexa Space · 402/830 Whitehorse Road, Box Hill VIC 3128', M, y + 24)
// footer band
doc.setFillColor(...INK).rect(0, H - 44, W, 44, 'F')
doc.setTextColor(255, 255, 255).setFont('helvetica', 'normal').setFontSize(9)
doc.text('hexaspace.com.au   ·   build locally, scale sustainably', W / 2, H - 18, { align: 'center', charSpace: 1 })

// ── Page 2 — inclusions, layouts & pricing ──────────────────────────────────
doc.addPage()
doc.setFillColor(255, 255, 255).rect(0, 0, W, H, 'F')
logo(56)
kicker('What you get', M, 104)
heading("What's included", M, 132, 24)

const INCLUSIONS = [
  'Exclusive use of the function space for your booked hours',
  'Setup & pack-down time with a 30-minute buffer each side',
  'Tables, chairs and your choice of layout',
  'AV — screen, HDMI & sound; fast Wi-Fi throughout',
  'Kitchenette & breakout area access',
  'End-of-event cleaning included',
  'On-site team to help your event run smoothly',
]
y = 150
INCLUSIONS.forEach((t) => {
  doc.setFillColor(...OLIVE).circle(M + 3, y - 3, 2, 'F')
  doc.setTextColor(...INK).setFont('helvetica', 'normal').setFontSize(10.5)
  doc.text(t, M + 14, y)
  y += 20
})

// Layouts
y += 10
kicker('Layouts', M, y)
y += 18
const LAYOUTS = [['Cocktail', 'Up to 100 guests'], ['Seminar', 'Up to 80 guests'], ['Classroom', 'Up to 45 guests']]
const colW = (W - M * 2 - 24) / 3
LAYOUTS.forEach(([name, cap], i) => {
  const x = M + i * (colW + 12)
  doc.setDrawColor(...HAIR).setLineWidth(1).rect(x, y, colW, 58)
  doc.setTextColor(...INK).setFont('times', 'normal').setFontSize(16)
  doc.text(name, x + 12, y + 26)
  doc.setTextColor(...OLIVE).setFont('helvetica', 'bold').setFontSize(8)
  doc.text(cap.toUpperCase(), x + 12, y + 44, { charSpace: 1 })
})
y += 84

// Pricing table
kicker('Pricing', M, y)
y += 14
const RATES = [
  ['Venue hire — weekday', '$250 + GST / hour'],
  ['Venue hire — weekend', '$325 + GST / hour'],
  ['Cleaning fee', '$200 + GST'],
  ['F&B & AV staff (events 80+ guests)', '$40 / hour'],
  ['Refundable security deposit', '$300 (no GST)'],
]
doc.setDrawColor(...HAIR).setLineWidth(1)
RATES.forEach(([l, v]) => {
  doc.line(M, y, W - M, y)
  y += 20
  doc.setTextColor(...MUTE).setFont('helvetica', 'normal').setFontSize(10)
  doc.text(l, M, y - 6)
  doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(10)
  doc.text(v, W - M, y - 6, { align: 'right' })
})
doc.line(M, y, W - M, y)
y += 22
y = para('To secure your date we take a 50% deposit plus the $300 refundable security deposit. The balance is due 14 days before your event. The security deposit is returned within 5 business days after your event if there is no damage or excessive cleaning.', M, y, W - M * 2, 9.5, 14)

// CTA footer
doc.setFillColor(...OLIVE).rect(0, H - 88, W, 88, 'F')
doc.setTextColor(255, 255, 255).setFont('times', 'normal').setFontSize(16)
doc.text('Ready to plan your event?', M, H - 52)
doc.setFont('helvetica', 'normal').setFontSize(10)
doc.text('Book a time at portal.hexaspace.com.au/book-function  ·  events@hexaspace.com.au', M, H - 30)

writeFileSync('public/hexa-space-function-brochure.pdf', Buffer.from(doc.output('arraybuffer')))
console.log('Wrote public/hexa-space-function-brochure.pdf')
