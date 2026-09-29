// Shared billing display helpers — turn an invoice's lease/space into the labels
// shown on invoices (location + line description). Hexa Space is at Box Hill on
// Levels 2, 4 and 5, so invoices read e.g. "Hexa Space · Level 2" and line items
// "Level 2 Suite 14 · 1 Jun – 30 Jun 2026".
//
// Source of truth is the LEASE (it carries `resource`/`planName` = the unit and
// `level` = the floor), refined by the linked space for a precise floor. This
// keeps working even where a lease has no space link.

const FLOORS = { l2: 'Level 2', l3: 'Level 3', l4: 'Level 4', l5: 'Level 5' }

export function floorName(floor) {
  return FLOORS[String(floor ?? '').toLowerCase()] || ''
}

const isVirtual = (l) => /virtual/i.test(l?.membershipType || '')
const isOffice = (l) => /office/i.test(l?.membershipType || '')

export function invoiceLease(inv, leases = []) {
  // Never match on a missing leaseId. `find(l => l.id === undefined)` returns
  // the first lease whose OWN id is missing, so every invoice with no leaseId
  // resolved to the same unrelated contract — and since lineDescription renders
  // the rent line from that lease's suite, 1039 historical invoices displayed
  // another member's suite number (all of them "Level 4 Suite 426").
  if (!inv?.leaseId) return null
  return leases.find((l) => l.id === inv.leaseId) || null
}

/** The space an invoice is for: invoice.spaceId, else via its lease. */
export function invoiceSpace(inv, leases = [], spaces = []) {
  if (!inv) return null
  if (inv.spaceId) return spaces.find((s) => s.id === inv.spaceId) || null
  const lease = invoiceLease(inv, leases)
  return lease?.spaceId ? spaces.find((s) => s.id === lease.spaceId) || null : null
}

/** Floor label — precise space floor for real units; the lease's stated level for
 * virtual offices (whose space is a shared placeholder) and as a fallback. */
export function floorLabelFor(lease, space) {
  const level = (lease?.level || '').trim()
  const sf = floorName(space?.floor)
  return isVirtual(lease) ? level || sf : sf || level
}

/** Unit/suite name — clean space name where linked; the lease's own resource for
 * virtual offices; numeric private-office resources ("10") become "Office 10". */
export function unitNameFor(lease, space) {
  const r = (lease?.resource || lease?.planName || '').trim()
  if (isVirtual(lease)) return r || space?.unitNumber || ''
  if (/^\d+$/.test(r) && isOffice(lease)) return `Office ${r}`
  return space?.unitNumber || r || ''
}

/** "Hexa Space · Level 4" when the floor is known, else "Hexa Space". */
export function locationLabel(lease, space) {
  const fl = floorLabelFor(lease, space)
  return fl ? `Hexa Space · ${fl}` : 'Hexa Space'
}

/** Description prefix: "Virtual Office" for virtual plans, else the floor. */
export function descPrefix(lease, space) {
  return isVirtual(lease) ? 'Virtual Office' : floorLabelFor(lease, space)
}

/** "1 Jun – 30 Jun 2026" from ISO date strings. */
export function periodLabel(start, end) {
  if (!start || !end) return ''
  const opt = { day: 'numeric', month: 'short' }
  const s = new Date(start).toLocaleDateString('en-AU', opt)
  const e = new Date(end).toLocaleDateString('en-AU', { ...opt, year: 'numeric' })
  return `${s} – ${e}`
}

// "Level 2 Suite 14 · 1 Jun – 30 Jun 2026" — or, for a virtual office,
// "Virtual Office Suite 403 · 1 Jul – 31 Jul 2026".
export function suiteDescription(lease, space, inv) {
  const unit = unitNameFor(lease, space)
  if (!unit) return ''
  const prefix = descPrefix(lease, space)
  const per = periodLabel(inv?.periodStart, inv?.periodEnd)
  return `${prefix ? prefix + ' ' : ''}${unit}${per ? ` · ${per}` : ''}`
}

/**
 * Description to display for a line item. Reformats the recurring rent line
 * ("Membership Fees") to the Level/Suite/period format so that editing an
 * invoice's period rewrites its rent line; leaves deposits and other lines (or
 * lines with no resolvable unit) as their stored text.
 *
 * A line whose text someone TYPED is never reformatted. Without that check the
 * derivation silently discarded the edit — and only here: the server-side PDF
 * (api/_invoicePdf.js) and the Stripe checkout line read `description` straight
 * from the record, so an edited line showed the typed text on the emailed
 * invoice and the old derived text on screen. They now agree.
 */
export function lineDescription(line, lease, space, inv) {
  if (line?.revenueAccount === 'Membership Fees' && !line?.descriptionEdited) {
    const d = suiteDescription(lease, space, inv)
    if (d) return d
  }
  return line?.description ?? ''
}

// ── Invoice money ────────────────────────────────────────────────────────────
// Lives here so the Billing table, the dashboard and the assistant briefing all
// price an invoice the same way. GST is on by default (vatEnabled !== false);
// each line rounds to cents BEFORE summing, matching what the PDF prints.

export function calcInvoiceTotal(invoice, taxRate = 0.1) {
  const sub = (invoice?.lineItems ?? []).reduce((s, l) => {
    return s + Math.round(l.unitPrice * l.qty * (1 - (l.discountPct ?? 0) / 100) * 100) / 100
  }, 0)
  const disc = Math.round(sub * ((invoice?.discountPct ?? 0) / 100) * 100) / 100
  const taxable = sub - disc
  const gst = invoice?.vatEnabled !== false ? Math.round(taxable * taxRate * 100) / 100 : 0
  return taxable + gst
}

/** What's still owing — total less payments, never negative. */
export function calcAmountDue(invoice, taxRate = 0.1) {
  const paid = (invoice?.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  return Math.max(0, calcInvoiceTotal(invoice, taxRate) - paid)
}
