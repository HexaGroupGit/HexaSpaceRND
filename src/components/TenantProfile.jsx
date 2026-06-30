import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Pencil, Building2, Mail, Phone, Hash, Plus, FileDown, Send, MessageSquare } from 'lucide-react'
import InvoiceForm from './InvoiceForm.jsx'
import DocumentsPanel from './DocumentsPanel.jsx'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase.js'

const SIG_BADGE = {
  manually_signed:   { label: 'Signed',       cls: 'bg-green-100 text-green-700' },
  e_signed:          { label: 'E Signed',      cls: 'bg-green-100 text-green-700' },
  out_for_signature: { label: 'Out for Sig',   cls: 'bg-yellow-100 text-yellow-700' },
  not_signed:        { label: 'Not Signed',    cls: 'bg-red-100 text-red-700' },
}

const INV_STATUS = {
  pending: { label: 'Pending', cls: 'bg-orange-100 text-orange-700' },
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700' },
  voided:  { label: 'Voided',  cls: 'bg-gray-100 text-gray-500' },
}

function Badge({ label, cls }) {
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${cls}`}>{label}</span>
}

function fmt(d) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d ?? '—' }
}

function fmtAud(n) {
  return `$${Number(n ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
}

function Section({ title, action, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function TenantProfile({ tenant, leases, invoices, spaces, settings, onBack, onEdit, onSelectInvoice, onSelectContract, onAddInvoice }) {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const tenantLeases = leases.filter((l) => l.tenantId === tenant.id)

  function generateStatement() {
    const taxRate = (settings?.billingRules?.taxRate ?? 10) / 100
    const companyName = settings?.billing?.businessName ?? settings?.company?.name ?? 'HexaHub Pty Ltd'
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const ml = 15, mr = W - 15
    let y = 20

    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(0)
    doc.text('STATEMENT OF ACCOUNT', ml, y); y += 8
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80)
    doc.text(`Prepared: ${format(new Date(), 'dd/MM/yyyy')}`, ml, y)
    doc.text(companyName, mr, y, { align: 'right' }); y += 10

    doc.setDrawColor(0); doc.setLineWidth(0.4)
    doc.line(ml, y, mr, y); y += 6

    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0)
    doc.text('To:', ml, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tenant.businessName ?? '', ml + 8, y); y += 5
    if (tenant.contactName) { doc.text(tenant.contactName, ml + 8, y); y += 5 }
    if (tenant.email) { doc.text(tenant.email, ml + 8, y); y += 5 }
    y += 5

    // Table header
    const cols = { num: ml, date: ml + 28, due: ml + 58, period: ml + 88, status: ml + 130, amount: mr }
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(60)
    doc.text('Invoice', cols.num, y)
    doc.text('Issue Date', cols.date, y)
    doc.text('Due Date', cols.due, y)
    doc.text('Period', cols.period, y)
    doc.text('Status', cols.status, y)
    doc.text('Amount', cols.amount, y, { align: 'right' })
    y += 2
    doc.setLineWidth(0.3); doc.setDrawColor(180)
    doc.line(ml, y, mr, y); y += 5

    const tInvoices = invoices.filter((inv) => inv.tenantId === tenant.id && inv.status !== 'voided')
    let totalInvoiced = 0, totalPaid = 0

    for (const inv of tInvoices) {
      if (y > H - 30) { doc.addPage(); y = 20 }
      const sub = (inv.lineItems ?? []).reduce((s, l) => s + Math.round(l.unitPrice * l.qty * (1 - (l.discountPct ?? 0) / 100) * 100) / 100, 0)
      const gst = inv.vatEnabled !== false ? Math.round(sub * taxRate * 100) / 100 : 0
      const total = sub + gst
      const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
      totalInvoiced += total; totalPaid += paid

      doc.setFont('helvetica', 'normal'); doc.setTextColor(0); doc.setFontSize(8)
      doc.text(inv.number ?? '', cols.num, y)
      doc.text(inv.issueDate ?? '', cols.date, y)
      doc.text(inv.dueDate ?? '', cols.due, y)
      const period = inv.periodStart ? `${inv.periodStart.slice(0, 7)}` : (inv.invoiceType === 'deposit' ? 'Deposit' : '—')
      doc.text(period, cols.period, y)
      doc.setTextColor(inv.status === 'overdue' ? 180 : inv.status === 'paid' ? 0 : 80, 0, 0)
      doc.text(inv.status?.toUpperCase() ?? '', cols.status, y)
      doc.setTextColor(0)
      doc.text(`$${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, cols.amount, y, { align: 'right' })
      y += 6

      // Show payments
      for (const pay of (inv.payments ?? [])) {
        if (y > H - 30) { doc.addPage(); y = 20 }
        doc.setTextColor(0, 120, 0); doc.setFontSize(7.5)
        doc.text(`  Payment received ${pay.date ?? ''} — ${pay.method ?? ''}`, cols.num, y)
        doc.text(`-$${Number(pay.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, cols.amount, y, { align: 'right' })
        doc.setTextColor(0)
        y += 5
      }
    }

    // Totals
    y += 4; doc.setLineWidth(0.4); doc.setDrawColor(0)
    doc.line(ml + 80, y, mr, y); y += 5
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text('Total Invoiced:', ml + 80, y)
    doc.text(`$${totalInvoiced.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, mr, y, { align: 'right' }); y += 5
    doc.text('Total Paid:', ml + 80, y)
    doc.text(`$${totalPaid.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, mr, y, { align: 'right' }); y += 5
    doc.setFont('helvetica', 'bold')
    doc.text('Balance Outstanding:', ml + 80, y)
    doc.text(`$${Math.max(0, totalInvoiced - totalPaid).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, mr, y, { align: 'right' })

    const slug = (tenant.businessName ?? 'tenant').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
    doc.save(`Statement_${slug}_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }


  const tenantInvoices = invoices.filter((inv) => inv.tenantId === tenant.id)
  const taxRate = (settings?.billingRules?.taxRate ?? 10) / 100

  const activeLeases = tenantLeases.filter((l) => l.status === 'active')
  const mrr = activeLeases.reduce((s, l) => s + (Number(l.monthlyRent) || 0), 0)

  const depositInvoices = tenantInvoices.filter((inv) => inv.invoiceType === 'deposit' && inv.status !== 'voided')
  const depositHeld = depositInvoices
    .filter((inv) => inv.status !== 'paid')
    .reduce((s, inv) => s + (inv.lineItems ?? []).reduce((a, l) => a + Math.round(l.unitPrice * l.qty * (1 - (l.discountPct ?? 0) / 100) * 100) / 100, 0), 0)

  const signedLeases = tenantLeases.filter((l) => ['manually_signed', 'e_signed'].includes(l.signatureStatus))
  const oneOffFees = signedLeases.map((lease) => {
    const bondAmount = lease.items?.[0]?.deposit ?? lease.bondAmount ?? 0
    if (!bondAmount) return null
    const space = spaces.find((s) => s.id === lease.spaceId)
    const depInv = tenantInvoices.find((inv) => inv.leaseId === lease.id && inv.invoiceType === 'deposit' && inv.status !== 'voided')
    let status, statusCls
    if (!depInv) { status = 'Not Invoiced'; statusCls = 'bg-gray-100 text-gray-500' }
    else if (depInv.status === 'paid') { status = 'Paid'; statusCls = 'bg-green-100 text-green-700' }
    else { status = 'Invoiced'; statusCls = 'bg-blue-100 text-blue-700' }
    return {
      id: lease.id,
      name: `Security Deposit — ${space?.unitNumber ?? lease.spaceId}`,
      contract: lease.contractNumber ?? `CON-${lease.id.slice(-3).toUpperCase()}`,
      amount: bondAmount, date: lease.startDate, status, statusCls,
      invoiceNumber: depInv?.number ?? null, invoiceId: depInv?.id ?? null,
    }
  }).filter(Boolean)

  return (
    <>
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
              <ArrowLeft size={15} /> Tenants
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-800">{tenant.businessName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={generateStatement} className="flex items-center gap-1.5 text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 text-gray-600">
              <FileDown size={13} /> Statement PDF
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 text-gray-600">
              <Pencil size={13} /> Edit Details
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — fixed sidebar */}
        <aside className="w-60 shrink-0 bg-white border-r border-gray-200 overflow-y-auto p-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Building2 size={28} className="text-gray-400" />
            </div>
          </div>
          <h2 className="text-center font-bold text-gray-900 text-sm mb-1">{tenant.businessName}</h2>
          {tenant.email && <p className="text-center text-xs text-gray-500 mb-5 break-all">{tenant.email}</p>}

          <div className="space-y-3 text-xs text-gray-600">
            {tenant.contactName && <Row label="Contact">{tenant.contactName}</Row>}
            {tenant.phone && <Row icon={<Phone size={11} />}>{tenant.phone}</Row>}
            {tenant.abn && <Row icon={<Hash size={11} />}>ABN: {tenant.abn}</Row>}
            {tenant.industry && <Row label="Industry">{tenant.industry}</Row>}
            {tenant.country && <Row label="Country">{tenant.country}</Row>}
            {tenant.createdAt && <Row label="Since">{fmt(tenant.createdAt)}</Row>}
          </div>

          {/* Portal status */}
          <PortalSidebarStatus email={tenant.email} />
        </aside>

        {/* Scrollable main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Stats bar */}
          <div className="bg-white border-b border-gray-200 px-8 py-5 grid grid-cols-4 gap-6 shrink-0">
            {[
              ['MRR', fmtAud(mrr)],
              ['Active Contracts', activeLeases.length],
              ['Total Invoices', tenantInvoices.filter((i) => i.status !== 'voided').length],
              ['Deposit Held', fmtAud(depositHeld)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="p-8 space-y-6">

            {/* ── Active Contracts ── */}
            <Section title="Active Contracts">
              {activeLeases.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">No active contracts.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {activeLeases.map((l) => {
                      const space = spaces.find((s) => s.id === l.spaceId)
                      return (
                        <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => onSelectContract?.(l)}>
                          <td className="px-5 py-3 font-medium text-gray-900">{l.contractNumber ?? `CON-${l.id.slice(-3).toUpperCase()}`}</td>
                          <td className="px-5 py-3 text-gray-600">{space?.unitNumber ?? '—'}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{fmt(l.startDate)} – {fmt(l.endDate)}</td>
                          <td className="px-5 py-3 text-right font-medium text-gray-900">{fmtAud(l.monthlyRent)}/mo</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Section>

            {/* ── One-off Fees (Deposits) ── */}
            <Section title="One-off Fees">
              {oneOffFees.length === 0 ? (
                <p className="px-5 py-5 text-sm text-gray-400">No one-off fees. Deposits appear here once a contract is signed.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Name', 'Contract', 'Date', 'Amount', 'Status', 'Invoice'].map((h) => (
                        <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {oneOffFees.map((fee) => (
                      <tr key={fee.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{fee.name}</td>
                        <td className="px-5 py-3 text-gray-600">{fee.contract}</td>
                        <td className="px-5 py-3 text-gray-500">{fmt(fee.date)}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">{fmtAud(fee.amount)}</td>
                        <td className="px-5 py-3"><Badge label={fee.status} cls={fee.statusCls} /></td>
                        <td className="px-5 py-3">
                          {fee.invoiceNumber ? (
                            <button onClick={() => { const inv = tenantInvoices.find((i) => i.id === fee.invoiceId); if (inv) onSelectInvoice?.(inv) }}
                              className="text-blue-600 hover:underline text-xs font-medium">{fee.invoiceNumber}</button>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {/* ── All Contracts ── */}
            <Section title="Contracts">
              {tenantLeases.length === 0 ? (
                <p className="px-5 py-5 text-sm text-gray-400">No contracts.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Number', 'Document Type', 'Status', 'Signature', 'Period', 'Monthly'].map((h) => (
                        <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenantLeases.map((l) => {
                      const sig = SIG_BADGE[l.signatureStatus] ?? SIG_BADGE.not_signed
                      const space = spaces.find((s) => s.id === l.spaceId)
                      return (
                        <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => onSelectContract?.(l)}>
                          <td className="px-5 py-3 font-medium text-gray-900">{l.contractNumber ?? `CON-${l.id.slice(-3).toUpperCase()}`}</td>
                          <td className="px-5 py-3 text-gray-600">{l.documentType ?? 'License Agreement'}</td>
                          <td className="px-5 py-3">
                            <Badge label={l.status} cls={l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} />
                          </td>
                          <td className="px-5 py-3"><Badge label={sig.label} cls={sig.cls} /></td>
                          <td className="px-5 py-3 text-gray-500 text-xs">
                            {fmt(l.startDate)} – {fmt(l.endDate)}<br />
                            <span className="text-gray-400">{space?.unitNumber ?? ''}</span>
                          </td>
                          <td className="px-5 py-3 font-medium text-gray-900">{fmtAud(l.monthlyRent)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Section>

            {/* ── Invoices ── */}
            <Section title="Invoices" action={
              <button
                onClick={() => setShowInvoiceForm(true)}
                className="flex items-center gap-1 text-xs bg-black text-white px-3 py-1.5 rounded hover:bg-gray-800 font-medium"
              >
                <Plus size={12} /> Add Invoice
              </button>
            }>
              {tenantInvoices.length === 0 ? (
                <p className="px-5 py-5 text-sm text-gray-400">No invoices.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Number', 'Status', 'Sent', 'Issue Date', 'Due Date', 'Period', 'Amount'].map((h) => (
                        <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenantInvoices.map((inv) => {
                      const meta = INV_STATUS[inv.status] ?? { label: inv.status, cls: 'bg-gray-100 text-gray-600' }
                      const sub = (inv.lineItems ?? []).reduce((s, l) => s + Math.round(l.unitPrice * l.qty * (1 - (l.discountPct ?? 0) / 100) * 100) / 100, 0)
                      return (
                        <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => onSelectInvoice?.(inv)}>
                          <td className="px-5 py-3 font-medium text-gray-900">{inv.number}</td>
                          <td className="px-5 py-3"><Badge label={meta.label} cls={meta.cls} /></td>
                          <td className="px-5 py-3">
                            <Badge label={inv.sentStatus === 'sent' ? 'Sent' : 'Not Sent'} cls={inv.sentStatus === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} />
                          </td>
                          <td className="px-5 py-3 text-gray-500">{fmt(inv.issueDate)}</td>
                          <td className="px-5 py-3 text-gray-500">{fmt(inv.dueDate)}</td>
                          <td className="px-5 py-3 text-gray-400 text-xs">
                            {inv.periodStart ? `${fmt(inv.periodStart)} – ${fmt(inv.periodEnd)}` : inv.invoiceType === 'deposit' ? 'Deposit' : '—'}
                          </td>
                          <td className="px-5 py-3 font-medium text-gray-900">{fmtAud(sub * (1 + taxRate))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Section>

            {/* ── Portal Access ── */}
            <PortalAccessSection email={tenant.email} />

            {/* ── Documents ── */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <DocumentsPanel tenantId={tenant.id} title="Documents" />
            </div>

            {/* ── Portal Messages ── */}
            <PortalMessagesAdmin tenantId={tenant.id} />

          </div>
        </div>
      </div>
    </div>

    {showInvoiceForm && (() => {
      // Pre-fill uninvoiced deposits as line items
      const tenantInvoicesNow = invoices.filter((inv) => inv.tenantId === tenant.id)
      const depositLines = tenantLeases
        .filter((l) => ['manually_signed', 'e_signed'].includes(l.signatureStatus))
        .filter((l) => {
          const bond = l.items?.[0]?.deposit ?? l.bondAmount ?? 0
          if (!bond) return false
          return !tenantInvoicesNow.some((inv) => inv.leaseId === l.id && inv.invoiceType === 'deposit' && inv.status !== 'voided')
        })
        .map((l) => {
          const bond = l.items?.[0]?.deposit ?? l.bondAmount ?? 0
          const space = spaces.find((s) => s.id === l.spaceId)
          return {
            id: `li${Date.now()}_${l.id}`,
            description: `Security Deposit — ${space?.unitNumber ?? l.spaceId} (${l.contractNumber ?? `CON-${l.id.slice(-3).toUpperCase()}`})`,
            revenueAccount: 'Security Deposit',
            unitPrice: bond,
            qty: 1,
            discountPct: 0,
            vatExempt: true,
          }
        })
      return (
        <InvoiceForm
          invoices={invoices}
          tenants={[tenant]}
          leases={leases}
          spaces={spaces}
          settings={settings}
          taxRatePct={settings?.billingRules?.taxRate ?? 10}
          defaultTenantId={tenant.id}
          defaultLineItems={depositLines.length > 0 ? depositLines : null}
          defaultInvoiceType={depositLines.length > 0 ? 'deposit' : null}
          onSave={(data) => {
            onAddInvoice?.(data)
            setShowInvoiceForm(false)
          }}
          onClose={() => setShowInvoiceForm(false)}
        />
      )
    })()}
    </>
  )
}

function Row({ label, icon, children }) {
  return (
    <div className="flex items-start gap-2">
      {icon ? <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span> : <span className="text-gray-400 uppercase font-semibold w-14 shrink-0 text-[10px] mt-0.5">{label}</span>}
      <span>{children}</span>
    </div>
  )
}

function PortalSidebarStatus({ email }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!email) return
    fetch(`/api/portal/status?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => setStatus(d.status))
      .catch(() => setStatus(null))
  }, [email])

  if (!status || status === 'not_invited') return null

  return (
    <div className="mt-5 pt-4 border-t border-gray-100">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <MessageSquare size={10} /> Portal Access
      </div>
      {status === 'active' ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Active Member
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
          Invited
        </span>
      )}
    </div>
  )
}

function PortalAccessSection({ email }) {
  const [portalStatus, setPortalStatus] = useState(null) // null | 'not_invited' | 'invited' | 'active'
  const [inviteStatus, setInviteStatus] = useState('idle') // idle | sending | sent | error

  useEffect(() => {
    if (!email) return
    fetch(`/api/portal/status?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => setPortalStatus(d.status))
      .catch(() => setPortalStatus('not_invited'))
  }, [email])

  async function sendInvite() {
    setInviteStatus('sending')
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setInviteStatus('sent')
        setPortalStatus('invited')
      } else {
        setInviteStatus('error')
      }
    } catch {
      setInviteStatus('error')
    }
    setTimeout(() => setInviteStatus('idle'), 4000)
  }

  const badge = {
    active:       <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Active Member</span>,
    invited:      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">Invited — Pending</span>,
    not_invited:  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Not Invited</span>,
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <MessageSquare size={13} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">Portal Access</span>
      </div>
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 mb-1.5">members.hexahub.com.au</div>
          {portalStatus === null
            ? <span className="text-xs text-gray-400">Checking…</span>
            : badge[portalStatus]}
          {portalStatus === 'active' && (
            <p className="text-xs text-gray-400 mt-1.5">Member has signed in to the portal.</p>
          )}
          {portalStatus === 'invited' && (
            <p className="text-xs text-gray-400 mt-1.5">Invite sent — awaiting first login.</p>
          )}
          {portalStatus === 'not_invited' && (
            <p className="text-xs text-gray-400 mt-1.5">This member has not been invited yet.</p>
          )}
        </div>

        {/* Only show invite/resend if not yet active */}
        {portalStatus !== 'active' && portalStatus !== null && (
          <button
            onClick={sendInvite}
            disabled={inviteStatus === 'sending' || !email}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
          >
            {inviteStatus === 'sent'    ? '✓ Sent!'
             : inviteStatus === 'error' ? 'Failed — retry'
             : inviteStatus === 'sending' ? 'Sending…'
             : portalStatus === 'invited' ? 'Resend Invite'
             : 'Invite to Portal'}
          </button>
        )}
      </div>
    </div>
  )
}

function PortalMessagesAdmin({ tenantId }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!open) return
    load()
    const channel = supabase
      .channel(`portal_msgs_admin_${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_messages' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [open, tenantId])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function load() {
    const { data } = await supabase.from('portal_messages').select('data')
    const all = (data ?? []).map(r => r.data).filter(m => m.tenantId === tenantId)
    all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    setMessages(all)
    // mark unread (from tenant) as read by admin
    for (const m of all.filter(m => m.sender === 'tenant' && !m.readByAdmin)) {
      supabase.from('portal_messages').upsert({ id: m.id, data: { ...m, readByAdmin: true } })
    }
  }

  async function sendReply(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId,
      sender: 'admin',
      content: text.trim(),
      timestamp: new Date().toISOString(),
      readByAdmin: true,
      readByTenant: false,
    }
    await supabase.from('portal_messages').insert({ id: msg.id, data: msg })
    setText('')
    setSending(false)
  }

  const unread = messages.filter(m => m.sender === 'tenant' && !m.readByAdmin).length

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <MessageSquare size={15} className="text-gray-400" />
          Portal Messages
          {unread > 0 && !open && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{open ? 'Collapse' : 'Expand'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {/* Thread */}
          <div className="h-64 overflow-y-auto space-y-3 mb-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                No messages yet.
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                  msg.sender === 'admin'
                    ? 'bg-black text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap text-xs">{msg.content}</p>
                  <p className="text-xs mt-1 opacity-60">
                    {msg.sender === 'admin' ? 'You' : 'Member'} ·{' '}
                    {(() => { try { return format(parseISO(msg.timestamp), 'dd/MM h:mm a') } catch { return '' } })()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {/* Reply form */}
          <form onSubmit={sendReply} className="flex gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Reply to member…"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="bg-black text-white px-3 py-2 rounded hover:bg-gray-800 disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
