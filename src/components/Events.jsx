import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase.js'
import { fetchSanityEvents } from '../lib/sanity.js'
import { Plus, Trash2, Edit2, X, Calendar, ExternalLink, RefreshCw } from 'lucide-react'

function fmt(dateStr) {
  try { return format(parseISO(dateStr), 'dd/MM/yyyy') } catch { return dateStr }
}

const EMPTY = {
  title: '',
  date: '',
  time: '',
  location: '',
  description: '',
  imageUrl: '',
  link: '',
}

export default function Events() {
  const [events, setEvents] = useState([])
  const [sanityEvents, setSanityEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { mode: 'add' | 'edit', event }
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [localRes, sanity] = await Promise.all([
      supabase.from('portal_events').select('data'),
      fetchSanityEvents(),
    ])
    const all = (localRes.data ?? []).map(r => r.data)
    all.sort((a, b) => new Date(b.date) - new Date(a.date))
    setEvents(all)
    setSanityEvents(sanity.sort((a, b) => new Date(b.date) - new Date(a.date)))
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY)
    setModal({ mode: 'add' })
  }

  function openEdit(ev) {
    setForm({ ...EMPTY, ...ev })
    setModal({ mode: 'edit', event: ev })
  }

  async function save() {
    if (!form.title || !form.date) return
    setSaving(true)
    const isNew = modal.mode === 'add'
    const id = isNew ? `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : modal.event.id
    const payload = { ...form, id }
    await supabase.from('portal_events').upsert({ id, data: payload })
    await load()
    setModal(null)
    setSaving(false)

    // Notify active portal members about new events only (not edits)
    if (isNew) {
      fetch('/api/portal/notify-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: payload }),
      }).catch(() => {})
    }
  }

  async function remove(id) {
    if (!confirm('Delete this event?')) return
    await supabase.from('portal_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-400 mt-0.5">Synced from hexahub.com.au + portal-only events</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-md px-3 py-2 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-black text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-gray-800">
            <Plus size={15} /> Add Portal Event
          </button>
        </div>
      </div>

      {/* Sanity events — live from hexahub.com.au */}
      {sanityEvents.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">From hexahub.com.au</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Live from Sanity</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sanityEvents.map(ev => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{ev.title}</div>
                      {ev.description && <div className="text-xs text-gray-400 truncate max-w-xs">{ev.description}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{ev.date ? fmt(ev.date) : '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{ev.location || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <a href={ev.link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 justify-end">
                        <ExternalLink size={12} /> View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portal-only local events */}
      <div className="mb-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Portal-Only Events</h2>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading…</div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg py-10 text-center">
          <Calendar size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-3">No portal-only events. Events from hexahub.com.au appear above automatically.</p>
          <button onClick={openAdd} className="bg-black text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-gray-800">
            + Add Portal Event
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Link</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map(ev => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{ev.title}</div>
                    {ev.description && (
                      <div className="text-xs text-gray-400 truncate max-w-xs">{ev.description}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {fmt(ev.date)}{ev.time ? ` · ${ev.time}` : ''}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{ev.location || '—'}</td>
                  <td className="px-5 py-3">
                    {ev.link ? (
                      <a
                        href={ev.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
                      >
                        <ExternalLink size={12} />
                        Link
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(ev)} className="text-gray-400 hover:text-gray-700 p-1">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => remove(ev.id)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {modal.mode === 'add' ? 'Add Event' : 'Edit Event'}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Event title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
                  <input
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="e.g. 6:00 PM"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                <input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="7 Distribution Circuit, Huntingdale"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  placeholder="Brief description of the event…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Image URL</label>
                <input
                  value={form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Link</label>
                <input
                  value={form.link}
                  onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="https://www.hexahub.com.au/events/..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.title || !form.date}
                className="px-4 py-2 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Add Event' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
