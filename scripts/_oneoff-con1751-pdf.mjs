// One-off: generate a standalone LICENCE AGREEMENT PDF for CON-1751 with an
// overridden term. Reads the live contract/tenant/settings/templates from
// Supabase but WRITES NOTHING BACK — the platform record is untouched.
//
//   node scripts/_oneoff-con1751-pdf.mjs [outfile.pdf]
//
// Layout is copied verbatim from ContractDetail.buildContractPDF() so the
// output is the same document the admin "Generate PDF" button produces, only
// with the term below.
import fs from 'fs'
import { jsPDF } from 'jspdf'
import { format, parseISO } from 'date-fns'
import { parse as parseHtml } from 'node-html-parser'
import { buildPaymentSchedule, scheduleAmount } from '../src/lib/paymentSchedule.js'
import { stepMonthly } from '../src/lib/leasePricing.js'
import { leaseInclusions } from '../src/lib/voInclusions.js'
import { resolvePrimaryContact } from '../src/lib/leaseContact.js'
import { requiresCardOnFile } from '../src/lib/onboarding.js'
import { fillTermsVars } from '../src/lib/termsVars.js'

// ── Requested term ────────────────────────────────────────────────────────────
const TERM_START = '2026-01-01'
const NIL_FEE_END = '2026-05-31'
const PAY_FROM = '2026-06-01'   // licence fees commence
const TERM_END = '2027-08-31'
const OUT = process.argv[2] ?? 'CON-1751_Boss_international_group_pty_ltd.pdf'

// ── Read-only pull from Supabase (Management API, same as scripts/db-query) ───
const REF = 'ihvhnsdsvjwpyquvetzz'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

const [leaseRow] = await q("select data from leases where data->>'contractNumber'='CON-1751'")
const real = leaseRow.data
const [tenantRow] = await q(`select data from tenants where data->>'id'='${real.tenantId}'`)
const tenant = tenantRow.data
const members = (await q(`select data from members where data->>'companyId'='${real.tenantId}'`)).map((r) => r.data)
const [settingsRow] = await q('select data from settings limit 1')
const settings = settingsRow.data
const templates = (await q("select data from templates where data->>'id' in ('tmpl1','tmpl2')")).map((r) => r.data)

// ── The lease this document describes ─────────────────────────────────────────
// Two pricing steps: nil licence fee to 31/05/2026, then $75/month from
// 01/06/2026 — so the fee table and the month-by-month schedule both state the
// arrangement outright rather than burying it in a total.
const lease = {
  ...real,
  startDate: TERM_START,
  endDate: TERM_END,
  rentFreeMonths: 0,
  items: [{
    spaceId: real.spaceId,
    deposit: 0,
    steps: [
      { startDate: TERM_START, endDate: NIL_FEE_END, listPrice: 75, discount: '100%', qty: 1 },
      { startDate: PAY_FROM, endDate: TERM_END, listPrice: 75, discount: '', qty: 1 },
    ],
  }],
}

// CON-1751 points at hx_vo_CON-62 = "Suite 421", which belongs to Invincible
// Energy (CON-62, active to Jul 2027). Printing that number here would hand
// Boss International another member's registered address, so this document
// carries the generic Level 4 business address and no suite number.
const space = { id: real.spaceId, type: 'virtual', unitNumber: null, floor: 'l4' }
const officeLabel = real.resource ?? 'Virtual Office — Business Address'

const contractNum = 'CON-1751'
const primaryContact = resolvePrimaryContact(lease, tenant, members)
const contractDocs = ['tmpl1', 'tmpl2'].map((id) => templates.find((t) => t.id === id)).filter(Boolean)

// ── Document ──────────────────────────────────────────────────────────────────
const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
const W = doc.internal.pageSize.getWidth()
const H = doc.internal.pageSize.getHeight()
const ml = 18, mr = W - 18
let y = 20
function checkPage(needed = 14) { if (y + needed > H - 15) { doc.addPage(); y = 20 } }

