// POST /api/food/charge — pays a food order with the company's saved card
// (off-session, same rails as invoice charging) and marks it placed.
// Body: { orderId }. Returns { success: true, order }.
import { createClient } from '@supabase/supabase-js'
import { stripeConfigured, stripeFetch } from '../_stripe.js'
import { foodOrderTotal, markFoodOrderPlaced } from '../_food.js'
import { applyCors } from '../_cors.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!stripeConfigured() || !serviceKey) return res.status(500).json({ error: 'Stripe not configured.' })

  const { orderId } = req.body ?? {}
  if (!orderId) return res.status(400).json({ error: 'orderId is required.' })

  try {
    const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

    const { data: oRow } = await supabase.from('food_orders').select('data').eq('id', orderId).single()
    const order = oRow?.data
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    if (order.status !== 'awaiting_payment') return res.status(400).json({ error: 'This order is already paid.' })

    const { data: tRow } = await supabase.from('tenants').select('data').eq('id', order.companyId).single()
    const tenant = tRow?.data
    if (!tenant?.stripeCustomerId || !tenant?.stripePaymentMethodId) {
      return res.status(402).json({ error: 'No saved card on file — pay by card instead.' })
    }

    const total = foodOrderTotal(order)
    if (total <= 0) return res.status(400).json({ error: 'Order total must be positive.' })

    const r = await stripeFetch('/payment_intents', {
      amount: Math.round(total * 100),
      currency: 'aud',
      customer: tenant.stripeCustomerId,
      payment_method: tenant.stripePaymentMethodId,
      off_session: 'true',
      confirm: 'true',
      description: `Food order ${order.number} — ${order.companyName ?? ''}`.trim(),
      metadata: { foodOrderId: order.id, orderNumber: order.number ?? '', tenantId: tenant.id },
    })
    if (!r.ok || r.json.status !== 'succeeded') {
      return res.status(402).json({ error: r.json.error?.message || `Payment ${r.json.status || 'failed'}`, code: r.json.error?.code })
    }

    const updated = await markFoodOrderPlaced(supabase, order, { reference: r.json.id, method: 'card_on_file' })
    return res.status(200).json({ success: true, order: updated })
  } catch (err) {
    console.error('Food charge error:', err)
    return res.status(500).json({ error: 'The payment could not be processed.' })
  }
}
