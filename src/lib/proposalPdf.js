// Branded Hexa Space proposal PDF generator.
//
// Renders luxury HTML pages (greige / olive / serif) off-screen, rasterises
// each with html2canvas, and assembles a landscape 16:9 PDF via jsPDF.
// Floor-plan pages auto-highlight the chosen suite(s) using the calibrated
// map in ./floorplans.js.
//
// Returns a jsPDF document (async). Callers use .save() or .output('base64').

import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { FLOORS, highlightFor } from './floorplans.js'

const PAGE_W = 1280, PAGE_H = 720
const BG = '#EFEDF2', INK = '#1a1a1a', OLIVE = '#7F8B2F', MUTED = '#6b6b6b', LINE = '#d8d6dc'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const money = (n) => `$${Number(n || 0).toLocaleString('en-AU')}`

// Inject @font-face + page styles once.
let stylesInjected = false
function injectStyles() {
  if (stylesInjected) return
  const st = document.createElement('style')
  st.setAttribute('data-hexa-proposal', '')
  st.textContent = `
    @font-face{font-family:'HexaBig';src:url('/fonts/BigDailyShort-ExtraLight.otf') format('opentype');font-display:swap}
    @font-face{font-family:'HexaGT';src:url('/fonts/GT-America-Standard-Thin.otf') format('opentype');font-display:swap}
    @font-face{font-family:'HexaRework';src:url('/fonts/ReworkMicro-Semibold.otf') format('opentype');font-display:swap}
    .hxpage{width:${PAGE_W}px;height:${PAGE_H}px;position:relative;background:${BG};
      font-family:'HexaGT',Helvetica,Arial,sans-serif;color:${INK};overflow:hidden;box-sizing:border-box}
    .hxpage *{box-sizing:border-box;margin:0;padding:0}
    .hx-kicker{font-family:'HexaRework',sans-serif;font-size:13px;letter-spacing:.28em;color:${OLIVE};text-transform:uppercase}
    .hx-title{font-family:'HexaBig',Georgia,serif;color:${INK};line-height:1.02;letter-spacing:.01em}
    .hx-body{font-family:'HexaGT',sans-serif;color:${MUTED};line-height:1.55}
    .hx-foot{position:absolute;left:0;right:0;bottom:34px;text-align:center;font-family:'HexaRework',sans-serif;
      font-size:11px;letter-spacing:.28em;color:${OLIVE}}
    .hx-hl{position:absolute;background:rgba(127,139,47,.30);border:1.6px solid rgba(127,139,47,.95);border-radius:3px;
      display:flex;align-items:center;justify-content:center;font-family:'HexaRework',sans-serif;color:#2f3408}
  `
  document.head.appendChild(st)
  stylesInjected = true
}

const footer = `<div class="hx-foot">HEXA SPACE &nbsp;·&nbsp; 六合空间</div>`

function coverPage({ client, business, dateStr, validityDays, company }) {
  const who = client || business || 'Your team'
  return `<div class="hxpage" style="padding:70px 84px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div class="hx-kicker">${esc(company)}</div>
      <div class="hx-kicker" style="color:${MUTED}">Workspace Proposal</div>
    </div>
    <div style="position:absolute;left:84px;top:270px;right:84px">
      <div class="hx-kicker" style="margin-bottom:18px">Prepared for</div>
      <div class="hx-title" style="font-size:76px">${esc(who)}.</div>
      ${business && client ? `<div class="hx-body" style="font-size:17px;margin-top:14px">${esc(business)}</div>` : ''}
    </div>
    <div style="position:absolute;left:84px;bottom:96px;right:84px">
      <div style="height:1px;background:${LINE};margin-bottom:20px"></div>
      <div style="display:flex;justify-content:space-between;font-family:'HexaRework',sans-serif;font-size:12px;letter-spacing:.16em;color:${MUTED};text-transform:uppercase">
        <span>${esc(dateStr)}</span>
        <span>Private offices · Meeting suites · Community</span>
        <span>Valid ${validityDays} days</span>
      </div>
    </div>
  </div>`
}