const companyName = settings?.billing?.businessName ?? settings?.company?.name ?? 'Hexa Space Pty Ltd'
const billingAddress = settings?.billing?.address ?? '402/830 Whitehorse Road, Box Hill VIC 3128'
const addrComma = billingAddress.indexOf(',')
const addrLine1 = addrComma > -1 ? billingAddress.slice(0, addrComma).trim() : billingAddress
const addrLine2 = addrComma > -1 ? billingAddress.slice(addrComma + 1).trim() : ''

doc.setTextColor(0)
doc.setFontSize(15); doc.setFont('helvetica', 'bold')
doc.text('LICENCE AGREEMENT', ml, y)
doc.setFontSize(13); doc.setFont('helvetica', 'bold')
doc.text('HEXA SPACE', mr, y, { align: 'right' })
y += 10

doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
const agLabel = 'Agreement ID: '
doc.text(agLabel, ml, y); doc.setFont('helvetica', 'bold'); doc.text(contractNum, ml + doc.getTextWidth(agLabel), y)
doc.setFont('helvetica', 'normal')
doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, ml, y + 5)

doc.setFont('helvetica', 'bold'); doc.text('Business Centre Address', mr, y, { align: 'right' })
doc.setFont('helvetica', 'normal'); doc.setTextColor(80)
doc.text(addrLine1, mr, y + 5, { align: 'right' })
if (addrLine2) doc.text(addrLine2, mr, y + 10, { align: 'right' })
doc.text('Australia, Victoria', mr, y + (addrLine2 ? 15 : 10), { align: 'right' })
y += addrLine2 ? 22 : 17
doc.setDrawColor(200); doc.setLineWidth(0.3); doc.setTextColor(0)
doc.line(ml, y, mr, y); y += 8

const colMid = ml + (mr - ml) / 2 + 4
doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
doc.text('COMPANY', ml, y)
doc.text('PRIMARY CONTACT', colMid, y)
y += 6
doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
const leftLines = [
  `Company: ${tenant?.businessName ?? '—'}`,
  `Address:`,
  `City/State:`,
  `Post code:`,
  `ABN: ${tenant?.abn ?? ''}`,
]
const rightLines = [
  `Name: ${primaryContact.name || '—'}`,
  `Number: ${primaryContact.phone}`,
  `Email: ${primaryContact.email}`,
]
for (let i = 0; i < Math.max(leftLines.length, rightLines.length); i++) {
  checkPage()
  if (leftLines[i]) doc.text(leftLines[i], ml, y)
  if (rightLines[i]) doc.text(rightLines[i], colMid, y)
  y += 5
}
y += 6

// ── Licence Fee Details ───────────────────────────────────────────────────────
doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80)
doc.text('LICENCE FEE DETAILS', ml, y); doc.setTextColor(0)
doc.setDrawColor(180); doc.setLineWidth(0.3); doc.line(ml, y + 2, mr, y + 2)
y += 7

const cols = { office: ml, start: ml + 45, end: ml + 95, total: mr }
doc.setFillColor(20, 20, 20)
doc.rect(ml, y - 3.5, mr - ml, 7, 'F')
doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
doc.text('OFFICE', cols.office, y + 0.5)
doc.text('START DATE', cols.start, y + 0.5)
doc.text('END DATE', cols.end, y + 0.5)
doc.text('MONTHLY TOTAL', cols.total, y + 0.5, { align: 'right' })
doc.setTextColor(0)
y += 7

doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
let rowIdx = 0
for (const item of lease.items) {
  for (const step of item.steps) {
    checkPage()
    const monthly = stepMonthly(step)
    if (rowIdx % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(ml, y - 2, mr - ml, 7, 'F') }
    doc.setTextColor(0)
    doc.text(officeLabel, cols.office, y + 3)
    doc.text(format(parseISO(step.startDate), 'dd/MM/yyyy'), cols.start, y + 3)
    doc.text(format(parseISO(step.endDate), 'dd/MM/yyyy'), cols.end, y + 3)
    doc.setFont('helvetica', 'bold')
    doc.text(`$${monthly.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD`, cols.total, y + 3, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 8; rowIdx++
  }
}
doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(ml, y, mr, y)
y += 6

// ── Inclusions ────────────────────────────────────────────────────────────────
const pdfInclusions = leaseInclusions(lease, space)
if (pdfInclusions.length > 0) {
  checkPage(20)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80)
  doc.text('INCLUSIONS', ml, y); doc.setTextColor(0)
  doc.setDrawColor(180); doc.setLineWidth(0.3); doc.line(ml, y + 2, mr, y + 2)
  y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  for (const item of pdfInclusions) {
    const lines = doc.splitTextToSize(item, mr - ml - 8)
    checkPage(lines.length * 4 + 4)
    doc.text('•', ml + 1, y + 3)
    doc.text(lines, ml + 5, y + 3)
    y += lines.length * 4 + 2.5
  }
  y += 5
}

// ── Summary ───────────────────────────────────────────────────────────────────
const schedule = buildPaymentSchedule(lease, settings)
const deposit = 0
const taxRatePct = settings?.billingRules?.taxRate ?? 10
// The first month that actually carries a fee — the nil-fee opening months
// would otherwise report a $0.00 "initial payment".
const firstMonth = Number(schedule?.rows?.find((r) => r.total > 0)?.total ?? 0)
const gst = Math.round(firstMonth * (taxRatePct / 100) * 100) / 100
const totalInit = Math.round((firstMonth + gst + deposit) * 100) / 100

const sumRows = [
  ['Minimum Notice Period:', `${lease.noticePeriodMonths ?? 1} (M), 0 (W), 0 (D)`],
  ['Start Date:', format(parseISO(TERM_START), 'dd/MM/yyyy')],
  ['End Date:', format(parseISO(TERM_END), 'dd/MM/yyyy')],
  ['Licence Fees Commence:', format(parseISO(PAY_FROM), 'dd/MM/yyyy')],
]
const payRows = [
  ['Initial payment:', `${firstMonth.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD`],
  [`GST ${taxRatePct} %:`, `${gst.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD`],
  ['Total initial payment:', `${totalInit.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD`],
  ['Deposit', `${deposit.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD`],
]
doc.setFontSize(8); doc.setTextColor(80)
for (let i = 0; i < Math.max(sumRows.length, payRows.length); i++) {
  checkPage()
  if (sumRows[i]) {
    doc.setFont('helvetica', 'bold'); doc.text(sumRows[i][0], ml, y + 3)
    doc.setFont('helvetica', 'normal'); doc.text(sumRows[i][1], colMid - 6, y + 3, { align: 'right' })
    doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(ml, y + 5, colMid - 4, y + 5)
  }
  if (payRows[i]) {
    doc.setFont('helvetica', 'bold'); doc.text(payRows[i][0], colMid + 2, y + 3)
    doc.setFont('helvetica', 'normal'); doc.text(payRows[i][1], mr, y + 3, { align: 'right' })
    doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(colMid + 2, y + 5, mr, y + 5)
  }
  y += 7
}
doc.setTextColor(0)
y += 4
doc.setFontSize(6.5); doc.setTextColor(130)
doc.text(`*No licence fee is payable for the period ${format(parseISO(TERM_START), 'dd/MM/yyyy')} to ${format(parseISO(NIL_FEE_END), 'dd/MM/yyyy')}. Licence fees commence ${format(parseISO(PAY_FROM), 'dd/MM/yyyy')}.`, ml, y)
y += 4
doc.text('*Minimum Term is subject to written notice from either party. Minimum notice period as specified above.', ml, y)
y += 10; doc.setTextColor(0)

