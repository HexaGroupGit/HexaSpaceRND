import { useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import TenantProfile from './TenantProfile.jsx'

const EMPTY_FORM = {
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  abn: '',
  industry: '',
  country: 'Australia',
}

export default function Tenants() {
  const { tenants, addTenant, updateTenant, deleteTenant, leases, invoices, spaces, settings, addInvoice } = useOutletContext()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = tenants.filter((t) =>
    [t.businessName, t.contactName, t.email, t.industry]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(tenant) {
    setEditId(tenant.id)
    setForm({
      businessName: tenant.businessName ?? '',
      contactName: tenant.contactName ?? '',
      email: tenant.email ?? '',
      phone: tenant.phone ?? '',
      abn: tenant.abn ?? '',
      industry: tenant.industry ?? '',
      country: tenant.country ?? 'Australia',
    })
    setShowForm(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (editId) {
      updateTenant(editId, form)
    } else {
      addTenant(form)
    }
    setShowForm(false)
  }

  function handleDelete(id) {
    if (window.confirm('Delete this tenant? Any associated leases will remain.')) {
      deleteTenant(id)
    }
  }

  if (selectedTenant) {
    return (
      <>
        <TenantProfile
          tenant={selectedTenant}
          leases={leases ?? []}
          invoices={invoices ?? []}
          spaces={spaces ?? []}
          settings={settings}
          onBack={() => setSelectedTenant(null)}
          onEdit={() => openEdit(selectedTenant)}
          onSelectContract={(lease) => navigate('/leases', { state: { openLeaseId: lease.id } })}
          onAddInvoice={(data) => addInvoice({ ...data, tenantId: selectedTenant.id })}
        />
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-md w-full max-w-lg shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Edit Tenant</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={(e) => { handleSubmit(e); setSelectedTenant(tenants.find(t => t.id === editId) ?? selectedTenant) }} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Business Name *</label>
                    <input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
                    <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ABN</label>
                    <input value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
                    <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                    <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">{tenants.length} tenant profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <BulkPortalInviteButton tenants={tenants} />
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={15} /> Add Tenant
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Business Name', 'Contact', 'Email', 'Phone', 'ABN', 'Industry', 'Since', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No tenants found.
                </td>
              </tr>
            )}
            {filtered.map((tenant) => (
              <tr key={tenant.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedTenant(tenant)}>
                <td className="px-4 py-3 font-medium text-gray-900 text-blue-700 hover:underline">{tenant.businessName}</td>
                <td className="px-4 py-3 text-gray-600">{tenant.contactName}</td>
                <td className="px-4 py-3 text-gray-600">{tenant.email}</td>
                <td className="px-4 py-3 text-gray-600">{tenant.phone}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{tenant.abn}</td>
                <td className="px-4 py-3 text-gray-600">{tenant.industry}</td>
                <td className="px-4 py-3 text-gray-500">
                  {tenant.createdAt ? format(parseISO(tenant.createdAt), 'dd/MM/yyyy') : '—'}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEdit(tenant)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(tenant.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {editId ? 'Edit Tenant' : 'Add Tenant'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Business Name *</label>
                  <input
                    required
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ABN</label>
                  <input
                    value={form.abn}
                    onChange={(e) => setForm({ ...form, abn: e.target.value })}
                    placeholder="XX XXX XXX XXX"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
                  <input
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                  <input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800"
                >
                  <Check size={14} />
                  {editId ? 'Save Changes' : 'Add Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function BulkPortalInviteButton({ tenants }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  async function run() {
    const withEmail = tenants.filter(t => t.email)
    if (!withEmail.length) return alert('No tenants have email addresses.')
    if (!window.confirm(
      `Check all ${withEmail.length} tenants and invite any who haven't been invited to the portal yet?`
    )) return

    setRunning(true)
    setResult(null)

    // Check portal status for all tenants in parallel
    const statuses = await Promise.all(
      withEmail.map(async t => {
        try {
          const res = await fetch(`/api/portal/status?email=${encodeURIComponent(t.email)}`)
          const data = await res.json()
          return { tenant: t, status: data.status }
        } catch {
          return { tenant: t, status: 'error' }
        }
      })
    )

    const toInvite = statuses.filter(s => s.status === 'not_invited')
    const invited = [], failed = []

    // Send invites sequentially to avoid rate limiting
    for (const { tenant } of toInvite) {
      try {
        const res = await fetch('/api/auth/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: tenant.email }),
        })
        if (res.ok) invited.push(tenant.businessName)
        else failed.push(tenant.businessName)
      } catch {
        failed.push(tenant.businessName)
      }
    }

    const alreadyActive = statuses.filter(s => s.status === 'active').length
    const alreadyInvited = statuses.filter(s => s.status === 'invited').length

    setResult({ invited, failed, alreadyActive, alreadyInvited })
    setRunning(false)
  }

  return (
    <>
      <button
        onClick={run}
        disabled={running}
        className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {running ? 'Checking…' : '✉ Bulk Portal Invite'}
      </button>

      {result && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 mb-4">Bulk Portal Invite — Done</h3>
            <div className="space-y-3 text-sm">
              {result.invited.length > 0 && (
                <div>
                  <div className="font-medium text-green-700 mb-1">
                    ✓ {result.invited.length} invite{result.invited.length !== 1 ? 's' : ''} sent
                  </div>
                  {result.invited.map(n => (
                    <div key={n} className="text-gray-600 pl-3">{n}</div>
                  ))}
                </div>
              )}
              {result.invited.length === 0 && result.failed.length === 0 && (
                <p className="text-gray-500">No new tenants to invite.</p>
              )}
              {result.alreadyActive > 0 && (
                <div className="text-gray-400">
                  — {result.alreadyActive} already active in portal
                </div>
              )}
              {result.alreadyInvited > 0 && (
                <div className="text-gray-400">
                  — {result.alreadyInvited} already invited (pending)
                </div>
              )}
              {result.failed.length > 0 && (
                <div>
                  <div className="font-medium text-red-600 mb-1">
                    ✗ {result.failed.length} failed
                  </div>
                  {result.failed.map(n => (
                    <div key={n} className="text-red-500 pl-3">{n}</div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setResult(null)}
              className="mt-5 w-full bg-black text-white text-sm font-semibold py-2 rounded hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  )
}
