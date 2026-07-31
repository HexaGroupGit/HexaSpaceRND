// POST /api/refunds/deposit — pay a security-deposit refund back out.
//
// Body: { invoiceId }   (the bond_refund credit note)
//
// Two rails, chosen from how the deposit was actually PAID rather than by asking:
//   • card  → Stripe refund against the original PaymentIntent. Nothing needed
//             from the client, lands back on the card they used.
//   • bank  → we can only pay a bank transfer by hand, so this returns
//             { needsBankDetails } and the caller asks the client for them.
//
// Either way the credit note is stamped paid/refunded so it drops out of the
// "awaiting payout" queue, and the Xero credit note is pushed by the next sync.
import { stripeConfigured, stripeFetch } from '../_stripe.js'
import { applyCors } from '../_cors.js'
import { requireAdmin } from '../_auth.js'

const money = (v) => `$${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
const totalOf = (inv) => Math.abs((inv.lineItems ?? []).reduce(
  (s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0))

/** The Stripe PaymentIntent that settled an invoice, if it was paid by card. */
export function paymentIntentFor(invoice) {
  for (const p of invoice?.payments ?? []) {
    const ref = String(p.reference ?? '')
    if (ref.startsWith('pi_')) return ref
  }
  return null
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb

  const { invoiceId } = req.body ?? {}
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required.' })

  try {
    const { data: row } = await sb.from('invoices').select('data').eq('id', invoiceId).single()
    const credit = row?.data
    if (!credit) return res.status(404).json({ error: 'Refund not found.' })
    if (credit.refundedAt) return res.status(400).json({ error: 'This refund has already been paid out.' })
    if (credit.approvalStatus !== 'approved') return res.status(400).json({ error: 'Approve the refund before paying it out.' })

    const amount = totalOf(credit)
    if (amount <= 0) return res.status(400).json({ error: 'This refund has no amount.' })

    // The invoice this credits — that's where the original payment lives.
    let original = null
    if (credit.creditNoteForId) {
      const { data: oRow } = await sb.from('invoices').select('data').eq('id', credit.creditNoteForId).single()
      original = oRow?.data ?? null
    }
    const pi = paymentIntentFor(original)

    if (!pi) {
      // Paid by bank transfer (or no payment recorded) — no card to refund to.
      const bank = credit.refundBank ?? original?.refundBank ?? null
      return res.status(200).json({
        rail: 'bank',
        needsBankDetails: !bank,
        bank,
        amount,
        message: bank
          ? `Transfer ${money(amount)} to the account on file, then mark it refunded.`
          : 'This deposit was not paid by card, so it has to go back by bank transfer — request the client’s account details first.',
      })
    }

    if (!stripeConfigured()) return res.status(500).json({ error: 'Stripe is not configured.' })

    const r = await stripeFetch('/refunds', {
      payment_intent: pi,
      amount: Math.round(amount * 100),
      metadata: {
        kind: 'security_deposit_refund',
        creditNote: credit.number ?? credit.id,
        originalInvoice: original?.number ?? '',
        functionRef: credit.functionRef ?? '',
      },
    })
    if (!r.ok || !['succeeded', 'pending'].includes(r.json?.status)) {
      return res.status(402).json({
        error: r.json?.error?.message || `Stripe could not refund this payment (${r.json?.status ?? 'failed'}).`,
      })
    }

    const nowIso = new Date().toISOString()
    const updated = {
      ...credit,
      status: 'paid',
      refundedAt: nowIso,
      refundMethod: 'Stripe (card)',
      refundReference: r.json.id,
      stripeRefundId: r.json.id,
      payments: [...(credit.payments ?? []), {
        id: `ref_${r.json.id.slice(-10)}`,
        amount: -amount,
        date: nowIso.split('T')[0],
        method: 'Stripe refund',
        reference: r.json.id,
      }],
    }
    await sb.from('invoices').upsert({ id: invoiceId, data: updated, updated_at: nowIso })

    return res.status(200).json({
      rail: 'card', success: true, amount,
      refundId: r.json.id, status: r.json.status, invoice: updated,
      message: `Refunded ${money(amount)} to the original card.`,
    })
  } catch (err) {
    console.error('deposit refund error:', err)
    return res.status(500).json({ error: err.message })
  }
}
