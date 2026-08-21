import { format, parseISO } from 'date-fns'
import { buildPaymentSchedule } from './paymentSchedule.js'

// Single monthly-invoice builder shared by the in-app Bill Run
// (src/components/Billing.jsx) and the auto-billing cron (api/auto-billing.js),
// so both engines price a lease identically: step pricing and the
// office/parking split via buildPaymentSchedule, DST-safe proration,
// rent-free skips, prepaid skips, and month-key dedup.
//
// Returns { invoice, reason }. invoice is null when there is nothing to bill;
// reason is one of: 'no-dates' | 'not-started' | 'ended' | 'already-billed' |
// 'prepaid' | 'rent-free' | 'zero-amount'. The caller assigns id + number
// (numbering schemes differ per engine) and may override source/sentStatus.
export function buildMonthlyInvoiceForLease(lease, monthStart, { invoices = [], spaces = [], settings = {}, source = 'bill-run' } = {}) {
  if (!lease?.startDate) return { invoice: null, reason: 'no-dates' }
  // No end date = month-to-month, open-ended: bills every month until a
  // notice/termination caps it.
  const OPEN_ENDED = '9999-12-31'
  const month = monthStart instanceof Date ? monthStart : parseISO(String(monthStart))
  const mStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const mEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const key = format(mStart, 'yyyy-MM')
  const fmt = (d) => format(d, 'yyyy-MM-dd')

  const start = parseISO(lease.startDate)
  // A served notice / scheduled cancellation caps billing at the vacate date —
  // the contract may still be "active" until then, but nothing past it is
  // ever invoiced and the final month is prorated to it.
  const capISO = [
    lease.endDate,
    lease.noticeGiven ? lease.vacateDate : null,
    lease.terminationScheduledFor,
  ].filter(Boolean).sort()[0] ?? OPEN_ENDED
  const end = parseISO(capISO)
  if (start > mEnd) return { invoice: null, reason: 'not-started' }
  if (end < mStart) return { invoice: null, reason: 'ended' }

  // Dedup on the month KEY, not an exact periodStart match — a prorated
  // invoice's periodStart lands mid-month and must still block a re-bill.
  // A combined invoice (see combineTenantInvoices) covers several contracts, so
  // check its leaseIds too or every contract but the first would re-bill.
  const already = invoices.some((i) =>
    invoiceCoversLease(i, lease.id) && i.status !== 'voided' &&
    !['deposit', 'bond_refund'].includes(i.invoiceType) &&
    String(i.periodStart || '').startsWith(key)
  )
  if (already) return { invoice: null, reason: 'already-billed' }

  // Prepaid membership covering this month (OfficeRND-migrated prepayments).
  if (lease.paidInFull && lease.paidUntil && String(lease.paidUntil).slice(0, 7) >= key) {
    return { invoice: null, reason: 'prepaid' }
  }

  const schedule = buildPaymentSchedule(lease, settings)
  const row = schedule?.rows.find((r) => r.key === key)
  if (!row) return { invoice: null, reason: 'not-started' }
  if (row.free) return { invoice: null, reason: 'rent-free' }
  if (row.total <= 0) return { invoice: null, reason: 'zero-amount' }

  const periodStart = start > mStart ? start : mStart
  const periodEnd = end < mEnd ? end : mEnd
  const isProrated = fmt(periodStart) !== fmt(mStart) || fmt(periodEnd) !== fmt(mEnd)

  // Scale the schedule's amounts when the cap truncates this month: the
  // payment schedule reflects the CONTRACT term, the cap reflects the
  // cancellation. (Math.round day counts — DST months have a 23/25h day.)
  const round2 = (n) => Math.round(n * 100) / 100
  const dayCount = (a, b) => Math.round((b - a) / 86400000) + 1
  const contractEnd = parseISO(lease.endDate || OPEN_ENDED)
  const schedTo = contractEnd < mEnd ? contractEnd : mEnd
  let officeAmt = row.office
  let servicesAmt = row.services
  if (periodEnd < schedTo && schedTo >= periodStart) {
    const factor = Math.max(0, dayCount(periodStart, periodEnd) / dayCount(periodStart, schedTo))
    officeAmt = round2(officeAmt * factor)
    servicesAmt = round2(servicesAmt * factor)
  }
  if (officeAmt + servicesAmt <= 0) return { invoice: null, reason: 'zero-amount' }
  const dayMon = (d, withYear) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
  const periodLabel = `${dayMon(periodStart)} – ${dayMon(periodEnd, true)}${isProrated ? ' (prorated)' : ''}`

  // The payment schedule already nets off step discounts (stepMonthly in
  // leasePricing.js), so the invoice line must NOT apply a discount again —
  // unitPrice below is the final charged amount.
  const discountPct = 0
  const spaceById = Object.fromEntries((spaces ?? []).map((s) => [s.id, s]))
  const itemIds = (lease.items?.length ? lease.items : [{ spaceId: lease.spaceId }]).map((it) => it.spaceId)
  const isParking = (id) => /_park_|parking/i.test(String(id ?? ''))
  const unitNames = (ids) => ids.map((id) => spaceById[id]?.unitNumber).filter(Boolean).join(', ')
  // A virtual office now carries a space (its allocated suite), so name the
  // membership as well — "Suite 429" alone reads like a private office.
  const isVirtualLease = /virtual/i.test(`${lease.membershipType ?? ''} ${lease.documentType ?? ''}`)
  const unitsNamed = unitNames(itemIds.filter((id) => !isParking(id)))
  const officeUnits = (isVirtualLease && unitsNamed ? `Virtual Office ${unitsNamed}` : unitsNamed) ||
    lease.resource || lease.contractNumber || 'Membership'
  const parkingUnits = unitNames(itemIds.filter(isParking))

  const lineItems = []
  if (officeAmt > 0) {
    lineItems.push({
      id: `li_${lease.id}_${key}_m`,
      description: `${officeUnits} · ${periodLabel}`,
      revenueAccount: 'Membership Fees',
      unitPrice: officeAmt, qty: 1, discountPct,
    })
  }
  if (servicesAmt > 0) {
    lineItems.push({
      id: `li_${lease.id}_${key}_p`,
      description: `${parkingUnits ? `Parking ${parkingUnits}` : 'Parking'} · ${periodLabel}`,
      revenueAccount: 'Parking',
      unitPrice: servicesAmt, qty: 1, discountPct,
    })
  }

  const dueDays = settings?.invoicing?.dueDateDays ?? 14
  const due = new Date(mStart); due.setDate(due.getDate() + dueDays)

  return {
    invoice: {
      tenantId: lease.tenantId,
      leaseId: lease.id,
      status: 'pending',
      sentStatus: 'not_sent',
      source,
      issueDate: fmt(mStart),
      dueDate: fmt(due),
      periodStart: fmt(periodStart),
      periodEnd: fmt(periodEnd),
      reference: '',
      paymentMethod: '',
      discountPct: 0,
      vatEnabled: true,
      xeroSync: false,
      isProrated,
      lineItems,
      payments: [],
      comments: [],
      creditNoteForId: null,
    },
    reason: null,
  }
}

