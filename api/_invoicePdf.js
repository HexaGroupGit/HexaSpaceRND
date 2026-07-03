// Server-side branded TAX INVOICE PDF (jsPDF) — returned as base64 so it can be
// attached to Resend emails. Kept self-contained (no src imports).
import { jsPDF } from 'jspdf'

const OLIVE = [127, 139, 47]
const INK = [26, 26, 26]
const MUTE = [110, 110, 110]
const HAIR = [210, 208, 214]
const money = (v) => `$${(Number(v) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function lineAmount(l) {
  const gross = (Number(l.unitPrice) || 0) * (Number(l.qty) || 1)
  return gross - gross * ((Number(l.discountPct) || 0) / 100)
}

// invoice: { number, issueDate, dueDate, clientName, clientEmail, lineItems, vatEnabled, functionRef }
// Returns a base64 string (no data: prefix).
export function invoicePdfBase64(invoice, settings = {}) {
  const b = settings.billing || {}
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 48
  let y = 60

  // Header
  doc.setTextColor(...INK).setFont('helvetica', 'normal').setFontSize(15)
  doc.text('H E X A   S P A C E', M, y, { charSpace: 1 })
  doc.setTextColor(...MUTE).setFont('helvetica', 'normal').setFontSize(9)
  doc.text('TAX INVOICE', W - M, y, { align: 'right', charSpace: 2 })
  y += 6
  doc.setDrawColor(...OLIVE).setLineWidth(2).line(M, y, M + 54, y)

  // From block
  y += 26
  doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(10)
  doc.text(b.businessName || 'Hexa Space Pty Ltd', M, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTE)
  y += 14; if (b.abn) { doc.text(`ABN ${b.abn}`, M, y); y += 13 }
  if (b.address) { doc.text(b.address, M, y); y += 13 }

  // Invoice meta (right column)
  let my = 100
  const metaLabel = (l, v) => {
    doc.setTextColor(...MUTE).setFont('helvetica', 'normal').setFontSize(9)
    doc.text(l, W - M - 150, my)
    doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(9)
    doc.text(String(v || '—'), W - M, my, { align: 'right' })
    my += 16
  }
  metaLabel('Invoice #', invoice.number)
  metaLabel('Issue date', invoice.issueDate)
  metaLabel('Due date', invoice.dueDate)
  if (invoice.functionRef) metaLabel('Reference', invoice.functionRef)

  // Bill to
  y = Math.max(y, my) + 12
  doc.setTextColor(...OLIVE).setFont('helvetica', 'bold').setFontSize(8)
  doc.text('BILL TO', M, y, { charSpace: 1 })
  y += 15
  doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(10)
  doc.text(invoice.clientName || 'Client', M, y)
  if (invoice.clientEmail) { y += 13; doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTE); doc.text(invoice.clientEmail, M, y) }

  // Line items table
  y += 26
  const cAmt = W - M
  const cGst = W - M - 90
  const cQty = W - M - 150
  doc.setFillColor(245, 244, 246).rect(M, y - 12, W - M * 2, 22, 'F')
  doc.setTextColor(...MUTE).setFont('helvetica', 'bold').setFontSize(8)
  doc.text('DESCRIPTION', M + 8, y + 3, { charSpace: 1 })
  doc.text('QTY', cQty, y + 3, { align: 'right' })
  doc.text('GST', cGst, y + 3, { align: 'right' })
  doc.text('AMOUNT', cAmt - 8, y + 3, { align: 'right' })
  y += 22

  let taxable = 0, exempt = 0
  doc.setTextColor(...INK).setFont('helvetica', 'normal').setFontSize(9)
  for (const l of invoice.lineItems || []) {
    const amt = lineAmount(l)
    if (l.vatExempt) exempt += amt; else taxable += amt
    const desc = doc.splitTextToSize(l.description || '—', cQty - M - 20)
    doc.text(desc, M + 8, y)
    doc.text(String(l.qty || 1), cQty, y, { align: 'right' })
    doc.text(l.vatExempt ? '—' : 'Yes', cGst, y, { align: 'right' })
    doc.text(money(amt), cAmt - 8, y, { align: 'right' })
    y += Math.max(16, desc.length * 12 + 4)
    doc.setDrawColor(...HAIR).setLineWidth(0.5).line(M, y - 6, W - M, y - 6)
  }

  // Totals
  const gst = invoice.vatEnabled ? taxable * 0.1 : 0
  const total = taxable + exempt + gst
  y += 8
  const totRow = (l, v, strong) => {
    doc.setTextColor(...(strong ? INK : MUTE)).setFont('helvetica', strong ? 'bold' : 'normal').setFontSize(strong ? 11 : 9)
    doc.text(l, cGst, y, { align: 'right' })
    doc.setTextColor(...INK)
    doc.text(money(v), cAmt - 8, y, { align: 'right' })
    y += strong ? 20 : 16
  }
  totRow('Subtotal', taxable + exempt)
  if (invoice.vatEnabled) totRow('GST (10%)', gst)
  y += 2; doc.setDrawColor(...INK).setLineWidth(1).line(cGst - 10, y - 8, W - M, y - 8)
  totRow('Total (inc GST)', total, true)

  // Payment details
  y += 20
  doc.setFillColor(247, 247, 244).rect(M, y - 12, W - M * 2, 86, 'F')
  doc.setTextColor(...OLIVE).setFont('helvetica', 'bold').setFontSize(8)
  doc.text('PAYMENT DETAILS', M + 12, y + 4, { charSpace: 1 })
  doc.setTextColor(...INK).setFont('helvetica', 'normal').setFontSize(9)
  let py = y + 22
  const pd = []
  if (b.bankName) pd.push(`Bank: ${b.bankName}`)
  if (b.businessName) pd.push(`Account name: ${b.businessName}`)
  if (b.bsb) pd.push(`BSB: ${b.bsb}`)
  if (b.acc) pd.push(`Account: ${b.acc}`)
  pd.push(`Reference: ${invoice.functionRef || invoice.number}`)
  pd.forEach((t) => { doc.text(t, M + 12, py); py += 13 })

  return doc.output('arraybuffer') ? Buffer.from(doc.output('arraybuffer')).toString('base64') : ''
}
