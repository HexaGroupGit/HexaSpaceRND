import { useState } from 'react'
import { authHeaders } from '../../lib/apiFetch.js'
import { CreditCard, ExternalLink } from 'lucide-react'
import { Sheet, BigButton, Rule, fmt, money } from '../ui.jsx'
import { invoiceTotal } from '../lib/invoiceTotal.js'
import { apiUrl, openPayment } from '../lib/native.js'

// Pay a single invoice: charge the saved card on file (off-session, same
// endpoint the admin uses) or open Stripe Checkout. Checkout returns to the
// app via returnTo (handled by api/stripe/checkout.js).
export default function PaySheet({ invoice, company, onClose, onPaid, returnTo = '/app' }) {
  const [busy, setBusy] = useState(null) // 'card' | 'checkout'
  const [error, setError] = useState('')
  const hasCard = !!company?.stripePaymentMethodId

  async function payWithSavedCard() {
    setBusy('card'); setError('')
    try {
      const r = await fetch(apiUrl('/api/stripe/charge'), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'The payment could not be processed.')
      onPaid(d.invoice ?? { ...invoice, status: 'paid' })
    } catch (e) {
      setError(e.message)
      setBusy(null)
    }
  }

  async function payWithCheckout() {
    setBusy('checkout'); setError('')
    try {
      const r = await fetch(apiUrl('/api/stripe/checkout'), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ invoiceId: invoice.id, returnTo }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Online payment is unavailable right now.')
      await openPayment(d.url)
      setBusy(null)
    } catch (e) {
      setError(e.message)
      setBusy(null)
    }
  }

  if (!invoice) return null
  return (
    <Sheet open onClose={onClose} title="Pay invoice">
      <div className="text-center pt-2 pb-6">
        <p className="font-heading uppercase tracking-nav text-[11px] text-ink">{invoice.number}</p>
        <p className="font-display font-extralight text-[40px] text-ink mt-2">{money(invoiceTotal(invoice))}</p>
        <p className="hx-prose text-[12px] mt-1">Due {fmt(invoice.dueDate)}{invoice.status === 'overdue' ? ' · overdue' : ''}</p>
      </div>
      <Rule className="mb-5" />
      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
      <div className="space-y-3">
        {hasCard && (
          <BigButton onClick={payWithSavedCard} disabled={!!busy}>
            <CreditCard size={14} className="inline mr-2 -mt-0.5" />
            {busy === 'card' ? 'Charging…' : `Pay with ${(company.cardBrand || 'card').toUpperCase()} •••• ${company.cardLast4}`}
          </BigButton>
        )}
        <BigButton onClick={payWithCheckout} disabled={!!busy} tone="outline">
          <ExternalLink size={14} className="inline mr-2 -mt-0.5" />
          {busy === 'checkout' ? 'Opening…' : hasCard ? 'Pay with another card' : 'Pay by card (Stripe)'}
        </BigButton>
      </div>
      <p className="hx-prose text-[11px] text-center mt-5">
        Payments are processed securely by Stripe — we never see your card number.
      </p>
    </Sheet>
  )
}