// ── Payment Schedule ──────────────────────────────────────────────────────────
if (schedule) {
  checkPage(24)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80)
  doc.text('PAYMENT SCHEDULE', ml, y); doc.setTextColor(0)
  doc.setDrawColor(180); doc.setLineWidth(0.3); doc.line(ml, y + 2, mr, y + 2)
  y += 7

  const sCols = { month: ml, office: ml + 62, services: ml + 92, total: ml + 124, incGst: mr }
  const scheduleHeader = () => {
    doc.setFillColor(20, 20, 20)
    doc.rect(ml, y - 3.5, mr - ml, 7, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    doc.text('MONTH', sCols.month, y + 0.5)
    doc.text('OFFICE', sCols.office, y + 0.5, { align: 'right' })
    doc.text('SERVICES', sCols.services, y + 0.5, { align: 'right' })
    doc.text('MONTH TOTAL', sCols.total, y + 0.5, { align: 'right' })
    doc.text('TOTAL INCL. GST', sCols.incGst, y + 0.5, { align: 'right' })
    doc.setTextColor(0)
    y += 7
  }
  scheduleHeader()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  schedule.rows.forEach((r, i) => {
    if (y + 8 > H - 15) { doc.addPage(); y = 20; scheduleHeader(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8) }
    if (i % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(ml, y - 2, mr - ml, 7, 'F') }
    doc.setTextColor(0)
    doc.text(r.label + (r.total === 0 ? '  (no licence fee)' : ''), sCols.month, y + 3)
    doc.text(`${scheduleAmount(r.office)} AUD`, sCols.office, y + 3, { align: 'right' })
    doc.text(`${scheduleAmount(r.services)} AUD`, sCols.services, y + 3, { align: 'right' })
    doc.text(`${scheduleAmount(r.total)} AUD`, sCols.total, y + 3, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(`${scheduleAmount(r.incGst)} AUD`, sCols.incGst, y + 3, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 8
  })
  if (y + 8 > H - 15) { doc.addPage(); y = 20 }
  doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(ml, y - 1, mr, y - 1)
  doc.setFont('helvetica', 'bold')
  doc.text('Total', sCols.month, y + 3)
  doc.text(`${scheduleAmount(schedule.totals.office)} AUD`, sCols.office, y + 3, { align: 'right' })
  doc.text(`${scheduleAmount(schedule.totals.services)} AUD`, sCols.services, y + 3, { align: 'right' })
  doc.text(`${scheduleAmount(schedule.totals.total)} AUD`, sCols.total, y + 3, { align: 'right' })
  doc.text(`${scheduleAmount(schedule.totals.incGst)} AUD`, sCols.incGst, y + 3, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 13
}

// ── Payment authority ─────────────────────────────────────────────────────────
if (requiresCardOnFile(lease)) {
  checkPage(36)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80)
  doc.text('PAYMENT AUTHORITY', ml, y); doc.setTextColor(0)
  doc.setDrawColor(180); doc.setLineWidth(0.3); doc.line(ml, y + 2, mr, y + 2)
  y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(50, 50, 50)
  const authorityText = 'As a condition of this membership, the Member will register a valid payment card, verified and securely stored by Stripe, at the time of signing this Agreement, and will keep a valid card registered for the duration of the membership. The Member authorises Hexa Space to charge this card for any amount that remains unpaid seven (7) or more days after its invoice due date, including membership fees and other amounts payable under this Agreement, in accordance with clause 7(i) (Direct Debit Authority for Overdue Invoices) of the Terms & Conditions. Hexa Space will issue each invoice in the normal course, will give the Member at least two (2) business days’ prior written notice by email before charging the card, and a receipt is provided for every charge. Card numbers are held by Stripe — Hexa Space does not store or have access to full card details. The Member may update the registered card at any time via the member portal.'
  const authorityLines = doc.splitTextToSize(authorityText, mr - ml)
  doc.text(authorityLines, ml, y)
  y += authorityLines.length * 3.6 + 8
  doc.setTextColor(0)
}

// ── Signature blocks (left blank — filled on execution) ───────────────────────
checkPage(65)
doc.setFillColor(0); doc.rect(ml, y, mr - ml, 0.5, 'F')
y += 8
const sigColW = (mr - ml - 8) / 2
function drawSigBlock(x, party, name) {
  const bx = x, bw = sigColW
  doc.setFillColor(20, 20, 20)
  doc.rect(bx, y, bw, 7, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255)
  doc.text(party.toUpperCase(), bx + 3, y + 4.5)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80)
  doc.text(`For and on behalf of: ${name}`, bx, y + 11)
  doc.setTextColor(0)
  let fy = y + 16
  for (const label of ['Full Name', 'Title / Position', 'Date']) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(100)
    doc.text(label, bx, fy)
    doc.setDrawColor(180); doc.setLineWidth(0.3)
    doc.rect(bx, fy + 1, bw, 6, 'S')
    fy += 11
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(100)
  doc.text('Signature', bx, fy)
  doc.setDrawColor(180); doc.setLineWidth(0.3)
  doc.rect(bx, fy + 1, bw, 18, 'S')
}
drawSigBlock(ml, 'You The Licensee', tenant?.businessName ?? 'The Licensee')
drawSigBlock(ml + sigColW + 8, 'Us The Licensor', companyName)
y += 72

// ── Attached documents: Terms & Conditions, House Rules ───────────────────────
const ENT = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
  '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
}
const decode = (s) => String(s ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&[a-zA-Z]+;/g, (m) => ENT[m] ?? m)
  .replace(/\s+/g, ' ')
  .trim()

