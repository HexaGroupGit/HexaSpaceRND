// Branded Hexa Space proposal PDF generator — the full brochure.
//
// Renders the luxury 12-page brochure off-screen, rasterises each page with
// html2canvas, and assembles a landscape 16:9 PDF via jsPDF. Two pages are
// personalised from the ticked offices:
//   • page 5 "Available Suites" — the suites we're proposing to this lead
//   • the floor-plan page(s) that follow — the chosen suite(s) highlighted
//     (transparent olive box, no number) on their real floor plan.
// Everything else is the standard brochure. Returns a jsPDF doc (async);
// callers use .save() or .output('base64').

import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { FLOORS, highlightFor } from './floorplans.js'

const PAGE_W = 1280, PAGE_H = 720   // 13.333in × 7.5in at 96dpi
const BG = '#EFEDF2'
const PHOTO = '/proposal/'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const money = (n) => Number(n || 0).toLocaleString('en-AU')
// Full-bleed cover image as a background div (html2canvas renders background-size
// far more reliably than <img object-fit:cover>).
const bgFill = (src, pos = 'center') => `<div style="position:absolute;inset:0;background-image:url('${src}');background-size:cover;background-position:${pos};"></div>`
const FOOT = `<div class="foot"><span>HEXA SPACE</span> &nbsp;|&nbsp; 六合空间</div>`

let stylesInjected = false
function injectStyles() {
  if (stylesInjected) return
  const st = document.createElement('style')
  st.setAttribute('data-hexa-brochure', '')
  st.textContent = `
    @font-face{font-family:'HxDisplay';src:url('/fonts/BigDailyShort-ExtraLight.otf') format('opentype');font-weight:200;font-display:swap}
    @font-face{font-family:'HxHeading';src:url('/fonts/ReworkMicro-Semibold.otf') format('opentype');font-weight:600;font-display:swap}
    @font-face{font-family:'HxBody';src:url('/fonts/GT-America-Standard-Thin.otf') format('opentype');font-weight:300;font-display:swap}
    .hxbro{--greige:#EFEDF2;--bone:#E7E4E9;--ink:#1b1b18;--soft:#6a6a63;--line:#c9c6cd;--olive:#7F8B2F;--paper:#f7f6f8}
    .hxbro *{margin:0;padding:0;box-sizing:border-box}
    .hxbro .page{position:relative;width:13.333in;height:7.5in;overflow:hidden;background:var(--greige);font-family:'HxBody',Arial,sans-serif;color:var(--ink)}
    .hxbro .display{font-family:'HxDisplay',Georgia,serif;font-weight:200;line-height:.98;letter-spacing:.005em}
    .hxbro .eyebrow{font-family:'HxHeading',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.28em;font-size:9px;color:var(--olive)}
    .hxbro .label{font-family:'HxHeading',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.16em;font-size:9.5px;color:var(--ink)}
    .hxbro .kicker{font-family:'HxBody';font-style:italic;font-size:15px;color:var(--soft);letter-spacing:.01em}
    .hxbro p.body,.hxbro .body{font-family:'HxBody';font-weight:300;font-size:12.5px;line-height:1.75;color:#33332e}
    .hxbro .bullets{list-style:none}
    .hxbro .bullets li{font-family:'HxHeading',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.13em;font-size:8.6px;color:#2c2c26;padding:5px 0;display:flex;gap:8px;align-items:baseline}
    .hxbro .bullets li::before{content:'';width:4px;height:4px;background:var(--olive);display:inline-block;flex:none;transform:translateY(-1px)}
    .hxbro .foot{position:absolute;left:0;right:0;bottom:.42in;display:flex;justify-content:center;gap:10px;font-family:'HxHeading',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.24em;font-size:8px;color:#8f8c93}
    .hxbro .foot span{color:var(--olive)}
    .hxbro .pad{padding:.72in .8in;height:100%}
    .hxbro .ruleThin{height:1px;background:var(--line);border:0}
    .hxbro .wm{font-family:'HxHeading',sans-serif;font-weight:600;letter-spacing:.14em}
    .hxbro .hl{position:absolute;background:rgba(127,139,47,.32);border:1.6px solid rgba(127,139,47,.95);border-radius:3px}
    .hxbro .lg-av{width:15px;height:15px;display:inline-block;background:rgba(127,139,47,.32);border:1.6px solid rgba(127,139,47,.95)}
    .hxbro .lg-oc{width:15px;height:15px;display:inline-block;background:#e7e4e9;border:1px solid var(--line)}
    .hxbro .seg{display:flex;align-items:center;justify-content:center;font-family:'HxHeading';font-weight:600;font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;color:#4a463c;border-bottom:1px solid rgba(255,255,255,.5)}
    .hxbro .rc{text-align:left;padding:10px 6px;border-bottom:1px solid var(--line)}
    .hxbro .cc{text-align:center;padding:10px 6px;border-bottom:1px solid var(--line);color:var(--soft)}
    .hxbro .rr{text-align:right;padding:10px 6px;border-bottom:1px solid var(--line);font-family:'HxHeading';font-weight:600}`
  document.head.appendChild(st)
  stylesInjected = true
}

