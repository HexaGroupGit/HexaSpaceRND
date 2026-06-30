import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Receipt, FileText, ArrowRight, Calendar } from 'lucide-react'

function calcTotal(invoice) {
  let taxable = 0
  let exempt = 0
  for (const li of invoice.lineItems ?? []) {
    const price = (li.unitPrice ?? 0) * (li.qty ?? 1)
    const disc = price * ((li.discountPct ?? 0) / 100)
    if (li.vatExempt) exempt += price - disc
    else taxable += price - disc
  }
  const gst = invoice.vatEnabled ? taxable * 0.1 : 0
  return taxable + exempt + gst
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

function fmt(dateStr) {
  try { return format(parseISO(dateStr), 'dd/MM/yyyy') } catch { return '—' }
}

export default function PortalDashboard({ tenant, invoices, leases }) {
  const sorted = [...invoices].sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))
  const recent = sorted.slice(0, 4)
  const activeLeases = leases.filter(l => l.status === 'active')
  const overdueCount = invoices.filter(i => i.status === 'overdue').length
  const pendingCount = invoices.filter(i => i.status === 'pending').length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Hero */}
      <div className="bg-black text-white rounded-xl px-8 py-10">
        <p className="text-sm text-gray-400 mb-1">Welcome back</p>
        <h1 className="text-2xl font-bold">{tenant.businessName}</h1>
        <p className="text-gray-500 text-sm mt-2">build locally, scale sustainably</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Active Contracts</div>
          <div className="text-3xl font-black text-gray-900">{activeLeases.length}</div>
          {activeLeases[0]?.endDate && (
            <div className="text-xs text-gray-400 mt-1">
              Expires {fmt(activeLeases[0].endDate)}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Pending</div>
          <div className="text-3xl font-black text-gray-900">{pendingCount}</div>
          <div className="text-xs text-gray-400 mt-1">invoices awaiting payment</div>
        </div>
        <div className={`rounded-lg border p-4 ${overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Overdue</div>
          <div className={`text-3xl font-black ${overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {overdueCount}
          </div>
          {overdueCount > 0 && (
            <Link to="/billing" className="text-xs text-red-600 hover:underline mt-1 block">
              View invoices →
            </Link>
          )}
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Receipt size={15} className="text-gray-400" />
            Recent Invoices
          </div>
          <Link to="/billing" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-400 text-center">No invoices yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{inv.number}</div>
                  <div className="text-xs text-gray-400">
                    Due {inv.dueDate ? fmt(inv.dueDate) : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    A${calcTotal(inv).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active contracts */}
      {activeLeases.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900">
            <FileText size={15} className="text-gray-400" />
            Active Contracts
          </div>
          <div className="divide-y divide-gray-100">
            {activeLeases.map(lease => (
              <div key={lease.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{lease.contractNumber ?? lease.id}</div>
                  <div className="text-xs text-gray-400">
                    {lease.startDate ? fmt(lease.startDate) : '—'} → {lease.endDate ? fmt(lease.endDate) : 'ongoing'}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  A${Number(lease.monthlyRent ?? 0).toLocaleString('en-AU')}/mo
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/messages" className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors">
          <div className="text-sm font-semibold text-gray-900 mb-1">Send a Message</div>
          <div className="text-xs text-gray-400">Contact the HexaHub team</div>
        </Link>
        <Link to="/events" className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
            <Calendar size={14} />
            Upcoming Events
          </div>
          <div className="text-xs text-gray-400">Community events &amp; updates</div>
        </Link>
      </div>
    </div>
  )
}