function offerPage({ offices, coverMsg, floorLabelOf }) {
  const total = offices.reduce((s, o) => s + Number(o.price || 0), 0)
  const rows = offices.map((o) => `
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:18px 0;border-bottom:1px solid ${LINE}">
      <div style="flex:1;min-width:0">
        <div style="font-family:'HexaBig',Georgia,serif;font-size:26px;color:${INK};line-height:1">${esc(o.unit)}</div>
        <div class="hx-kicker" style="margin-top:8px;font-size:11px;color:${MUTED}">
          ${esc(floorLabelOf(o))}${o.pax ? ` &nbsp;·&nbsp; ${esc(o.pax)} PAX` : ''}${o.note ? ` &nbsp;·&nbsp; ${esc(o.note)}` : ''}
        </div>
      </div>
      <div style="text-align:right;white-space:nowrap;margin-left:24px">
        <span style="font-family:'HexaBig',Georgia,serif;font-size:26px;color:${INK}">${money(o.price)}</span>
        <span class="hx-body" style="font-size:13px"> /mo</span>
      </div>
    </div>`).join('')
  return `<div class="hxpage" style="padding:64px 84px">
    <div class="hx-kicker">Available Suites</div>
    <div class="hx-title" style="font-size:52px;margin-top:8px">Your options.</div>
    ${coverMsg ? `<div class="hx-body" style="font-size:15px;margin-top:16px;max-width:840px">${esc(coverMsg)}</div>` : ''}
    <div style="margin-top:${coverMsg ? 26 : 40}px">${rows}</div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:22px">
      <div class="hx-kicker" style="color:${INK}">Total monthly · ex GST</div>
      <div style="font-family:'HexaBig',Georgia,serif;font-size:34px;color:${OLIVE}">${money(total)} <span class="hx-body" style="font-size:14px;color:${MUTED}">AUD</span></div>
    </div>
    <div class="hx-body" style="position:absolute;left:84px;right:84px;bottom:70px;font-size:11px;color:${MUTED}">
      All amounts exclude GST. Pricing is indicative and subject to a signed licence agreement. Suites are offered subject to availability at the time of acceptance.
    </div>
    ${footer}
  </div>`
}

// plan image box: fit within a region keeping 2000×1414 aspect
function floorPage({ floor, label, offices }) {
  const img = FLOORS[floor]?.image
  // plan display area
  const areaX = 300, areaY = 150, areaW = 900, areaH = 500
  const aspect = 2000 / 1414
  let w = areaW, h = w / aspect
  if (h > areaH) { h = areaH; w = h * aspect }
  const px = areaX + (areaW - w) / 2, py = areaY + (areaH - h) / 2
  const hls = offices.map((o) => {
    const box = highlightFor(floor, o.unit)
    if (!box) return ''
    const [l, t, bw, bh] = box
    const numLabel = String(o.unit ?? '').replace(/[^0-9]/g, '')
    return `<div class="hx-hl" style="left:${(l / 100) * w}px;top:${(t / 100) * h}px;width:${(bw / 100) * w}px;height:${(bh / 100) * h}px;font-size:${Math.min(15, (bw / 100) * w * 0.5)}px">${esc(numLabel)}</div>`
  }).join('')
  const suiteList = offices.map((o) => esc(o.unit)).join(' · ')
  return `<div class="hxpage" style="padding:56px 84px">
    <div class="hx-kicker">Availability</div>
    <div class="hx-title" style="font-size:52px;margin-top:8px">${esc(label)}.</div>
    <div class="hx-body" style="font-size:14px;margin-top:10px">${offices.length > 1 ? 'Your suites, highlighted' : 'Your suite, highlighted'} on the floor plan — ${suiteList}.</div>
    <div style="position:absolute;left:110px;top:200px;display:flex;align-items:center;gap:10px">
      <span style="display:inline-block;width:22px;height:14px;background:rgba(127,139,47,.30);border:1.4px solid rgba(127,139,47,.95);border-radius:2px"></span>
      <span class="hx-kicker" style="font-size:11px;color:${MUTED}">Offered to you</span>
    </div>
    <div style="position:absolute;left:${px}px;top:${py}px;width:${w}px;height:${h}px">
      <img src="${img}" style="width:100%;height:100%;display:block" crossorigin="anonymous"/>
      ${hls}
    </div>
    ${footer}
  </div>`
}

