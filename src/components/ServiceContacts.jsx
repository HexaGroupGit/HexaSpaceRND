import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Phone, Mail, Pencil, Trash2, X, Search, LifeBuoy, PhoneCall } from 'lucide-react'

// Who to call when something breaks. Kept in global settings so a correction by
// one staff member is the number everyone else sees.
export const DEFAULT_SERVICE_CONTACTS = [
  { id: 'sc-it',       service: 'IT Support',                       company: '',                           person: 'Eric', phone: '0431 133 988' },
  { id: 'sc-aircon',   service: 'Aircon Support',                   company: 'Custom Servicing',           person: '',     phone: '03 9585 2744' },
  { id: 'sc-electric', service: 'Electrician',                      company: '',                           person: '',     phone: '0458 011 109' },
  { id: 'sc-printer',  service: 'Level 2 Printer Support',          company: 'BBC',                        person: 'Jiby', phone: '0429 930 464' },
  { id: 'sc-cleaning', service: 'Toilet Paper & Cleaning Supplies', company: 'House of Cleaning Supplies',  person: '',     phone: '0419 975 670' },
]

const EMPTY = { service: '', company: '', person: '', phone: '', email: '', notes: '' }

// tel: links choke on spaces — strip everything but the diallable characters.
const dialable = (phone) => String(phone || '').replace(/[^\d+]/g, '')

export default function ServiceContacts() {
  const { settings = {}, updateSettings } = useOutletContext()
  const contacts = settings.serviceContacts ?? DEFAULT_SERVICE_CONTACTS

  const [editing, setEditing] = useState(null) // contact id, or 'new'
  const [form, setForm] = useState(EMPTY)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const shown = q
    ? contacts.filter((c) =>
        [c.service, c.company, c.person, c.phone, c.email, c.notes]
          .some((v) => String(v || '').toLowerCase().includes(q)))
    : contacts

  function save(e) {
    e.preventDefault()
    const clean = { ...form, service: form.service.trim(), phone: form.phone.trim() }
    if (!clean.service || !clean.phone) return
    const next = editing === 'new'
      ? [...contacts, { ...clean, id: `sc-${Date.now()}` }]
      : contacts.map((c) => (c.id === editing ? { ...c, ...clean } : c))
    updateSettings({ serviceContacts: next })
    setEditing(null); setForm(EMPTY)
  }

  function remove(c) {
    if (!confirm(`Remove "${c.service}" from the contact list?`)) return
    updateSettings({ serviceContacts: contacts.filter((x) => x.id !== c.id) })
  }

  const input = 'w-full border border-input rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <PhoneCall size={22} /> Contacts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {contacts.length} service {contacts.length === 1 ? 'contact' : 'contacts'} — who to call when something needs fixing or restocking
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 text-xs text-blue-800 flex gap-2">
        <LifeBuoy size={15} className="shrink-0 mt-0.5" />
        <div>Tap a number to dial it. Anyone can add or correct a contact here — the change is shared with the whole team.</div>
      </div>

      <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className={`${input} pl-9`}
          />
        </div>
        <button
          onClick={() => { setForm(EMPTY); setEditing('new') }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus size={15} /> Add contact
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="bg-card border border-border rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{editing === 'new' ? 'New contact' : 'Edit contact'}</h3>
            <button type="button" onClick={() => { setEditing(null); setForm(EMPTY) }} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">What it&apos;s for *</label>
              <input required value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="e.g. Plumber" className={input} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Phone *</label>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0400 000 000" className={input} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Company</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={input} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Contact person</label>
              <input value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} className={input} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Hours, account number, what they cover…" className={input} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => { setEditing(null); setForm(EMPTY) }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">Save</button>
          </div>
        </form>
      )}

      {shown.length === 0 ? (
        <div className="bg-card border border-dashed border-input rounded-xl shadow-sm p-12 text-center">
          <Phone size={26} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{contacts.length ? 'No contact matches that search.' : 'No contacts yet. Add the first one.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <div className="font-semibold text-foreground">{c.service}</div>
                <div className="text-xs text-muted-foreground">
                  {[c.company, c.person].filter(Boolean).join(' · ') || 'No company listed'}
                  {c.notes && <span className="block mt-0.5">{c.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.email && (
                  <a href={`mailto:${c.email}`} title={c.email} className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted">
                    <Mail size={15} />
                  </a>
                )}
                <a
                  href={`tel:${dialable(c.phone)}`}
                  className="flex items-center gap-2 bg-muted border border-border px-3 py-2 rounded-md text-sm font-semibold text-foreground hover:bg-accent tabular-nums"
                >
                  <Phone size={14} /> {c.phone}
                </a>
                <button onClick={() => { setForm({ ...EMPTY, ...c }); setEditing(c.id) }} title="Edit" className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                  <Pencil size={15} />
                </button>
                <button onClick={() => remove(c)} title="Remove" className="p-2 rounded-md text-muted-foreground hover:text-red-600 hover:bg-muted">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