// ── Static brochure pages ────────────────────────────────────────────────────
function coverPage(ctx) {
  const who = ctx.client || ctx.business || ''
  return `<div class="page" style="display:flex;">
    <div style="position:relative;width:54%;height:100%;">${bgFill(PHOTO + 'hero-main.jpg')}</div>
    <div style="width:46%;height:100%;position:relative;padding:.8in;">
      <div class="eyebrow" style="letter-spacing:.34em;">HEXA SPACE &nbsp;·&nbsp; 六合空间</div>
      <div style="position:absolute;top:2.5in;left:.8in;right:.8in;">
        <div class="display" style="font-size:76px;letter-spacing:.02em;">Hexa<br>Space</div>
        <div class="kicker" style="margin-top:20px;">A private workspace, in the heart of Box Hill.</div>
      </div>
      <div style="position:absolute;left:.8in;right:.8in;bottom:.8in;">
        <hr class="ruleThin" style="margin-bottom:16px;">
        <div class="label" style="color:var(--olive);margin-bottom:6px;">Workspace Proposal</div>
        ${who ? `<div class="label" style="margin-bottom:10px;">Prepared for ${esc(who)}${ctx.dateStr ? ` &nbsp;·&nbsp; ${esc(ctx.dateStr)}` : ''}</div>` : ''}
        <div class="body" style="font-size:11px;line-height:1.7;">
          ${esc(ctx.addr)}<br>
          ${esc(ctx.web)} &nbsp;·&nbsp; ${esc(ctx.email)} &nbsp;·&nbsp; ${esc(ctx.phone)}
        </div>
      </div>
    </div>
  </div>`
}

function statementPage() {
  return `<div class="page">
    ${bgFill(PHOTO + 'lounge-main.jpg')}
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,15,12,.62) 0%,rgba(15,15,12,.15) 55%,rgba(15,15,12,0) 100%);"></div>
    <div style="position:absolute;left:.9in;bottom:1.1in;right:5in;">
      <div class="eyebrow" style="color:#c9d08a;">Box Hill · Whitehorse Road</div>
      <div class="display" style="color:#fff;font-size:52px;margin-top:16px;">Neither home nor a<br>typical office —<br>somewhere better.</div>
    </div>
    <div class="foot" style="color:rgba(255,255,255,.6);"><span style="color:#cfd69a;">HEXA SPACE</span> &nbsp;|&nbsp; 六合空间</div>
  </div>`
}

function theSpacePage() {
  const stat = (n, l) => `<div style="flex:1;"><div class="display" style="font-size:30px;">${n}</div><div class="label" style="font-size:7.5px;color:var(--soft);margin-top:4px;">${l}</div></div>`
  const bl = (t) => `<li>${t}</li>`
  const col1 = ['24/7 Secure Access', 'High-Speed Internet 1000/1000', 'Dedicated Community Manager', 'End-of-Trip Facilities', 'Daily Cleaning']
  const col2 = ['Tea, Coffee &amp; Filtered Water', 'Outdoor Terrace', 'Functions &amp; Events', 'Onsite &amp; Box Hill Central Parking', 'Reception &amp; Concierge']
  return `<div class="page"><div class="pad" style="display:flex;gap:.7in;">
    <div style="width:47%;display:flex;flex-direction:column;">
      <div class="eyebrow">The Space</div>
      <div class="display" style="font-size:54px;margin-top:16px;">A workspace for<br>every phase.</div>
      <div class="kicker" style="margin-top:18px;">Hotel-style amenity. Serviced, flexible, effortless.</div>
      <p class="body" style="margin-top:20px;max-width:4.3in;">Hexa Space blends warm communal areas with the privacy of bespoke office suites — bathed in natural light, wrapped in first-class amenity and hospitality-led service. Fully serviced and flexible, it's designed to meet your business wherever it is today, and grow with it.</p>
      <div style="margin-top:auto;display:flex;gap:14px;padding-top:24px;">
        ${stat('1,763', 'SQM Centre')}${stat('43', 'Private Offices')}${stat('8', 'Meeting Rooms')}${stat('3', 'Levels')}
      </div>
    </div>
    <div style="width:53%;display:flex;flex-direction:column;gap:.28in;">
      <div style="position:relative;height:3.5in;overflow:hidden;">${bgFill(PHOTO + 'reception.jpg')}</div>
      <div style="display:flex;gap:36px;">
        <ul class="bullets" style="flex:1;">${col1.map(bl).join('')}</ul>
        <ul class="bullets" style="flex:1;">${col2.map(bl).join('')}</ul>
      </div>
    </div>
  </div>${FOOT}</div>`
}

