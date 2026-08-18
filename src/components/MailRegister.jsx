import { useState, useEffect, useMemo, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, X, Check, Mailbox, Package, RefreshCw, Trash2, Search } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { sendEmail, brandShell, bKicker, bH1, bP, bSmall, bBtn, PORTAL_URL } from '../lib/sendEmail.js'
import { logAudit } from '../lib/audit.js'
import { billingEmailFor } from '../lib/credits.js'

// Mail & Deliveries register: reception logs an item addressed to a company OR
// a specific member; the addressee is emailed straight away ("collect from
// reception") and the item shows on their portal/app until marked collected.

const today = () => new Date().toISOString().split('T')[0]
const nowIso = () => new Date().toISOString()
const inp = 'w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
const lab = 'block text-xs font-medium text-muted-foreground mb-1'

function mailArrivedEmailHtml({ item, addresseeFirst, settings }) {
  const company = settings?.company?.name || 'Hexa Space'
  const parcel = item.type === 'parcel'
  const HAIR = 'rgba(0,0,0,.09)'
  const detail = (k, v) => `
        <tr>
          <td style="padding:9px 0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a8a86;border-top:1px solid ${HAIR};width:130px">${k}</td>
          <td style="padding:9px 0;font-family:Arial,sans-serif;font-size:14px;color:#161614;border-top:1px solid ${HAIR}">${v}</td>
        </tr>`
  const inner =
    bKicker(parcel ? 'Delivery arrived' : "You've got mail") +
    bH1(parcel ? 'A parcel is waiting for you 📦' : 'Mail is waiting for you 📬') +
    bP(`Hi ${addresseeFirst || 'there'},`) +
    bP(`${parcel ? 'A parcel' : 'Mail'} addressed to <strong>${item.addresseeName || 'you'}</strong> has just arrived at reception.`) +
    `      <table style="width:100%;border-collapse:collapse;margin:6px 0 10px">
${detail('Item', parcel ? 'Parcel' : 'Mail')}${item.description ? detail('Details', item.description) : ''}${detail('Arrived', format(new Date(), 'EEEE d MMMM · h:mm a'))}${detail('Collect from', 'Reception · Level 4, 402/830 Whitehorse Rd')}
      </table>` +
    bBtn('View in the member portal', `${PORTAL_URL}/app/mail`) +
    bSmall(`Reception holds items securely during opening hours. Parcels left over 48 hours may incur a storage charge (see House Rules).`) +
    bSmall(`${company} · 402/830 Whitehorse Road, Box Hill VIC 3128`)
  return brandShell(inner, { company, website: settings?.company?.website || 'hexaspace.com.au' })
}

