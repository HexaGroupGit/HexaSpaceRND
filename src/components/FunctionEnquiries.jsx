import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { format } from 'date-fns'
import { Mail, UserPlus, CheckCircle2, X, RefreshCw, CalendarDays, Users, ExternalLink } from 'lucide-react'
import { STAGES, money, computeQuote } from '../lib/functionBooking.js'
import { findFunctionSpace } from '../portal/functionSpace.js'
import { sendBrochure, sendBookingInvite, approveFunctionBooking, declineFunctionBooking } from '../lib/functionActions.js'

const today = () => new Date().toISOString().split('T')[0]
function StageBadge({ stage }) {
  const s = STAGES[stage] ?? { label: stage, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
}
function fmtDate(d) { if (!d) return '—'; try { return format(new Date(`${d}T00:00:00`), 'EEE d MMM yyyy') } catch { return d } }

export default function FunctionEnquiries({ store }) {
  const settings = store?.settings
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('function_bookings').select('data').order('updated_at', { ascending: false })
    setRows((data ?? []).map((r) => r.data).filter(Boolean))
    setLoading(false)
  }
  function replace(rec) {
    setRows((prev) => prev.map((r) => (r.id === rec.id ? rec : r)))
    if (selected?.id === rec.id) setSelected(rec)
  }
  async function open(b) {
    setSelected(b)
    if (!b.read) { const upd = { ...b, read: true }; await supabase.from('function_bookings').update({ data: upd, updated_at: new Date().toISOString() }).eq('id', b.id); replace(upd) }
  }

  const funnel = rows.filter((b) => ['enquiry', 'quoted', 'invited', 'pending_approval', 'signed'].includes(b.stage))
  const unread = rows.filter((b) => !b.read && ['enquiry', 'pending_approval', 'signed'].includes(b.stage)).length

  async function run(key, fn) {
    setBusy(key)
    try { const updated = await fn(); if (updated) replace(updated) } finally { setBusy('') }
  }

  return (
    <div className="flex gap-0 -m-1">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{funnel.length} in the funnel{unread > 0 && <span className="ml-2 text-blue-600 font-medium">{unread} new</span>}</p>
          <button onClick={load} className="p-1.5 text-muted-foreground hover:text-foreground" title="Refresh"><RefreshCw size={15} /></button>
        </div>
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {loading ? <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
            : funnel.length === 0 ? <div className="p-10 text-center text-muted-foreground text-sm">No function enquiries yet.</div>
            : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                  <tr><th className="text-left px-4 py-2.5 font-medium">Enquirer</th><th className="text-left px-4 py-2.5 font-medium">Event</th><th className="text-left px-4 py-2.5 font-medium">Date</th><th className="text-left px-4 py-2.5 font-medium">Stage</th></tr>
                </thead>
                <tbody>
                  {funnel.map((b) => (
                    <tr key={b.id} onClick={() => open(b)} className={`border-b border-border/60 cursor-pointer hover:bg-muted/40 ${selected?.id === b.id ? 'bg-muted/60' : ''}`}>
                      <td className="px-4 py-3"><div className="font-medium text-foreground flex items-center gap-2">{!b.read && ['enquiry', 'pending_approval', 'signed'].includes(b.stage) && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}{b.organisation || b.name || '—'}</div><div className="text-xs text-muted-foreground">{b.email}</div></td>
                      <td className="px-4 py-3 text-foreground">{b.eventName || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(b.eventDate)}</td>
                      <td className="px-4 py-3"><StageBadge stage={b.stage} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {selected && (
        <div className="w-full md:w-[380px] border-l border-border bg-card ml-4 rounded-lg flex flex-col self-start max-h-[75vh] overflow-hidden">
          <div className="flex items-start justify-between px-5 py-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1"><span className="font-mono text-xs text-muted-foreground">{selected.ref}</span><StageBadge stage={selected.stage} /></div>
              <div className="font-bold text-foreground">{selected.organisation || selected.name || 'Enquiry'}</div>
              <div className="text-sm text-muted-foreground">{selected.email}{selected.phone ? ` · ${selected.phone}` : ''}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-muted-foreground uppercase">Event</dt><dd className="text-foreground">{selected.eventName || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground uppercase">Type</dt><dd className="text-foreground">{selected.eventType || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground uppercase">Date</dt><dd className="text-foreground flex items-center gap-1"><CalendarDays size={12} />{fmtDate(selected.eventDate)}</dd></div>
              <div><dt className="text-xs text-muted-foreground uppercase">Time</dt><dd className="text-foreground">{selected.startTime || '—'}{selected.endTime ? `–${selected.endTime}` : ''}</dd></div>
              <div><dt className="text-xs text-muted-foreground uppercase">Guests</dt><dd className="text-foreground flex items-center gap-1"><Users size={12} />{selected.guests || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground uppercase">Source</dt><dd className="text-foreground capitalize">{selected.source || '—'}</dd></div>
            </dl>
            {selected.eventDate && selected.startTime && selected.endTime && (
              <div className="text-sm text-muted-foreground">Indicative total: <strong className="text-foreground">{money((selected.quote || computeQuote({ ...selected, bookedOn: today() })).total)}</strong></div>
            )}
            {selected.additionalRequirements && <div><dt className="text-xs text-muted-foreground uppercase mb-1">Requirements</dt><dd className="text-foreground whitespace-pre-wrap">{selected.additionalRequirements}</dd></div>}
            {selected.brochureSentAt && <div className="text-xs text-muted-foreground">Brochure sent {format(new Date(selected.brochureSentAt), 'dd MMM')}</div>}
            {selected.inviteSentAt && <div className="text-xs text-indigo-600">Portal invite sent {format(new Date(selected.inviteSentAt), 'dd MMM')}</div>}
            {selected.signedAt && <div className="text-xs text-yellow-700">Signed {format(new Date(selected.signedAt), 'dd MMM')} by {selected.signerName}</div>}

            <div className="space-y-2 pt-1">
              {['enquiry', 'quoted', 'invited'].includes(selected.stage) && (
                <>
                  <button disabled={busy} onClick={() => run('brochure', () => sendBrochure(selected))} className="w-full flex items-center justify-center gap-2 border border-input py-2.5 rounded-md text-sm font-medium hover:bg-muted/50 disabled:opacity-40"><Mail size={14} /> {busy === 'brochure' ? 'Sending…' : 'Send brochure & info'}</button>
                  <button disabled={busy} onClick={() => run('invite', () => sendBookingInvite({ store, booking: selected, settings }))} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"><UserPlus size={14} /> {busy === 'invite' ? 'Sending…' : selected.inviteSentAt ? 'Resend booking invite' : 'Send booking invite'}</button>
                </>
              )}
              {['pending_approval', 'signed'].includes(selected.stage) && (
                <>
                  <button disabled={busy} onClick={() => run('approve', () => approveFunctionBooking({ store, booking: selected, findFunctionSpace }))} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"><CheckCircle2 size={14} /> {busy === 'approve' ? 'Approving…' : 'Approve & raise invoices'}</button>
                  <button disabled={busy} onClick={() => { if (confirm('Decline this booking?')) run('decline', () => declineFunctionBooking({ store, booking: selected })) }} className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 py-2.5 rounded-md text-sm font-medium hover:bg-red-50 disabled:opacity-40"><X size={14} /> Decline</button>
                </>
              )}
              <a href="/function-bookings" className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1"><ExternalLink size={12} /> Manage in Function Space Bookings</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