function closingPage({ company, settings }) {
  const c = settings?.company || {}
  const incl = [
    'Fully furnished, move-in ready private offices',
    'All-inclusive: electricity, high-speed internet & building outgoings',
    'Meeting rooms, boardrooms & phone booths on demand',
    'Concierge reception, mail handling & member events',
    'Kitchen, barista-standard coffee & breakout lounges',
    '24/7 secure access with end-of-trip facilities',
  ]
  const contact = [c.phone && `T ${c.phone}`, c.email && `E ${c.email}`, c.address].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;')
  return `<div class="hxpage" style="padding:64px 84px">
    <div class="hx-kicker">What's Included</div>
    <div class="hx-title" style="font-size:52px;margin-top:8px">Everything, handled.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 48px;margin-top:34px;max-width:960px">
      ${incl.map((i) => `<div style="display:flex;gap:12px;align-items:flex-start">
        <span style="color:${OLIVE};font-size:18px;line-height:1.2">—</span>
        <span class="hx-body" style="font-size:15px;color:${INK}">${esc(i)}</span></div>`).join('')}
    </div>
    <div style="position:absolute;left:84px;right:84px;bottom:92px">
      <div style="height:1px;background:${LINE};margin-bottom:22px"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <div class="hx-title" style="font-size:30px">Reserve your suite.</div>
          <div class="hx-body" style="font-size:13px;margin-top:8px">${contact || esc(company) + ' · hexaspace.com.au'}</div>
        </div>
        <div class="hx-kicker" style="color:${MUTED}">${esc(company)}</div>
      </div>
    </div>
    ${footer}
  </div>`
}

export async function buildProposalPdf({ offices = [], coverMsg = '', validityDays = 14, lead = {}, settings = {}, dateStr = '' }) {
  injectStyles()
  const company = settings?.company?.name || 'Hexa Space'
  const floorLabelOf = (o) => FLOORS[o.floor]?.label || ''

  // group chosen offices by floor (preserving numeric order)
  const byFloor = {}
  offices.forEach((o) => { if (o.floor && FLOORS[o.floor]) (byFloor[o.floor] ||= []).push(o) })
  const floorOrder = ['l2', 'l4', 'l5'].filter((f) => byFloor[f])

  const pagesHtml = [
    coverPage({ client: lead.name, business: lead.businessName, dateStr, validityDays, company }),
    offerPage({ offices, coverMsg, floorLabelOf }),
    ...floorOrder.map((f) => floorPage({ floor: f, label: FLOORS[f].label, offices: byFloor[f] })),
    closingPage({ company, settings }),
  ]

  // Off-screen host
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;background:${BG};z-index:-1`
  host.innerHTML = pagesHtml.join('')
  document.body.appendChild(host)

  try {
    // wait for fonts + images
    try {
      await Promise.all([
        document.fonts.load('400 40px "HexaBig"'),
        document.fonts.load('400 15px "HexaGT"'),
        document.fonts.load('600 12px "HexaRework"'),
      ])
      await document.fonts.ready
    } catch { /* fonts optional */ }
    const imgs = [...host.querySelectorAll('img')]
    await Promise.all(imgs.map((im) => im.complete ? im.decode().catch(() => {}) : new Promise((res) => { im.onload = im.onerror = res })))

    const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [PAGE_W, PAGE_H] })
    const pages = [...host.querySelectorAll('.hxpage')]
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2, backgroundColor: BG, useCORS: true, logging: false,
        width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, windowHeight: PAGE_H,
      })
      const data = canvas.toDataURL('image/png')
      if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape')
      doc.addImage(data, 'PNG', 0, 0, PAGE_W, PAGE_H)
    }
    return doc
  } finally {
    document.body.removeChild(host)
  }
}
