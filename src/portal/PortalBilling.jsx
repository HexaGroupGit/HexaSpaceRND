import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { jsPDF } from 'jspdf'
import { Download } from 'lucide-react'

function calcTotals(invoice) {
  let taxable = 0
  let exempt = 0
  for (const li of invoice.lineItems ?? []) {
    const price = (li.unitPrice ?? 0) * (li.qty ?? 1)
    const disc = price * ((li.discountPct ?? 0) / 100)
    if (li.vatExempt) exempt += price - disc
    else taxable += price - disc
  }
  const gst = invoice.vatEnabled ? taxable * 0.1 : 0
  return { subtotal: taxable + exempt, gst, total: taxable + exempt + gst }
}

function fmt(dateStr) {
  try { return format(parseISO(dateStr), 'dd/MM/yyyy') } catch { return '—' }
}

function StatusBadge({ status }) {
  const cls = {
    paid: 'bg-green-50 text-green-700 border-green-200',
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
    voided: 'bg-gray-100 text-gray-500 border-gray-200',
    draft: 'bg-gray-100 text-gray-500 border-gray-200',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${cls[status] ?? cls.draft}`}>
      {status}
    </span>
  )
}

function downloadPDF(invoice, tenant) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const { subtotal, gst, total } = calcTotals(invoice)
  const W = 210
  const M = 20

  // Header
  doc.setFillColor(0, 0, 0)
  doc.rect(0, 0, W, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('HEXAHUB', M, 12)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text('HexaHub Pty Ltd  ·  7 Distribution Circuit, Huntingdale VIC 3166', M, 19)
  doc.text('info@hexahub.com.au  ·  hexahub.com.au', M, 24)

  // Invoice title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text('INVOICE', M, 46)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(invoice.number ?? '', M, 54)

  // Details grid
  let y = 66
  const col2 = 120
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  ;[
    ['Issue Date', fmt(invoice.issueDate)],
    ['Due Date', fmt(invoice.dueDate)],
    ['Status', (invoice.status ?? '').toUpperCase()],
  ].forEach(([label, val]) => {
    doc.text(label, M, y)
    doc.setTextColor(20, 20, 20)
    doc.text(val, M + 28, y)
    doc.setTextColor(120, 120, 120)
    y += 6
  })

  // Bill to
  y = 66
  doc.text('Bill To', col2, y)
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.text(tenant.businessName ?? '', col2, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  if (tenant.contactName) doc.text(tenant.contactName, col2, y + 12)
  if (tenant.email) doc.text(tenant.email, col2, y + 18)

  // Line items table
  y = 100
  doc.setFillColor(20, 20, 20)
  doc.rect(M, y, W - M * 2, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('Description', M + 3, y + 5)
  doc.text('Amount', W - M - 3, y + 5, { align: 'right' })
  y += 7

  ;(invoice.lineItems ?? []).forEach((li, idx) => {
    const price = (li.unitPrice ?? 0) * (li.qty ?? 1)
    const disc = price * ((li.discountPct ?? 0) / 100)
    const net = price - disc
    doc.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255)
    doc.rect(M, y, W - M * 2, 8, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    const maxW = W - M * 2 - 30
    const desc = doc.splitTextToSize(li.description ?? '', maxW)[0]
    doc.text(desc, M + 3, y + 5.5)
    doc.text(`A$${net.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, W - M - 3, y + 5.5, { align: 'right' })
    y += 8
  })

  // Totals
  y += 4
  const totalsX = W - M - 70
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  ;[
    ['Subtotal', `A$${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`],
    ['GST (10%)', `A$${gst.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`],
  ].forEach(([label, val]) => {
    doc.text(label, totalsX, y)
    doc.text(val, W - M - 3, y, { align: 'right' })
    y += 6
  })
  doc.setFillColor(0, 0, 0)
  doc.rect(totalsX - 2, y, W - M - totalsX + 2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Total', totalsX + 1, y + 5.5)
  doc.text(`A$${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, W - M - 3, y + 5.5, { align: 'right' })

  doc.save(`${invoice.number ?? 'invoice'}.pdf`)
}

const FILTERS = ['all', 'pending', 'paid', 'overdue', 'voided']

export default function PortalBilling({ tenant, invoices }) {
  const [filter, setFilter] = useState('all')

  const filtered = [...invoices]
    .filter(i => filter === 'all' || i.status === filter)
    .sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Billing</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-black text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
            {f !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({invoices.filter(i => i.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No invoices found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(inv => {
                const { total } = calcTotals(inv)
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{inv.number}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {inv.periodStart ? `${fmt(inv.periodStart)} – ${fmt(inv.periodEnd)}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {inv.dueDate ? fmt(inv.dueDate) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      A${total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => downloadPDF(inv, tenant)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 ml-auto"
                      >
                        <Download size={13} />
                        PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
