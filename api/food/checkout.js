// POST /api/food/checkout — Stripe Checkout session for a food order.
// Body: { orderId }. Returns { url }. The webhook marks the order placed
// (metadata.foodOrderId) and emails the bakery.
// Same hard gate as invoice checkout: settings.stripe.paymentsEnabled.
import { foodOrderTotal, orderingOpen, ORDER_HOURS_LABEL } from '../_food.js'
import { applyCors } from '../_cors.js'
import { requireMember, isAdminEmail } from '../_auth.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured.' })

  // Verify the caller owns the order's company (or is an admin).
  const auth = await requireMember(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const supabase = auth.sb
  const isAdmin = await isAdminEmail(supabase, auth.user.email)

  const { orderId } = req.body ?? {}
  if (!orderId) return res.status(400).json({ error: 'orderId is required.' })
  if (!orderingOpen()) return res.status(409).json({ error: `Seoul Bakery only takes orders ${ORDER_HOURS_LABEL}.` })

  try {
    const [{ data: settRow }, { data: oRow }] = await Promise.all([
      supabase.from('settings').select('data').eq('id', 'global').single(),
      supabase.from('food_orders').select('data').eq('id', orderId).single(),
    ])
    const settings = settRow?.data ?? {}
    if (settings.stripe?.paymentsEnabled !== true) {
      return res.status(403).json({ error: 'Online payments are not enabled yet.' })
    }

    const order = oRow?.data
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    if (!isAdmin && order.companyId !== auth.companyId) return res.status(403).json({ error: 'Not your order.' })
    if (order.status !== 'awaiting_payment') return res.status(400).json({ error: 'This order is already paid.' })
    if (foodOrderTotal(order) <= 0) return res.status(400).json({ error: 'Order total must be positive.' })

    const base = `https://${req.headers.host}`
    const params = new URLSearchParams({
      mode: 'payment',
      'metadata[foodOrderId]': order.id,
      'payment_intent_data[metadata][foodOrderId]': order.id,
      success_url: `${base}/app/food?ordered=${encodeURIComponent(order.number ?? order.id)}`,
      cancel_url: `${base}/app/food`,
    })
    ;(order.items ?? []).forEach((it, i) => {
      params.set(`line_items[${i}][price_data][currency]`, 'aud')
      params.set(`line_items[${i}][price_data][product_data][name]`, String(it.name ?? 'Item').slice(0, 100))
      params.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(Number(it.price || 0) * 100)))
      params.set(`line_items[${i}][quantity]`, String(Number(it.qty || 1)))
    })
    if (order.email) params.set('customer_email', order.email)

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    const session = await r.json()
    if (!r.ok || !session.url) {
      console.error('Food checkout create failed:', session)
      return res.status(500).json({ error: session.error?.message ?? 'Could not start the payment.' })
    }

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Food checkout error:', err)
    return res.status(500).json({ error: 'Could not start the payment.' })
  }
}
