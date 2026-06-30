import { useOutletContext } from 'react-router-dom'
import { format, parseISO } from 'date-fns'

// Memberships, organised by type. Columns are derived purely from the contracts
// (leases) members have signed — nothing is added here, it's a read view.
const TYPES = ['Virtual Office', 'Flexible Desk', 'Dedicated Desk', 'Private Office']

const COL_ACCENT = {
  'Virtual Office': 'border-t-blue-500',
  'Flexible Desk': 'border-t-amber-500',
  'Dedicated Desk': 'border-t-emerald-500',
  'Private Office': 'border-t-gray-800',
}

// Classify a membership into one of the four types from its plan / space.
function membershipType(lease, space) {
  const text = `${lease.planName || ''} ${space?.unitNumber || ''} ${space?.attributes || ''} ${space?.type || ''}`.toLowerCase()
  if (text.includes('virtual')) return 'Virtual Office'
  if (text.includes('flex')) return 'Flexible Desk'
  if (text.includes('dedicated')) return 'Dedicated Desk'
  return 'Private Office' // offices / suites / pax
}

function period(l) {
  const s = l.startDate ? format(parseISO(l.startDate), 'd MMM yyyy') : '—'
  const e = l.endDate ? format(parseISO(l.endDate), 'd MMM yyyy') : 'Month-to-month'
  return `${s} – ${e}`
}

export default function Memberships() {
  const { leases = [], tenants = [], spaces = [] } = useOutletContext()
  const company = (id) => tenants.find((t) => t.id === id)
  const space = (id) => spaces.find((s) => s.id === id)

  // Build membership rows from leases (exclude meeting-room hires).
  const rows = leases
    .map((l) => {
      const sp = space(l.spaceId)
      return { ...l, sp, type: membershipType(l, sp), companyName: company(l.tenantId)?.businessName ?? l.memberName ?? '—' }
    })
    .filter((r) => r.sp?.type !== 'meeting')

  const byType = Object.fromEntries(TYPES.map((t) => [t, rows.filter((r) => r.type === t)]))
  const total = rows.length

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Memberships</h1>
        <span className="text-sm text-gray-500">{total} active membership{total !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-sm text-gray-500 mb-6">By type — populated automatically from the contracts members have signed.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {TYPES.map((type) => {
          const items = byType[type]
          return (
            <div key={type} className={`bg-gray-50 border border-gray-200 border-t-2 ${COL_ACCENT[type]} rounded-md`}>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-semibold text-gray-900 text-sm">{type}</span>
                <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">{items.length}</span>
              </div>
              <div className="px-3 pb-3 space-y-2 min-h-[120px]">
                {items.length === 0 && (
                  <div className="text-xs text-gray-300 text-center py-8">No members on this membership.</div>
                )}
                {items.map((r) => (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-md p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-gray-900 text-sm leading-tight">{r.companyName}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${r.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{r.status || 'active'}</span>
                    </div>
                    {r.sp?.unitNumber && <div className="text-xs text-gray-500 mt-0.5">{r.sp.unitNumber}{r.monthlyRent != null ? ` · A$${Number(r.monthlyRent).toLocaleString('en-AU')}/mo` : ''}</div>}
                    <div className="text-[11px] text-gray-400 mt-1.5">{period(r)}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {total === 0 && (
        <p className="text-sm text-gray-400 mt-8 text-center">
          No memberships yet — they appear here automatically when a member signs a contract for a space.
        </p>
      )}
    </div>
  )
}
