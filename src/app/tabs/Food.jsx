import { useState, useEffect, useMemo } from 'react'
import { Minus, Plus, CreditCard, ExternalLink, Check, RefreshCw } from 'lucide-react'
import { useApp } from '../context.js'
import { Screen, Label, Display, Rule, Chip, Sheet, BigButton, EmptyNote, money, fmt } from '../ui.jsx'
import { createFoodOrder, loadMenu, loadMyOrders, foodTotal } from '../lib/foodActions.js'

const CATEGORY_ORDER = ['Breads', 'Pastries', 'Coffee', 'Drinks']

const STATUS_LABEL = {
  placed: 'Placed',
  accepted: 'Being prepared',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default function Food() {
  const { data } = useApp()
  const { member, company, leases, spaces } = data

  const [menu, setMenu] = useState(null) // null = loading
  const [orders, setOrders] = useState([])
  const [cart, setCart] = useState({}) // { itemId: qty }
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // Stripe Checkout bounces back with ?ordered=<order number>.
  const [justOrdered] = useState(() => new URLSearchParams(window.location.search).get('ordered'))
  useEffect(() => {
    if (justOrdered) window.history.replaceState({}, '', window.location.pathname)
  }, [justOrdered])

  useEffect(() => {
    loadMenu().then(setMenu).catch(() => setMenu([]))
    refreshOrders()
  }, [company?.id])

  function refreshOrders() {
    loadMyOrders(company?.id).then(setOrders).catch(() => {})
  }

  // Office/suite prefilled from the member's lease.
  const suite = useMemo(() => {
    const active = (leases ?? []).find((l) => l.status === 'active' && l.spaceId)
    const space = (spaces ?? []).find((s) => s.id === active?.spaceId)
    if (!space) return ''
    return `${space.unitNumber ?? ''}${space.floor ? `, Level ${space.floor}` : ''}`.trim()
  }, [leases, spaces])

  const byCategory = useMemo(() => {
    const items = (menu ?? []).filter((m) => m.available !== false)
    const cats = [...new Set([...CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c)),
      ...items.map((i) => i.category).filter((c) => c && !CATEGORY_ORDER.includes(c))])]
    return cats.map((c) => ({ category: c, items: items.filter((i) => i.category === c) }))
  }, [menu])

  const cartItems = useMemo(() =>
    (menu ?? []).filter((m) => cart[m.id] > 0).map((m) => ({ ...m, qty: cart[m.id] })), [menu, cart])
  const cartCount = cartItems.reduce((s, it) => s + it.qty, 0)
  const cartSum = foodTotal(cartItems)

  const add = (id, delta) => setCart((c) => {
    const q = Math.max(0, (c[id] ?? 0) + delta)
    const next = { ...c, [id]: q }
    if (q === 0) delete next[id]
    return next
  })

  // Live orders (today's, not delivered/cancelled) surface at the top.
  const openOrders = orders.filter((o) => ['placed', 'accepted'].includes(o.status))
  const pastOrders = orders.filter((o) => ['delivered'].includes(o.status)).slice(0, 5)

  return (
    <Screen>
      <div className="pt-9 pb-6">
        <Label>Seoul Bakery · Downstairs</Label>
        <Display className="mt-4">Fresh, to<br />your door.</Display>
        <p className="hx-prose text-[13px] mt-4">
          Baked downstairs by Seoul Bakery and delivered to your suite. Order before 2pm for
          same-day delivery.
        </p>
      </div>

      {justOrdered && (
        <div className="mb-5 border border-hexa-green/40 bg-hexa-green/10 px-4 py-3">
          <p className="hx-prose text-[13px] text-ink">
            ✓ Order <span className="font-heading uppercase tracking-nav text-[11px]">{justOrdered}</span> placed —
            Seoul Bakery has been notified. Track it below.
          </p>
        </div>
      )}

      {/* Live order status */}
      {openOrders.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <Label>Your orders</Label>
            <button onClick={refreshOrders} aria-label="Refresh orders"
              className="h-9 w-9 flex items-center justify-center text-portal-muted active:text-ink">
              <RefreshCw size={13} />
            </button>
          </div>
          <div className="space-y-px bg-ink/10">
            {openOrders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {/* Menu */}
      {menu === null ? (
        <p className="hx-prose text-center py-10">Loading the menu…</p>
      ) : byCategory.length === 0 ? (
        <EmptyNote label="The menu isn't up yet." sub="Seoul Bakery ordering is nearly ready — check back soon." />
      ) : (
        byCategory.map(({ category, items }) => (
          <section key={category} className="mb-8">
            <Label className="mb-1">{category}</Label>
            <Rule className="mb-1" />
            <div className="divide-y divide-ink/5">
              {items.map((it) => (
                <MenuRow key={it.id} item={it} qty={cart[it.id] ?? 0} onAdd={add} />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Past orders */}
      {pastOrders.length > 0 && (
        <div className="mt-2">
          <Label className="mb-3">Recent</Label>
          <div className="space-y-px bg-ink/10 opacity-70">
            {pastOrders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {/* Floating cart bar */}
      {cartCount > 0 && !checkoutOpen && (
        <button onClick={() => setCheckoutOpen(true)}
          className="app-cartbar bg-ink text-paper min-h-[54px] px-5 flex items-center justify-between active:bg-charcoal">
          <span className="font-heading uppercase tracking-nav text-[11px]">
            {cartCount} {cartCount === 1 ? 'item' : 'items'} · {money(cartSum)}
          </span>
          <span className="font-heading uppercase tracking-nav text-[11px] text-hexa-green">Review order</span>
        </button>
      )}

      {checkoutOpen && (
        <CheckoutSheet
          cartItems={cartItems} suite={suite} member={member} company={company}
          onAdjust={add}
          onClose={() => setCheckoutOpen(false)}
          onPlaced={(order) => {
            setCart({})
            setOrders((prev) => [order, ...prev])
          }}
        />
      )}
    </Screen>
  )
}

function MenuRow({ item, qty, onAdd }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex-1 min-w-0">
        <div className="font-body text-[15px] text-ink">{item.name}</div>
        {item.description && <div className="hx-prose text-[12px] mt-0.5">{item.description}</div>}
      </div>
      <span className="font-display font-extralight text-[17px] text-ink shrink-0">{money(item.price)}</span>
      {qty === 0 ? (
        <button onClick={() => onAdd(item.id, 1)} aria-label={`Add ${item.name}`}
          className="h-10 w-10 shrink-0 border border-ink/20 flex items-center justify-center text-ink active:bg-ink active:text-paper transition-colors">
          <Plus size={15} />
        </button>
      ) : (
        <div className="flex items-center shrink-0 border border-ink">
          <button onClick={() => onAdd(item.id, -1)} aria-label="Remove one" className="h-10 w-9 flex items-center justify-center active:bg-bone"><Minus size={13} /></button>
          <span className="w-7 text-center font-heading text-[12px]">{qty}</span>
          <button onClick={() => onAdd(item.id, 1)} aria-label="Add one" className="h-10 w-9 flex items-center justify-center active:bg-bone"><Plus size={13} /></button>
        </div>
      )}
    </div>
  )
}

function OrderCard({ order }) {
  const steps = ['placed', 'accepted', 'delivered']
  const stepIdx = steps.indexOf(order.status)
  return (
    <div className="bg-paper border border-ink/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-heading uppercase tracking-nav text-[11px] text-ink">{order.number}</span>
        <Chip tone={order.status === 'delivered' ? 'ink' : 'green'}>{STATUS_LABEL[order.status] ?? order.status}</Chip>
      </div>
      <p className="hx-prose text-[12px] mt-2">
        {(order.items ?? []).map((it) => `${it.qty} × ${it.name}`).join(' · ')}
      </p>
      <p className="hx-prose text-[12px] mt-1">
        {money(order.total ?? 0)} · to {order.deliverTo || 'reception'} · {order.createdAt ? fmt(order.createdAt.split('T')[0]) : ''}
      </p>
      {stepIdx >= 0 && order.status !== 'delivered' && (
        <div className="flex items-center gap-1.5 mt-4">
          {steps.map((s, i) => (
            <span key={s} className={`h-[3px] flex-1 ${i <= stepIdx ? 'bg-hexa-green' : 'bg-ink/10'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function CheckoutSheet({ cartItems, suite, member, company, onAdjust, onClose, onPlaced }) {
  const [deliverTo, setDeliverTo] = useState(suite)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null) // 'card' | 'checkout'
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState(null)

  const total = foodTotal(cartItems)
  const hasCard = !!company?.stripePaymentMethodId

  async function pay(method) {
    if (cartItems.length === 0) return
    setBusy(method); setError('')
    try {
      const order = await createFoodOrder({ items: cartItems, note, deliverTo, member, company })
      if (method === 'card') {
        const r = await fetch('/api/food/charge', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? 'The payment could not be processed.')
        onPlaced(d.order ?? { ...order, status: 'placed' })
        setPlaced(d.order ?? order)
      } else {
        const r = await fetch('/api/food/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? 'Online payment is unavailable right now.')
        window.location.href = d.url
      }
    } catch (e) {
      setError(e.message)
      setBusy(null)
    }
  }

  return (
    <Sheet open onClose={placed ? () => { onClose() } : onClose} title={placed ? 'Order placed' : 'Your order'}>
      {placed ? (
        <div className="text-center pt-2">
          <span className="mx-auto h-12 w-12 border border-hexa-green/50 bg-hexa-green/10 flex items-center justify-center">
            <Check size={20} className="text-hexa-green" />
          </span>
          <p className="font-display font-extralight text-2xl text-ink mt-5">{placed.number}</p>
          <p className="hx-prose text-[13px] mt-2">
            Seoul Bakery has your order — it'll be delivered to {placed.deliverTo || 'your door'}.
          </p>
          <BigButton onClick={onClose} className="mt-7">Done</BigButton>
        </div>
      ) : (
        <>
          <div className="divide-y divide-ink/5 mb-5">
            {cartItems.map((it) => (
              <div key={it.id} className="flex items-center gap-3 py-3">
                <span className="flex-1 font-body text-[14px] text-ink truncate">{it.name}</span>
                <div className="flex items-center border border-ink/20">
                  <button onClick={() => onAdjust(it.id, -1)} className="h-9 w-8 flex items-center justify-center active:bg-bone"><Minus size={12} /></button>
                  <span className="w-6 text-center font-heading text-[11px]">{it.qty}</span>
                  <button onClick={() => onAdjust(it.id, 1)} className="h-9 w-8 flex items-center justify-center active:bg-bone"><Plus size={12} /></button>
                </div>
                <span className="w-16 text-right font-display font-extralight text-[15px]">{money(it.price * it.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between py-3">
              <span className="font-heading uppercase tracking-nav text-[11px] text-ink">Total</span>
              <span className="font-display font-extralight text-xl text-ink">{money(total)}</span>
            </div>
          </div>

          <label className="hx-eyebrow block mb-2">Deliver to</label>
          <input value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)}
            placeholder="Suite / desk — e.g. Suite 14, Level 2" className="hx-input min-h-[48px] mb-4" />
          <label className="hx-eyebrow block mb-2">Note for the bakery (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. oat milk, no sugar" className="hx-input min-h-[48px] mb-5" />

          {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

          <div className="space-y-3">
            {hasCard && (
              <BigButton onClick={() => pay('card')} disabled={!!busy || cartItems.length === 0}>
                <CreditCard size={14} className="inline mr-2 -mt-0.5" />
                {busy === 'card' ? 'Charging…' : `Pay ${money(total)} with •••• ${company.cardLast4}`}
              </BigButton>
            )}
            <BigButton onClick={() => pay('checkout')} disabled={!!busy || cartItems.length === 0} tone="outline">
              <ExternalLink size={14} className="inline mr-2 -mt-0.5" />
              {busy === 'checkout' ? 'Opening…' : hasCard ? 'Pay with another card' : `Pay ${money(total)} by card`}
            </BigButton>
          </div>
          <p className="hx-prose text-[11px] text-center mt-5">
            Paid to Hexa Space and passed on to Seoul Bakery. Payments processed securely by Stripe.
          </p>
        </>
      )}
    </Sheet>
  )
}