function waysToWorkPage() {
  const card = (img, title, price, unit, body) => `<div style="flex:1;min-width:0;">
    <div style="position:relative;height:1.7in;overflow:hidden;">${bgFill(PHOTO + img)}</div>
    <div class="label" style="margin-top:12px;">${title}</div>
    <div class="display" style="font-size:22px;color:var(--olive);margin-top:6px;">${price}<span style="font-size:11px;color:var(--soft);">${unit}</span></div>
    <p class="body" style="font-size:10px;margin-top:8px;">${body}</p>
  </div>`
  return `<div class="page"><div class="pad">
    <div class="eyebrow">Ways to Work</div>
    <div class="display" style="font-size:50px;margin-top:14px;">Flexible on your terms.</div>
    <div style="display:flex;gap:20px;margin-top:.5in;">
      ${card('private-office.jpg', 'Private Offices', '$700', '/desk · mo', 'Furnished, lockable suites for teams large and small.')}
      ${card('dedicated-desk.jpg', 'Dedicated Desks', '$500', '/mo', 'A permanent spot with lockable storage &amp; 24/7 access.')}
      ${card('flexible-desk.jpg', 'Flexible Memberships', '$300', '/mo', 'Coworking access that flexes with your week.')}
      ${card('meeting-room.jpg', 'Virtual Offices', '$75', '/mo', 'A prestigious address, mail handling &amp; call service.')}
      ${card('room-east.jpg', 'Meeting Rooms', '$20', '/hr', 'Eight rooms, 2–40 guests, booked online.')}
    </div>
  </div>${FOOT}</div>`
}

// ── Personalised page 5 — the proposed suites ────────────────────────────────
function offerCard(o) {
  const pa = Number(o.price || 0) * 12
  const floorLabel = FLOORS[o.floor]?.label || ''
  const meta = [floorLabel, o.pax ? `${esc(o.pax)} pax` : ''].filter(Boolean).join(' · ')
  return `<div style="flex:0 0 calc((100% - 68px)/3);min-width:0;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--ink);padding-bottom:8px;gap:8px;">
      <div class="wm" style="font-size:15px;">${esc(String(o.unit || '').toUpperCase())}</div>
      <div class="label" style="color:var(--soft);white-space:nowrap;">${meta}</div>
    </div>
    <ul class="bullets" style="margin-top:12px;">
      <li>Fully furnished private suite</li>
      <li>Ergonomic desks &amp; chairs</li>
      <li>Lockable storage</li>
      ${o.pax ? `<li>${esc(o.pax)} Hexa memberships included</li>` : ''}
      <li>24/7 secure access</li>
    </ul>
    <div class="display" style="font-size:26px;margin-top:16px;">$${money(o.price)}<span style="font-size:11px;color:var(--soft);">/mo</span></div>
    <div class="label" style="color:var(--olive);margin-top:4px;">$${money(pa)} PA · ex GST</div>
    ${o.note ? `<div class="kicker" style="font-size:10px;margin-top:8px;">${esc(o.note)}</div>` : ''}
  </div>`
}

