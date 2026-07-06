// Invoice total inc. GST after line discounts — mirrors the portal's calcTotals
// (PortalBilling.jsx) and the server's invoiceTotalIncGst (api/_stripe.js).
export function invoiceTotal(invoice) {
  let taxable = 0, exempt = 0
  for (const li of invoice.lineItems ?? []) {
    const price = (li.unitPrice ?? 0) * (li.qty ?? 1)
    const net = price - price * ((li.discountPct ?? 0) / 100)
    if (li.vatExempt) exempt += net; else taxable += net
  }
  const gst = invoice.vatEnabled ? taxable * 0.1 : 0
  return taxable + exempt + gst
}

export const unpaidInvoices = (invoices) =>
  (invoices ?? [])
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
