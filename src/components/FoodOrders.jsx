import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Plus, X, Check, Truck, RefreshCw, Trash2, Croissant, Save } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { logAudit } from '../lib/audit.js'

// Food Orders (Seoul Bakery partner) — members order from the mobile app and
// pay up front via Stripe; the bakery is emailed on payment. This page is the
// ops side: today's orders (advance placed → accepted → delivered), the
// menu editor, and the bakery's order email.

const nowIso = () => new Date().toISOString()
const inp = 'w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
const lab = 'block text-xs font-medium text-muted-foreground mb-1'
const money = (n) => `A$${Number(n ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const CATEGORIES = ['Breads', 'Pastries', 'Coffee', 'Drinks']

const STATUS_STYLE = {
  awaiting_payment: 'bg-muted text-muted-foreground border-input',
  placed: 'bg-amber-50 text-amber-700 border-amber-300',
  accepted: 'bg-blue-50 text-blue-700 border-blue-300',
  delivered: 'bg-green-50 text-green-700 border-green-300',
  cancelled: 'bg-red-50 text-red-700 border-red-300',
}

export default function FoodOrders() {
  const { settings, updateSettings } = useOutletContext()
  const [tab, setTab] = useState('orders')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-foreground">Food Orders</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Seoul Bakery partner ordering from the member app — paid up front, delivered to the member's door.
      </p>

      <div className="flex items-center gap-2 mb-5">
        {[{ k: 'orders', l: 'Orders' }, { k: 'menu', l: 'Menu' }, { k: 'settings', l: 'Bakery' }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${tab === t.k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-input hover:border-muted-foreground'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab />}
      {tab === 'menu' && <MenuTab />}
      {tab === 'settings' && <BakeryTab settings={settings} updateSettings={updateSettings} />}
    </div>
  )
}

function OrdersTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('food_orders').select('data').order('updated_at', { ascending: false })
    setRows((data ?? []).map((r) => r.data).filter(Boolean))
    setLoading(false)
  }

  async function setStatus(order, status) {
    const stamp = status === 'accepted' ? { acceptedAt: nowIso() } : status === 'delivered' ? { deliveredAt: nowIso() } : {}
    const updated = { ...order, status, ...stamp }
    await supabase.from('food_orders').upsert({ id: updated.id, data: updated, updated_at: nowIso() })
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    logAudit('update', 'food_order', order.id, order.companyName, status)
  }

  async function remove(order) {
    if (!confirm(`Delete order ${order.number}? (Only for unpaid/abandoned orders.)`)) return
    await supabase.from('food_orders').delete().eq('id', order.id)
    setRows((prev) => prev.filter((r) => r.id !== order.id))
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const filtered = rows.filter((o) => {
    if (filter === 'open') return ['placed', 'accepted'].includes(o.status)
    if (filter === 'today') return (o.createdAt || '').startsWith(todayStr) && o.status !== 'awaiting_payment'
    return true
  })
  const openCount = rows.filter((o) => ['placed', 'accepted'].includes(o.status)).length

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        {[{ k: 'open', l: `Open${openCount ? ` (${openCount})` : ''}` }, { k: 'today', l: 'Today' }, { k: 'all', l: 'All' }].map((t) => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === t.k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-input hover:border-muted-foreground'}`}>
            {t.l}
          </button>
        ))}
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-input rounded-lg py-12 text-center">
          <Croissant size={22} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No orders here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-sm text-foreground">{o.number}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${STATUS_STYLE[o.status] ?? STATUS_STYLE.awaiting_payment}`}>
                  {o.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {o.createdAt ? format(parseISO(o.createdAt), 'dd MMM yyyy · h:mm a') : ''}
                </span>
                <span className="ml-auto font-semibold text-sm">{money(o.total)}</span>
              </div>
              <div className="text-sm text-foreground mt-2">
                {(o.items ?? []).map((it) => `${it.qty} × ${it.name}`).join(' · ')}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {o.companyName}{o.memberName ? ` — ${o.memberName}` : ''} · deliver to <strong>{o.deliverTo || 'reception'}</strong>
                {o.note ? <> · “{o.note}”</> : null}
                {o.payment?.method ? <> · paid via {o.payment.method === 'card_on_file' ? 'saved card' : 'Stripe Checkout'}</> : null}
              </div>
              <div className="flex items-center gap-2 mt-3">
                {o.status === 'placed' && (
                  <button onClick={() => setStatus(o, 'accepted')}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-primary/90">
                    <Check size={13} /> Accept
                  </button>
                )}
                {o.status === 'accepted' && (
                  <button onClick={() => setStatus(o, 'delivered')}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-primary/90">
                    <Truck size={13} /> Mark delivered
                  </button>
                )}
                {['placed', 'accepted'].includes(o.status) && (
                  <button onClick={() => setStatus(o, 'cancelled')}
                    className="text-xs text-muted-foreground hover:text-destructive px-2 py-1.5">
                    Cancel
                  </button>
                )}
                {o.status === 'awaiting_payment' && (
                  <button onClick={() => remove(o)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive px-2 py-1.5">
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function MenuTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // item object or 'new'

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('food_menu_items').select('data')
    setItems((data ?? []).map((r) => r.data).filter(Boolean).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)))
    setLoading(false)
  }

  async function save(item) {
    await supabase.from('food_menu_items').upsert({ id: item.id, data: item, updated_at: nowIso() })
    setItems((prev) => {
      const next = prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]
      return next.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    })
    logAudit(items.some((i) => i.id === item.id) ? 'update' : 'create', 'food_menu', item.id, item.name, '')
    setEditing(null)
  }

  async function remove(item) {
    if (!confirm(`Delete "${item.name}" from the menu?`)) return
    await supabase.from('food_menu_items').delete().eq('id', item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  async function toggle(item) {
    const updated = { ...item, available: item.available === false }
    await supabase.from('food_menu_items').upsert({ id: updated.id, data: updated, updated_at: nowIso() })
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90">
          <Plus size={15} /> Add item
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-input rounded-lg py-12 text-center">
          <p className="text-sm text-muted-foreground">No menu yet — run food-schema.sql for the starter menu, or add items here.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-left">
                {['Item', 'Category', 'Price', 'Available', ''].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it) => (
                <tr key={it.id} className={it.available === false ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{it.name}</div>
                    {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{it.category}</td>
                  <td className="px-4 py-3">{money(it.price)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(it)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${it.available === false ? 'bg-muted text-muted-foreground border-input' : 'bg-green-50 text-green-700 border-green-300'}`}>
                      {it.available === false ? 'Hidden' : 'Available'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(it)} className="text-xs font-semibold text-foreground hover:underline mr-3">Edit</button>
                    <button onClick={() => remove(it)} className="text-xs text-muted-foreground hover:text-destructive">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MenuItemModal
          item={editing === 'new' ? null : editing}
          nextSort={(items.at(-1)?.sort ?? 0) + 10}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function MenuItemModal({ item, nextSort, onSave, onClose }) {
  const [f, setF] = useState(item ?? { name: '', description: '', price: '', category: 'Pastries', available: true })
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function submit(e) {
    e.preventDefault()
    if (!f.name.trim() || !(Number(f.price) > 0)) { alert('Name and a positive price are required.'); return }
    onSave({
      ...f,
      id: f.id ?? `fm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: f.name.trim(),
      description: (f.description || '').trim(),
      price: Math.round(Number(f.price) * 100) / 100,
      sort: f.sort ?? nextSort,
      available: f.available !== false,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card rounded-lg w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">{item ? 'Edit item' : 'Add menu item'}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div><label className={lab}>Name</label><input value={f.name} onChange={up('name')} className={inp} autoFocus /></div>
          <div><label className={lab}>Description</label><input value={f.description ?? ''} onChange={up('description')} className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lab}>Price (A$, inc GST)</label>
              <input type="number" step="0.1" min="0" value={f.price} onChange={up('price')} className={inp} />
            </div>
            <div>
              <label className={lab}>Category</label>
              <select value={f.category} onChange={up('category')} className={inp}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90">Save</button>
        </div>
      </form>
    </div>
  )
}

function BakeryTab({ settings, updateSettings }) {
  const [email, setEmail] = useState(settings?.food?.bakeryEmail ?? '')
  const [saved, setSaved] = useState(false)

  function save(e) {
    e.preventDefault()
    updateSettings({ food: { ...(settings?.food ?? {}), bakeryEmail: email.trim() } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={save} className="bg-card border border-border rounded-lg p-5 max-w-lg">
      <h2 className="font-semibold text-foreground mb-1">Seoul Bakery</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Every paid order is emailed here for fulfilment. If empty, orders fall back to{' '}
        {settings?.company?.email || 'info@hexaspace.com.au'} so nothing is lost.
      </p>
      <label className={lab}>Order email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="orders@seoulbakery.com.au" className={inp} />
      <div className="flex items-center gap-3 mt-4">
        <button type="submit" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90">
          <Save size={14} /> Save
        </button>
        {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
      </div>
    </form>
  )
}
