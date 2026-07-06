import { supabase } from '../../lib/supabase.js'

// Food-order client helpers. An order is written as 'awaiting_payment', then
// paid via /api/food/charge (saved card) or /api/food/checkout (Stripe) —
// the server flips it to 'placed' and emails Seoul Bakery.

export const foodTotal = (items) =>
  Math.round(items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0) * 100) / 100

export async function createFoodOrder({ items, note, deliverTo, member, company }) {
  const order = {
    id: `fo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    number: `FO-${Math.floor(100000 + Math.random() * 900000)}`,
    companyId: company?.id ?? '',
    companyName: company?.businessName ?? '',
    memberId: member?.id ?? '',
    memberName: member?.name || company?.contactName || '',
    email: member?.email || company?.email || '',
    items: items.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
    note: (note || '').trim(),
    deliverTo: (deliverTo || '').trim(),
    total: foodTotal(items),
    status: 'awaiting_payment',
    createdAt: new Date().toISOString(),
  }
  const { error } = await supabase.from('food_orders')
    .upsert({ id: order.id, data: order, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  return order
}

export async function loadMenu() {
  const { data } = await supabase.from('food_menu_items').select('data')
  return (data ?? []).map((r) => r.data).filter(Boolean)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
}

export async function loadMyOrders(companyId) {
  if (!companyId) return []
  const { data } = await supabase.from('food_orders').select('data').eq('data->>companyId', companyId)
  return (data ?? []).map((r) => r.data).filter(Boolean)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}