function offerPage(offices, coverMsg) {
  return `<div class="page"><div class="pad">
    <div class="eyebrow">Available Suites</div>
    <div class="display" style="font-size:50px;margin-top:14px;">We'd like to offer you.</div>
    ${coverMsg ? `<div class="kicker" style="margin-top:12px;font-size:13px;max-width:7in;">${esc(coverMsg)}</div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:30px 34px;margin-top:${coverMsg ? '.3in' : '.5in'};">
      ${offices.map(offerCard).join('')}
    </div>
    <div class="kicker" style="position:absolute;left:.8in;bottom:.95in;font-size:11px;">Option to rent an assigned car park at $200 pcm, per bay (ex GST).</div>
  </div>${FOOT}</div>`
}

// ── Personalised floor-plan page(s) — chosen suites highlighted, no numbers ───
function floorPage(floor, offices) {
  const F = FLOORS[floor]
  const hls = offices.map((o) => {
    const b = highlightFor(floor, o.unit)
    if (!b) return ''
    const [l, t, w, h] = b
    return `<div class="hl" style="left:${l}%;top:${t}%;width:${w}%;height:${h}%;"></div>`
  }).join('')
  const list = offices.map((o, i) => `<div class="wm" style="font-size:15px;${i ? 'margin-top:12px;' : ''}">${esc(String(o.unit || '').toUpperCase())}</div>
      <div class="label" style="color:var(--soft);margin-top:5px;">${o.pax ? `${esc(o.pax)} pax · ` : ''}$${money(o.price)} / mo</div>`).join('')
  return `<div class="page"><div class="pad" style="display:flex;gap:.5in;align-items:stretch;">
    <div style="width:25%;display:flex;flex-direction:column;">
      <div class="eyebrow">Availability</div>
      <div class="display" style="font-size:52px;margin-top:12px;">${esc(F.label)}.</div>
      <div class="kicker" style="margin-top:14px;font-size:13px;">${offices.length > 1 ? 'Your suites' : 'Your suite'}, on the floor plan.</div>
      <div style="margin-top:28px;display:flex;flex-direction:column;gap:11px;">
        <div class="label" style="display:flex;align-items:center;gap:9px;"><span class="lg-av"></span>Available now</div>
        <div class="label" style="display:flex;align-items:center;gap:9px;color:var(--soft);"><span class="lg-oc"></span>Leased / other</div>
      </div>
      <div style="margin-top:auto;"><hr class="ruleThin" style="margin-bottom:12px;">${list}</div>
    </div>
    <div style="width:75%;display:flex;align-items:center;justify-content:center;">
      <div style="position:relative;width:7.85in;height:5.552in;">
        <img src="${F.image}" style="width:100%;height:100%;display:block;">
        ${hls}
      </div>
    </div>
  </div>${FOOT}</div>`
}

function meetingRoomsPage() {
  const tr = (r, cap, cr, price) => `<tr><td class="rc">${r}</td><td class="cc">${cap}</td><td class="cc">${cr}</td><td class="rr">${price}</td></tr>`
  return `<div class="page"><div class="pad" style="display:flex;gap:.7in;">
    <div style="width:44%;">
      <div class="eyebrow">Meeting Rooms &amp; Studios</div>
      <div class="display" style="font-size:44px;margin-top:12px;">Booked by the hour.</div>
      <div style="position:relative;height:3.1in;overflow:hidden;margin-top:22px;">${bgFill(PHOTO + 'room-east.jpg')}</div>
      <p class="body" style="font-size:10px;margin-top:14px;">Members receive monthly meeting-room credits with every plan, and 40% off once the allowance is used.</p>
    </div>
    <div style="width:56%;">
      <table style="width:100%;border-collapse:collapse;font-family:'HxBody';font-size:11px;">
        <thead><tr>
          <th style="text-align:left;padding:11px 6px;border-bottom:1.5px solid var(--ink);" class="label">Room</th>
          <th style="text-align:center;padding:11px 6px;border-bottom:1.5px solid var(--ink);" class="label">Capacity</th>
          <th style="text-align:center;padding:11px 6px;border-bottom:1.5px solid var(--ink);" class="label">Credits / Hr</th>
          <th style="text-align:right;padding:11px 6px;border-bottom:1.5px solid var(--ink);" class="label">$ / Hr</th>
        </tr></thead>
        <tbody>
          ${tr('Sky · Earth (Consulting)', '4', '1', '$20')}
          ${tr('North · South · West', '8', '4', '$80')}
          ${tr('East (Chinese Tearoom)', '8', '6', '$120')}
          ${tr('Central (Boardroom)', '12', '7', '$140')}
          ${tr('Large Boardroom', '26', '11', '$220')}
          ${tr('Media Studio', '—', '5', '$100')}
        </tbody>
      </table>
      <div class="label" style="margin-top:26px;color:var(--soft);">Monthly credits by plan</div>
      <ul class="bullets" style="margin-top:10px;">
        <li>Flexible — 4 credits ($80 value)</li>
        <li>Dedicated Desk — 8 credits ($160 value)</li>
        <li>Private Office — 10 credits per desk ($800 value)</li>
      </ul>
      <p class="body" style="font-size:9px;color:var(--soft);margin-top:14px;">Credits reset on the 1st of each month. Additional bookings receive 40% off.</p>
    </div>
  </div>${FOOT}</div>`
}

function inclusionsPage() {
  const items = ['24/7 secure access', 'Unlimited internet — 1000/1000 Mbps', '40% discount on meeting-room rates', 'Unlimited 4-pax consulting room use', 'Prestige business address · Box Hill', 'Mail collection &amp; delivery', 'Clients greeted by reception', 'Community event invitations', 'Onsite parking available ($200/mo)', 'Printing facilities ($30/mo · $0.30 B&amp;W · $0.60 colour)']
  return `<div class="page"><div class="pad" style="display:flex;gap:.7in;">
    <div style="width:48%;">
      <div class="eyebrow">Everything Included</div>
      <div class="display" style="font-size:46px;margin-top:12px;">No hidden extras.</div>
      <ul class="bullets" style="margin-top:24px;">${items.map((i) => `<li>${i}</li>`).join('')}</ul>
    </div>
    <div style="width:52%;display:flex;flex-direction:column;gap:.28in;">
      <div style="position:relative;height:3.4in;overflow:hidden;">${bgFill(PHOTO + 'lounge.jpg')}</div>
      <div style="position:relative;height:2in;overflow:hidden;">${bgFill(PHOTO + 'media-1.jpg')}</div>
    </div>
  </div>${FOOT}</div>`
}

function advantagePage() {
  const seg = (h, bg, t, fg) => `<div class="seg" style="height:${h};background:${bg};${fg ? `color:${fg};` : ''}">${t}</div>`
  return `<div class="page"><div class="pad" style="display:flex;gap:.8in;">
    <div style="width:44%;display:flex;flex-direction:column;justify-content:center;">
      <div class="eyebrow">The Hexa Advantage</div>
      <div class="display" style="font-size:46px;margin-top:12px;">One inclusive fee.</div>
      <p class="body" style="margin-top:20px;max-width:4.2in;">A conventional tenancy stacks fit-out, bond, utilities, rates and maintenance on top of rent — before a single desk arrives. Hexa Space folds it all into one predictable monthly fee, so you move in, plug in, and get to work.</p>
      <p class="body" style="font-size:9px;color:var(--soft);margin-top:16px;">Illustrative comparison — standalone non-serviced tenancy vs a Hexa Space suite. Subject to market conditions.</p>
    </div>
    <div style="width:56%;display:flex;align-items:flex-end;justify-content:center;gap:1in;padding-bottom:.6in;">
      <div style="text-align:center;">
        <div style="width:1.5in;height:2.35in;background:#fff;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;"><div class="display" style="font-size:30px;">47%</div></div>
        <div class="label" style="margin-top:12px;">Hexa Space</div>
      </div>
      <div style="text-align:center;">
        <div style="width:1.5in;">
          ${seg('1.05in', '#e3dfd6', 'Fit-out · 35%')}
          ${seg('1.0in', '#cfc9bd', 'Rent · 33%')}
          ${seg('.3in', '#b7b0a1', 'Bond · 7%')}
          ${seg('.26in', '#9a9384', 'Utilities · 6%')}
          ${seg('.34in', '#6f695c', 'Expenses · 9%', '#fff')}
          ${seg('.22in', '#413d34', 'Rates · 5%', '#fff')}
          ${seg('.22in', '#1b1b18', 'Upkeep · 5%', '#fff')}
        </div>
        <div class="label" style="margin-top:12px;">Typical Office</div>
      </div>
    </div>
  </div>${FOOT}</div>`
}

function communityPage() {
  const cell = (src) => `<div style="position:relative;overflow:hidden;flex:1;">${bgFill(PHOTO + src)}</div>`
  return `<div class="page"><div class="pad">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div><div class="eyebrow">Community</div><div class="display" style="font-size:46px;margin-top:12px;">Stronger, together.</div></div>
      <p class="body" style="width:4.2in;font-size:11px;">Dedicated community managers curate events, networking and support programs — surrounding you with forward-thinking businesses eager to grow alongside you.</p>
    </div>
    <div style="display:flex;gap:14px;margin-top:.42in;height:4.05in;">
      <div style="flex:2;position:relative;overflow:hidden;">${bgFill(PHOTO + 'comm-hero.jpg')}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:14px;">${cell('comm-1.jpg')}${cell('comm-2.jpg')}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:14px;">${cell('comm-3.jpg')}${cell('comm-4.jpg')}</div>
    </div>
  </div>${FOOT}</div>`
}

function closingPage(ctx) {
  return `<div class="page" style="background:#1b1b18;">
    <div class="pad" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
      <div class="display" style="color:#fff;font-size:84px;line-height:1.16;padding-bottom:6px;">Hexa Space</div>
      <div class="eyebrow" style="color:#cfd69a;margin-top:22px;letter-spacing:.4em;">六合空间 · Box Hill</div>
      <div style="width:2in;height:1px;background:#3a3a34;margin:34px 0;"></div>
      <p class="body" style="color:#d7d5cf;font-size:12px;line-height:2;">
        ${esc(ctx.sender)}${ctx.title ? ` · ${esc(ctx.title)}` : ''}<br>
        ${esc(ctx.email)} &nbsp;·&nbsp; ${esc(ctx.phone)}<br>
        ${esc(ctx.addr)}<br>
        ${esc(ctx.web)}
      </p>
      <div class="label" style="color:#8f8c93;margin-top:34px;">We'd love to show you around.</div>
    </div>
  </div>`
}

// `compress`: true → lighter, email-friendly file (lower raster scale + JPEG
// quality); false → full-resolution print quality.
export async function buildProposalPdf({ offices = [], coverMsg = '', validityDays = 14, lead = {}, settings = {}, dateStr = '', compress = false }) {
  injectStyles()
  // Full quality is already only ~2.5–3 MB (modest source photos), so "compress"
  // is a gentle optimisation, not a heavy one — keeps the brochure crisp.
  const scale = compress ? 1.7 : 2
  const jpegQ = compress ? 0.8 : 0.9
  const c = settings?.company || {}, e = settings?.emails || {}
  const ctx = {
    client: lead.name || '', business: lead.businessName || '', dateStr,
    sender: e.signName || c.salesContact || 'Eric Kuang',
    title: c.salesTitle || 'Manager',
    email: e.replyTo || c.email || 'eric@hexaspace.com.au',
    phone: c.phone || '+61 406 016 666',
    addr: c.address || '402/830 Whitehorse Road, Box Hill VIC 3128',
    web: c.website || 'hexaspace.com.au',
  }

  // Group chosen offices by floor (Level 2 → 4 → 5) for the plan pages.
  const byFloor = {}
  offices.forEach((o) => { if (o.floor && FLOORS[o.floor]) (byFloor[o.floor] ||= []).push(o) })
  const floorOrder = ['l2', 'l4', 'l5'].filter((f) => byFloor[f])

  const pagesHtml = [
    coverPage(ctx),
    statementPage(),
    theSpacePage(),
    waysToWorkPage(),
    offerPage(offices, coverMsg),                        // page 5 — personalised
    ...floorOrder.map((f) => floorPage(f, byFloor[f])),  // where the suite is
    meetingRoomsPage(),
    inclusionsPage(),
    advantagePage(),
    communityPage(),
    closingPage(ctx),
  ]

  const host = document.createElement('div')
  host.className = 'hxbro'
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;background:${BG};z-index:-1`
  host.innerHTML = pagesHtml.join('')
  document.body.appendChild(host)

  try {
    try {
      await Promise.all([
        document.fonts.load('200 40px "HxDisplay"'),
        document.fonts.load('300 13px "HxBody"'),
        document.fonts.load('600 10px "HxHeading"'),
      ])
      await document.fonts.ready
    } catch { /* fonts optional */ }
    const imgs = [...host.querySelectorAll('img')]
    await Promise.all(imgs.map((im) => im.complete ? im.decode().catch(() => {}) : new Promise((res) => { im.onload = im.onerror = res })))
    // background-image divs: give the browser a tick to fetch them
    await new Promise((r) => setTimeout(r, 350))

    const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [PAGE_W, PAGE_H], compress: true })
    const pages = [...host.querySelectorAll('.page')]
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale, backgroundColor: BG, useCORS: true, logging: false,
        width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, windowHeight: PAGE_H,
      })
      const data = canvas.toDataURL('image/jpeg', jpegQ)
      if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape')
      doc.addImage(data, 'JPEG', 0, 0, PAGE_W, PAGE_H)
    }
    return doc
  } finally {
    document.body.removeChild(host)
  }
}
