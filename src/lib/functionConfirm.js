// Shapes shared by every path that secures a function booking.
//
// WHY this file exists: securing the venue happens in two places now. The admin
// hub does it through the store (functionActions.secureVenue); the pay-in-full
// endpoint does it server-side against Supabase, because the money and the
// confirmation have to be one action there. Both must raise the SAME invoice and
// place the SAME calendar holds — a client who pays on the spot must not end up
// with a differently-shaped booking from one whose deposit landed. So the shapes
// live here, as pure builders, and each caller does its own writing.
//
// Pure: no store, no supabase, no ids allocated. Callers supply ids.
import { bufferedWindow, balanceDueDate, bookingSessions, sessionsLabel } from './functionBooking.js'

const today = () => new Date().toISOString().split('T')[0]

/** The fields every function invoice carries, whatever it bills for. */
export function invoiceBaseFor(b) {
  return {
    tenantId: b.tenantId || b.companyId || null,
    source: 'function',
    status: 'pending',
    sentStatus: 'not_sent',
    functionRef: b.ref,
    clientName: b.organisation || b.companyInfo?.businessName || b.name || 'Function client',
    clientEmail: b.email,
    issueDate: today(),
  }
}

/**
 * The ONE invoice that bills a function booking in full — the whole venue hire
 * (GST) plus the refundable security deposit (no GST, it isn't a supply). No
 * 50/50 split, because there is no deposit stage to split around.
 *
 * Two callers, two reasons for the same shape:
 *   • a courtesy hold — dates blocked, money still owed, due 14 days out
 *   • pay in full on the spot — card already charged, so `paid` stamps the
 *     payment on and the due date is today, nothing to chase
 */
export function buildFullInvoice({ booking: b, quote: q, base, id, paid = null }) {
  const inv = {
    ...(base ?? invoiceBaseFor(b)),
    id,
    invoiceType: 'function_full',
    dueDate: paid ? today() : (balanceDueDate(b.eventDate) || today()),
    vatEnabled: true,
    lineItems: [
      {
        description: `Function booking, payable in full · ${b.eventName || 'Function'} (${sessionsLabel(b)})`,
        revenueAccount: 'Function Space Hire',
        unitPrice: q.taxable, qty: 1, discountPct: 0,
      },
      {
        description: `Refundable security deposit · ${b.eventName || 'Function'}`,
        revenueAccount: 'Security Deposit',
        unitPrice: q.securityDeposit, qty: 1, discountPct: 0, vatExempt: true,
      },
    ],
  }
  if (!paid) return inv
  return {
    ...inv,
    status: 'paid',
    paidInFull: true,
    payments: [{
      id: `pay_${String(paid.reference ?? '').slice(-10) || Date.now()}`,
      date: today(),
      amount: paid.amount,
      method: paid.method ?? 'stripe',
      reference: paid.reference ?? '',
    }],
  }
}

/**
 * A calendar hold per session, each widened by the ±30-min turnover buffer.
 * Returned without ids — the caller allocates them the way its own layer does.
 *
 * `status: 'Confirmed'` is what grants door access downstream, so this is only
 * ever called once the venue is genuinely secured.
 */
export function buildSessionHolds({ booking: b, functionSpaceId }) {
  const sessions = bookingSessions(b)
  if (!functionSpaceId || !sessions.length) return []
  return sessions.map((s, i) => {
    const { blockStart, blockEnd } = bufferedWindow(s.startTime, s.endTime)
    return {
      type: 'function',
      resourceId: functionSpaceId,
      date: s.date,
      startTime: blockStart,
      endTime: blockEnd,
      title: `${b.eventName || 'Function'}${sessions.length > 1 ? ` — session ${i + 1}/${sessions.length}` : ''} (incl. buffer)`,
      eventType: b.eventType,
      guests: Number(b.guests) || null,
      status: 'Confirmed',
      approval: 'approved',
      source: 'Function Bookings',
      functionRef: b.ref,
      repeat: 'none',
      createdBy: 'Admin',
    }
  })
}

/**
 * Can this booking still be paid for in full up front?
 *
 * Paying in full REPLACES the deposit cycle, so it only makes sense before that
 * cycle has taken any money. Once a deposit is paid the remaining balance is
 * what's owed and that is an ordinary invoice payment, not this.
 */
export const PAYABLE_STAGES = ['requested', 'quoted', 'review', 'approved', 'invited', 'awaiting_deposit']

export function canPayInFull(b) {
  if (!b) return false
  if (b.depositPaid || b.paidInFullAt) return false
  if (b.stage === 'confirmed' || b.stage === 'completed') return false
  if (b.stage === 'declined' || b.stage === 'cancelled') return false
  return PAYABLE_STAGES.includes(b.stage)
}
