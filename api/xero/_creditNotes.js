// Reading a credit note's refund back from Xero onto the portal.
//
// The payment pull in sync.js matched portal records to Xero INVOICES only. A
// credit note the push sent to Xero is linked by xeroCreditNoteId and lives
// under /CreditNotes, so a refund paid out in Xero never reached the portal:
// the credit note stayed unpaid here and a bond refund sat in "awaiting payout"
// after the money had gone (Invest Mentor's deposit refund, Sept 2026).
//
// Only a refund PAYMENT on the credit note is money going back. Xero also marks
// a credit note PAID once it is fully ALLOCATED to other invoices — that is the
// credit being used up against later bills, not a refund, so it is reported
// but never recorded as one.

import { parseXeroDate } from './_client.js'

const round2 = (n) => Math.round(n * 100) / 100

/**
 * What a Xero credit note says about money going back to the client.
 * state: 'missing' | 'voided' | 'open' | 'partlyRefunded' | 'appliedOnly' | 'refunded'
 */
export function readXeroCreditNote(xc) {
  if (!xc) return { state: 'missing' }
  if (xc.Status === 'VOIDED' || xc.Status === 'DELETED') return { state: 'voided' }

  const refunds = (xc.Payments ?? []).filter((p) => p && p.Status !== 'DELETED' && Number(p.Amount) > 0)
  const refunded = round2(refunds.reduce((s, p) => s + Number(p.Amount), 0))
  const applied = round2((xc.Allocations ?? [])
    .filter((a) => a && !a.IsDeleted)
    .reduce((s, a) => s + Number(a.Amount ?? 0), 0))

  // Still carrying credit. Refunding part of it is a question for Accounts,
  // not something to close out here.
  if (xc.Status !== 'PAID') {
    return refunded > 0
      ? { state: 'partlyRefunded', refunded, remaining: round2(Number(xc.RemainingCredit ?? 0)) }
      : { state: 'open' }
  }
  if (refunded <= 0) return { state: 'appliedOnly', applied }

  const dates = refunds.map((p) => parseXeroDate(p.Date)).filter(Boolean).sort()
  const references = [...new Set(refunds.map((p) => String(p.Reference ?? '').trim()).filter(Boolean))]
  return { state: 'refunded', refunded, applied, date: dates[dates.length - 1] ?? null, references }
}

/**
 * The portal credit note stamped refunded, from a readXeroCreditNote() result
 * in the 'refunded' state. Writes the same fields as the Billing page's "Mark
 * refunded", so the payout queue, the 45-day SLA check and the refund
 * bank-details link all read it as paid out.
 */
export function withXeroRefund(credit, xc, read, nowIso = new Date().toISOString()) {
  const date = read.date ?? nowIso.split('T')[0]
  const refundedAt = read.date ? `${read.date}T00:00:00.000Z` : nowIso
  const reference = (read.references ?? []).join(', ')
  return {
    ...credit,
    status: 'paid',
    refundedAt,
    refundMethod: 'Xero',
    refundReference: reference,
    // The money has already gone, so an approval still waiting here is moot —
    // left alone it would keep a paid refund in the "pending approval" queue.
    ...(credit.approvalStatus === 'pending'
      ? { approvalStatus: 'approved', approvedAt: credit.approvedAt ?? refundedAt, approvedVia: 'xero-refund' }
      : {}),
    payments: [
      ...(credit.payments ?? []),
      {
        id: `pay_xero_refund_${String(xc?.CreditNoteID ?? credit.xeroCreditNoteId ?? credit.id).slice(0, 8)}`,
        amount: -read.refunded,
        date,
        method: 'xero',
        reference: reference ? `Refund synced from Xero (${reference})` : 'Refund synced from Xero',
      },
    ],
  }
}