function renderHtml(html) {
  const root = parseHtml(html ?? '')
  for (const node of root.childNodes) {
    if (node.nodeType !== 1) continue
    const tag = String(node.rawTagName ?? '').toLowerCase()
    const text = decode(node.textContent)
    if (!text) continue
    if (y + 12 > H - 15) { doc.addPage(); y = 20 }
    if (tag === 'h1' || tag === 'h2') {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0)
      const lines = doc.splitTextToSize(text, mr - ml)
      doc.text(lines, ml, y); y += lines.length * 5.5 + 4
    } else if (tag === 'h3') {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0)
      const lines = doc.splitTextToSize(text, mr - ml)
      doc.text(lines, ml, y); y += lines.length * 5 + 2
    } else if (tag === 'p') {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50)
      const lines = doc.splitTextToSize(text, mr - ml)
      doc.text(lines, ml, y); y += lines.length * 4.3 + 3
    } else if (tag === 'ul' || tag === 'ol') {
      node.querySelectorAll('li').forEach((li, idx) => {
        if (y + 8 > H - 15) { doc.addPage(); y = 20 }
        const prefix = tag === 'ol' ? `${idx + 1}.  ` : '•  '
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50)
        const lines = doc.splitTextToSize(prefix + decode(li.textContent), mr - ml - 6)
        doc.text(lines, ml + 5, y); y += lines.length * 4.3 + 2
      })
      y += 2
    }
  }
  doc.setTextColor(0)
}

for (const tmpl of contractDocs) {
  doc.addPage(); y = 20
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0)
  doc.text(String(tmpl.name).toUpperCase(), ml, y); y += 7
  doc.setDrawColor(0); doc.setLineWidth(0.4)
  doc.line(ml, y, mr, y); y += 8
  const html = tmpl.content ?? (tmpl.clauses ?? []).map((c) => `<h3>${c.number}. ${c.title}</h3><p>${c.content}</p>`).join('')
  renderHtml(fillTermsVars(html, settings))
}

// ── Footer ────────────────────────────────────────────────────────────────────
const pages = doc.getNumberOfPages()
for (let i = 1; i <= pages; i++) {
  doc.setPage(i)
  doc.setFillColor(20, 20, 20)
  doc.rect(0, H - 10, W, 10, 'F')
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160)
  doc.text(`${contractNum} · ${companyName} · ${billingAddress}`, W / 2, H - 5, { align: 'center' })
  doc.setTextColor(220, 220, 220); doc.setFont('helvetica', 'bold')
  doc.text(`${i} / ${pages}`, mr, H - 5, { align: 'right' })
}

fs.writeFileSync(OUT, Buffer.from(doc.output('arraybuffer')))
console.log(`Wrote ${OUT} — ${pages} pages`)
console.log('Term:', TERM_START, '->', TERM_END,
  '| months:', schedule.rows.length,
  '| first paid month:', schedule.rows.find((r) => r.total > 0)?.label,
  '| paid months:', schedule.rows.filter((r) => r.total > 0).length,
  '| total ex GST:', schedule.totals.total,
  '| inc GST:', schedule.totals.incGst)