// Type-to-search addressee picker. Reception types a few letters of the company
// or person's name rather than scrolling a select that grows with every member.
function AddresseePicker({ options, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const listRef = useRef(null)

  const selected = options.find((o) => o.value === value) || null

  useEffect(() => {
    function onDown(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 50)
    // Names that start with what was typed win over mid-word matches.
    return options
      .filter((o) => o.search.includes(q))
      .sort((a, b) => (b.label.toLowerCase().startsWith(q) ? 1 : 0) - (a.label.toLowerCase().startsWith(q) ? 1 : 0))
      .slice(0, 50)
  }, [options, query])

  useEffect(() => { setActive(0) }, [query, open])
  useEffect(() => { listRef.current?.querySelector('[data-active="1"]')?.scrollIntoView({ block: 'nearest' }) }, [active, open])

  function choose(o) {
    onChange(o.value)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setActive((i) => Math.min(matches.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter') {
      // Never let a pick submit the form underneath.
      if (open && matches[active]) { e.preventDefault(); choose(matches[active]) }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          className={`${inp} pl-9 ${selected && !open ? 'pr-8' : ''}`}
          value={open ? query : (selected?.label ?? '')}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={onKeyDown}
          placeholder="Type a company or person's name…"
          autoComplete="off"
        />
        {selected && !open && (
          <button type="button" onClick={() => { onChange(''); setQuery('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" title="Clear">
            <X size={14} />
          </button>
        )}
      </div>
      {selected && !open && selected.sub && <p className="text-xs text-muted-foreground mt-1">{selected.sub}</p>}
      {open && (
        <div ref={listRef} className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">No company or member matches “{query.trim()}”.</div>
          ) : matches.map((o, i) => (
            <button type="button" key={o.value} data-active={i === active ? '1' : '0'}
              onMouseEnter={() => setActive(i)} onClick={() => choose(o)}
              className={`w-full text-left px-3 py-2 text-sm ${i === active ? 'bg-muted' : ''} ${o.value === value ? 'font-semibold' : ''}`}>
              <div className="text-foreground">{o.label}</div>
              {o.sub && <div className="text-xs text-muted-foreground">{o.sub}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MailRegister() {
  const { tenants, members = [], settings } = useOutletContext()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('awaiting')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  // addressee: 'c:<tenantId>' (company) or 'm:<memberId>' (individual member)
  const [form, setForm] = useState({ addressee: '', type: 'mail', description: '', notify: true })

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('mail_items').select('data').order('updated_at', { ascending: false })
    setRows((data ?? []).map((r) => r.data).filter(Boolean))
    setLoading(false)
  }

  async function persist(item) {
    await supabase.from('mail_items').upsert({ id: item.id, data: item, updated_at: nowIso() })
    setRows((prev) => (prev.some((r) => r.id === item.id) ? prev.map((r) => (r.id === item.id ? item : r)) : [item, ...prev]))
  }

  async function logItem(e) {
    e.preventDefault()
    if (!form.addressee) { alert('Choose who the item is addressed to.'); return }
    setSaving(true)
    try {
      // Resolve the addressee: a specific member, or the company generally.
      const [kind, id] = form.addressee.split(':')
      const member = kind === 'm' ? members.find((m) => m.id === id) : null
      const tenant = tenants.find((t) => t.id === (member ? member.companyId : id))
      const addresseeName = member?.name || tenant?.businessName || ''
      // Company-addressed items fall back to the billing person's email when
      // the company record has none.
      const email = member?.email || billingEmailFor(tenant, members)
      const first = (member?.name || tenant?.contactName || '').split(' ')[0]

      const item = {
        id: `mail${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId: tenant?.id ?? '',
        companyName: tenant?.businessName ?? '',
        memberId: member?.id ?? null,
        addresseeName,
        type: form.type,
        description: form.description.trim(),
        status: 'awaiting',
        loggedAt: nowIso(),
      }
      if (form.notify && email) {
        try {
          await sendEmail({
            to: email,
            subject: item.type === 'parcel'
              ? `📦 A parcel has arrived for you at ${settings?.company?.name || 'Hexa Space'}`
              : `📬 You've got mail at ${settings?.company?.name || 'Hexa Space'}`,
            html: mailArrivedEmailHtml({ item, addresseeFirst: first, settings }),
            settings, tenantId: tenant?.id, emailType: 'mail_arrived',
          })
          item.notifiedAt = nowIso()
        } catch (err) { console.error('Mail notification failed:', err) }
      }
      await persist(item)
      logAudit('create', 'mail', item.id, addresseeName || item.companyId, `${item.type} logged${item.notifiedAt ? ' + notified' : ''}`)
      setShowForm(false)
      setForm({ addressee: '', type: 'mail', description: '', notify: true })
    } finally { setSaving(false) }
  }

  async function markCollected(item) {
    await persist({ ...item, status: 'collected', collectedAt: nowIso() })
    logAudit('update', 'mail', item.id, item.companyName, 'collected')
  }

  async function remove(item) {
    if (!confirm('Delete this mail item?')) return
    await supabase.from('mail_items').delete().eq('id', item.id)
    setRows((prev) => prev.filter((r) => r.id !== item.id))
  }

  // One flat list for the picker — companies and members searchable together by
  // name, contact or email.
  const addresseeOptions = useMemo(() => {
    const companyNameById = new Map((tenants ?? []).map((t) => [t.id, t.businessName]))
    const companies = [...(tenants ?? [])]
      .filter((t) => t.businessName)
      .sort((a, b) => a.businessName.localeCompare(b.businessName))
      .map((t) => ({
        value: `c:${t.id}`,
        label: t.businessName,
        sub: 'Company',
        search: `${t.businessName} ${t.contactName || ''} ${t.email || ''}`.toLowerCase(),
      }))
    const people = [...(members ?? [])]
      .filter((m) => m.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => {
        const company = companyNameById.get(m.companyId) || ''
        return {
          value: `m:${m.id}`,
          label: m.name,
          sub: company ? `Member · ${company}` : 'Member',
          search: `${m.name} ${m.email || ''} ${company}`.toLowerCase(),
        }
      })
    return [...companies, ...people]
  }, [tenants, members])

  const filtered = rows.filter((r) => (filter === 'all' ? true : r.status === filter))
  const awaitingCount = rows.filter((r) => r.status === 'awaiting').length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-foreground">Mail &amp; Deliveries</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90">
          <Plus size={15} /> Log item
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Log incoming mail and parcels — the member is emailed to collect from reception and the item shows on their portal until collected.
        {awaitingCount > 0 && <span className="ml-2 text-amber-600 font-medium">{awaitingCount} awaiting pickup</span>}
      </p>

      <div className="flex items-center gap-2 mb-4">
        {[{ k: 'awaiting', l: 'Awaiting pickup' }, { k: 'collected', l: 'Collected' }, { k: 'all', l: 'All' }].map((t) => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === t.k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-input hover:border-muted-foreground'}`}>
            {t.l}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 text-muted-foreground hover:text-foreground" title="Refresh"><RefreshCw size={15} /></button>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {filter === 'awaiting' ? 'Nothing awaiting pickup — all clear.' : 'No items in this view.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Item</th>
                <th className="text-left px-4 py-2.5 font-medium">Addressed to</th>
                <th className="text-left px-4 py-2.5 font-medium">Logged</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-foreground">
                      {r.type === 'parcel' ? <Package size={14} className="text-muted-foreground" /> : <Mailbox size={14} className="text-muted-foreground" />}
                      <span className="capitalize font-medium">{r.type}</span>
                      {r.description && <span className="text-muted-foreground">· {r.description}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {r.addresseeName || r.companyName || r.companyId}
                    {r.memberId && r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.loggedAt ? format(new Date(r.loggedAt), 'dd/MM/yyyy HH:mm') : '—'}
                    {r.notifiedAt && <span className="ml-1.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Notified</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'awaiting'
                      ? <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">Awaiting pickup</span>
                      : <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700">Collected {r.collectedAt ? format(new Date(r.collectedAt), 'dd/MM') : ''}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {r.status === 'awaiting' && (
                        <button onClick={() => markCollected(r)} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded px-2.5 py-1 font-medium hover:bg-primary/90">
                          <Check size={12} /> Collected
                        </button>
                      )}
                      <button onClick={() => remove(r)} className="p-1 text-muted-foreground hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end">
          <div className="w-full max-w-sm bg-card h-full flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground">Log mail / delivery</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <form onSubmit={logItem} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className={lab}>Addressed to *</label>
                <AddresseePicker
                  options={addresseeOptions}
                  value={form.addressee}
                  onChange={(v) => setForm((p) => ({ ...p, addressee: v }))}
                />
              </div>
              <div>
                <label className={lab}>Type</label>
                <div className="flex gap-2">
                  {[{ k: 'mail', l: '📬 Mail' }, { k: 'parcel', l: '📦 Parcel' }].map((t) => (
                    <button type="button" key={t.k} onClick={() => setForm((p) => ({ ...p, type: t.k }))}
                      className={`flex-1 border rounded-md py-2 text-sm ${form.type === t.k ? 'border-primary bg-primary/5 font-semibold' : 'border-input text-muted-foreground hover:border-muted-foreground'}`}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lab}>Notes (sender, size…)</label>
                <input className={inp} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. ATO letter · Australia Post satchel" />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.notify} onChange={(e) => setForm((p) => ({ ...p, notify: e.target.checked }))} />
                Email the member now
              </label>
            </form>
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-input py-2.5 rounded-md text-sm font-medium hover:bg-muted/50">Cancel</button>
              <button onClick={logItem} disabled={saving} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-40">
                {saving ? 'Logging…' : 'Log item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