// A merged invoice carries every contract it covers in `leaseIds` while keeping
// a single `leaseId` for compatibility — so anything asking "is this contract
// billed / invoiced?" has to read both, or a folded contract looks unbilled and
// gets charged twice.
export function invoiceCoversLease(invoice, leaseId) {
  if (!invoice || !leaseId) return false
  return invoice.leaseId === leaseId || (invoice.leaseIds ?? []).includes(leaseId)
}

// Car bays are held on their own contract (CON-nnn-PARK), which on its own
// would bill the member twice a month — once for the suite, once for the bay.
// An invoice whose every line is parking came from one of those.
const isParkingOnly = (inv) =>
  (inv?.lineItems?.length ?? 0) > 0 && inv.lineItems.every((li) => li.revenueAccount === 'Parking')

// Members holding more than one contract normally get one invoice per contract.
// Two rules fold them together instead:
//   · parking always rides on the rent invoice — a member with a suite and a
//     bay gets one bill with a rent line and a parking line, never two bills;
//   · `combineInvoices` on the company profile puts EVERY contract on one
//     invoice, a line each — e.g. Wehome, who licences Suite 7 and Suite 24.
//
// Takes the invoices a bill run just built (in lease order) and returns the list
// to actually create — before numbering, saving or emailing, so a merged bill
// takes one number and sends one email. Rent leads: the merged invoice keeps the
// rent contract's leaseId and prints the rent line above parking. Every folded
// contract lands in `leaseIds`, which the dedup above reads, so a second run
// doesn't re-bill them.
export function combineTenantInvoices(built = [], tenants = []) {
  const combining = new Set(tenants.filter((t) => t?.combineInvoices).map((t) => t.id))

  const byTenant = new Map()
  for (const inv of built) byTenant.set(inv.tenantId, [...(byTenant.get(inv.tenantId) ?? []), inv])

  const foldInto = new Map()  // base invoice -> the invoices merging into it
  const folded = new Set()
  for (const [tenantId, list] of byTenant) {
    if (list.length < 2) continue
    const rent = list.filter((i) => !isParkingOnly(i))
    const parking = list.filter(isParkingOnly)
    // Without the combine flag only parking rides along, and only when there is
    // a rent invoice to ride on — a parking-only member still gets their own.
    const group = combining.has(tenantId)
      ? list
      : (rent.length && parking.length ? [rent[0], ...parking] : [])
    if (group.length < 2) continue
    const base = group.find((i) => !isParkingOnly(i)) ?? group[0]
    foldInto.set(base, group.filter((i) => i !== base))
    for (const inv of group) if (inv !== base) folded.add(inv)
  }
  if (!folded.size) return built

  const out = []
  for (const inv of built) {
    if (folded.has(inv)) continue
    const extras = foldInto.get(inv)
    if (!extras) { out.push(inv); continue }
    const merged = { ...inv, leaseIds: [inv.leaseId] }
    for (const other of extras) {
      merged.lineItems = [...(merged.lineItems ?? []), ...(other.lineItems ?? [])]
      merged.leaseIds.push(other.leaseId)
      // Widest period across the contracts, earliest due date, prorated if any is.
      if (other.periodStart < merged.periodStart) merged.periodStart = other.periodStart
      if (other.periodEnd > merged.periodEnd) merged.periodEnd = other.periodEnd
      if (other.dueDate < merged.dueDate) merged.dueDate = other.dueDate
      merged.isProrated = merged.isProrated || other.isProrated
    }
    out.push(merged)
  }
  return out
}

// Net subtotal of an invoice's line items after line-level discounts.
export function lineItemsSubtotal(lineItems = []) {
  return Math.round(lineItems.reduce((s, li) =>
    s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0) * 100) / 100
}
