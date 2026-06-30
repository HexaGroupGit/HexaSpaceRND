import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { jsPDF } from 'jspdf'
import { Building2, FileText, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

function fmt(dateStr) {
  try { return format(parseISO(dateStr), 'dd/MM/yyyy') } catch { return '—' }
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm text-gray-900">{value || '—'}</div>
    </div>
  )
}

function downloadAgreementPDF(lease, tenant) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 20

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

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text('Licence Agreement Summary', M, 46)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(lease.contractNumber ?? 'Contract', M, 54)

  let y = 68
  const row = (label, value, bold = false) => {
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(label, M, y)
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(String(value ?? '—'), M + 50, y)
    doc.setFont('helvetica', 'normal')
    y += 7
  }

  doc.setFillColor(245, 245, 245)
  doc.rect(M, y - 4, W - M * 2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text('TENANT DETAILS', M + 2, y + 1)
  y += 9

  row('Business Name', tenant.businessName)
  row('Contact', tenant.contactName)
  row('ABN', tenant.abn)
  row('Email', tenant.email)
  y += 4

  doc.setFillColor(245, 245, 245)
  doc.rect(M, y - 4, W - M * 2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text('CONTRACT DETAILS', M + 2, y + 1)
  doc.setFont('helvetica', 'normal')
  y += 9

  row('Contract Number', lease.contractNumber)
  row('Document Type', lease.documentType ?? 'Licence Agreement')
  row('Status', (lease.status ?? '').toUpperCase(), true)
  row('Signature', lease.signatureStatus === 'e_signed' ? 'E-Signed' : lease.signatureStatus === 'manually_signed' ? 'Manually Signed' : 'Not Signed')
  row('Start Date', fmt(lease.startDate))
  row('End Date', fmt(lease.endDate))
  row('Monthly Rent', `A$${Number(lease.monthlyRent ?? 0).toLocaleString('en-AU')} + GST`)
  row('Bond / Deposit', `A$${Number(lease.bondAmount ?? 0).toLocaleString('en-AU')}`)
  row('Notice Period', `${lease.noticePeriodMonths ?? 2} months`)
  y += 8

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.setFont('helvetica', 'italic')
  const note = 'This document is a summary only. For a copy of the full signed agreement, please contact info@hexahub.com.au'
  const lines = doc.splitTextToSize(note, W - M * 2)
  doc.text(lines, M, y)

  doc.setFillColor(0, 0, 0)
  doc.rect(0, 287, W, 10, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  doc.text('HexaHub Pty Ltd  ·  build locally, scale sustainably  ·  hexahub.com.au', W / 2, 293, { align: 'center' })

  doc.save(`${lease.contractNumber ?? 'agreement'}.pdf`)
}

function ChangePasswordSection() {
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'success'|'error', text }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) return setMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
    if (form.password !== form.confirm) return setMsg({ type: 'error', text: 'Passwords do not match.' })
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: form.password })
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Password updated successfully.' }); setForm({ password: '', confirm: '' }) }
    setSaving(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900">
        <Lock size={15} className="text-gray-400" />
        Change Password
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4 max-w-sm">
        {msg && (
          <div className={`text-sm rounded px-3 py-2 ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {msg.text}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
          <input
            type="password"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            required
            placeholder="Repeat your password"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white text-sm font-semibold px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}

export default function PortalAccount({ tenant, leases }) {
  const activeLeases = leases.filter(l => l.status === 'active')
  const pastLeases = leases.filter(l => l.status !== 'active')

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Account</h1>

      {/* Company info */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900">
          <Building2 size={15} className="text-gray-400" />
          Company Information
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-5">
          <Field label="Business Name" value={tenant.businessName} />
          <Field label="ABN" value={tenant.abn} />
          <Field label="Contact Name" value={tenant.contactName} />
          <Field label="Industry" value={tenant.industry} />
          <Field label="Email" value={tenant.email} />
          <Field label="Phone" value={tenant.phone} />
        </div>
        <div className="px-5 pb-4 border-t border-gray-50">
          <p className="text-xs text-gray-400 mt-4">
            To update your company details, please contact{' '}
            <a href="mailto:info@hexahub.com.au" className="text-gray-600 hover:underline">
              info@hexahub.com.au
            </a>
          </p>
        </div>
      </div>

      {/* Active contracts */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900">
          <FileText size={15} className="text-gray-400" />
          Active Agreements
        </div>
        {activeLeases.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-400 text-center">No active agreements.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activeLeases.map(lease => (
              <div key={lease.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900 text-sm">{lease.contractNumber ?? 'Contract'}</span>
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-medium">Active</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="text-gray-400 mb-0.5">Start Date</div>
                        <div className="text-gray-900">{fmt(lease.startDate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-0.5">End Date</div>
                        <div className="text-gray-900">{fmt(lease.endDate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-0.5">Monthly Rent</div>
                        <div className="text-gray-900 font-semibold">
                          A${Number(lease.monthlyRent ?? 0).toLocaleString('en-AU')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadAgreementPDF(lease, tenant)}
                    className="shrink-0 text-xs font-medium px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 flex items-center gap-1.5"
                  >
                    <FileText size={12} /> Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past contracts */}
      {pastLeases.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900">
            <FileText size={15} className="text-gray-400" />
            Past Agreements
          </div>
          <div className="divide-y divide-gray-100">
            {pastLeases.map(lease => (
              <div key={lease.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">{lease.contractNumber ?? 'Contract'}</div>
                  <div className="text-xs text-gray-400">{fmt(lease.startDate)} – {fmt(lease.endDate)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 capitalize border border-gray-200 px-2 py-0.5 rounded">{lease.status}</span>
                  <button
                    onClick={() => downloadAgreementPDF(lease, tenant)}
                    className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
                  >
                    <FileText size={12} /> Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change password */}
      <ChangePasswordSection />
    </div>
  )
}
