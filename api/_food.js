// Shared food-order helpers — used by api/food/* and the Stripe webhook.
// An order is created by the member app as 'awaiting_payment'; once paid
// (saved card or Checkout) it becomes 'placed', Seoul Bakery is emailed, and
// the bakery/admin advances it: placed → accepted → delivered.

import { sendResendEmail } from './_email.js'

export function foodOrderTotal(order) {
  return Math.round((order.items ?? []).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0) * 100) / 100
}

function bakeryEmailHtml(order, settings) {
  const company = settings?.company?.name || 'Hexa Space'
  const rows = (order.items ?? []).map((it) =>
    `<tr>
      <td style="padding:6px 0;font-family:Arial,sans-serif;font-size:14px;color:#161614">${it.qty} × ${it.name}</td>
      <td style="padding:6px 0;font-family:Arial,sans-serif;font-size:14px;color:#161614;text-align:right">A$${(Number(it.price) * Number(it.qty)).toFixed(2)}</td>
    </tr>`).join('')
  return `
  <div style="background:#F6F5F1;padding:28px 16px;font-family:Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,.1);padding:28px">
      <p style="margin:0;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#6B6B66">New order · ${company}</p>
      <h1 style="margin:10px 0 0;font-size:24px;font-weight:300;color:#161614">Order ${order.number}</h1>
      <p style="margin:14px 0 0;font-size:14px;color:#161614">
        <strong>Deliver to:</strong> ${order.deliverTo || 'See reception'}<br/>
        <strong>Member:</strong> ${order.memberName || ''} (${order.companyName || ''})<br/>
        ${order.note ? `<strong>Note:</strong> ${order.note}<br/>` : ''}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;border-top:1px solid rgba(0,0,0,.1)">
        ${rows}
        <tr>
          <td style="padding:10px 0;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#161614;border-top:1px solid rgba(0,0,0,.1)">Total (paid)</td>
          <td style="padding:10px 0;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#161614;text-align:right;border-top:1px solid rgba(0,0,0,.1)">A$${foodOrderTotal(order).toFixed(2)}</td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#6B6B66">
        Payment has been collected — no charge on delivery. Please deliver to the member's door at
        402/830 Whitehorse Road, Box Hill. Mark the order accepted/delivered in the Hexa admin, or
        reply to this email if something is unavailable.
      </p>
    </div>
  </div>`
}

/**
 * Mark a paid order as placed and notify the bakery. Idempotent: does nothing
 * if the order already moved past awaiting_payment.
 * Returns the updated order.
 */
export async function markFoodOrderPlaced(supabase, order, { reference, method }) {
  if (order.status !== 'awaiting_payment') return order

  const updated = {
    ...order,
    status: 'placed',
    placedAt: new Date().toISOString(),
    payment: { method, reference, paidAt: new Date().toISOString(), amount: foodOrderTotal(order) },
  }
  await supabase.from('food_orders').upsert({ id: updated.id, data: updated, updated_at: new Date().toISOString() })

  // Email the bakery (configurable in Admin → Food Orders; falls back to us so
  // orders are never silently lost). Never let email failure fail the payment.
  try {
    const { data: settRow } = await supabase.from('settings').select('data').eq('id', 'global').single()
    const settings = settRow?.data ?? {}
    const bakeryEmail = settings.food?.bakeryEmail || settings.company?.email || 'info@hexaspace.com.au'
    const fromName = settings.emails?.fromName || settings.company?.name || 'Hexa Space'
    const fromEmail = settings.emails?.fromEmail || 'noreply@hexaspace.com.au'
    await sendResendEmail({
      from: `${fromName} <${fromEmail}>`,
      to: bakeryEmail,
      subject: `🥐 New Hexa Space order ${updated.number} — deliver to ${updated.deliverTo || 'reception'}`,
      html: bakeryEmailHtml(updated, settings),
      replyTo: settings.emails?.replyTo || undefined,
    })
  } catch (err) {
    console.error('Food order bakery email failed:', err)
  }

  return updated
}
