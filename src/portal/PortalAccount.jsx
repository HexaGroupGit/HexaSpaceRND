import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Plus, FileText, X, Coins, Printer, KeyRound, UserMinus } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { authHeaders } from '../lib/apiFetch.js'
import { usePrintPin } from './usePrintPin.js'
import { DEPOSIT_STATUS, depositState } from '../lib/fobs.js'
import { Page, PageHeader, Card, SubTabs, Segmented, StatusBadge, Empty, Eyebrow, Field, Monogram, fmt, to12, bookingName } from './ui.jsx'

// ── Profile ──────────────────────────────────────────────────────────────────
function ProfileTab({ company, member }) {
  const [form, setForm] = useState({
    name: member?.name ?? '', phone: member?.phone ?? '', bio: member?.bio ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function save(e) {
    e.preventDefault()
    if (!member) return setMsg({ type: 'error', text: 'Profile editing is available to members only.' })
    setSaving(true); setMsg(null)
    const updated = { ...member, ...form }
    const { error } = await supabase.from('members').upsert({ id: member.id, data: updated, updated_at: new Date().toISOString() })
    setSaving(false)
    setMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Profile updated.' })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <form onSubmit={save}>
        <Eyebrow className="mb-4">Personal</Eyebrow>
        <Card className="p-7 space-y-5">
          <div className="flex items-center gap-4">
            <Monogram name={form.name || company.businessName} className="h-16 w-16" />
            <div className="font-display font-extralight text-2xl">{form.name || '—'}</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div><label className="hx-eyebrow block mb-1.5">Name</label><input className="hx-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="hx-eyebrow block mb-1.5">Phone</label><input className="hx-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <div><label className="hx-eyebrow block mb-1.5">Bio</label><textarea rows={3} className="hx-input" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} /></div>
          <Field label="Email" value={member?.email || company.email} />
          {msg && <div className={`text-sm px-3 py-2 border ${msg.type === 'success' ? 'text-hexa-green bg-hexa-green/5 border-hexa-green/30' : 'text-red-700 bg-red-50 border-red-200'}`}>{msg.text}</div>}
          <button type="submit" disabled={saving} className="hx-btn disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        </Card>
      </form>

      <div>
        <Eyebrow className="mb-4">Company</Eyebrow>
        <Card className="p-7 grid sm:grid-cols-2 gap-5">
          <Field label="Business name" value={company.businessName} />
          <Field label="ABN" value={company.abn} />
          <Field label="Industry" value={company.industry} />
          <Field label="Phone" value={company.phone} />
        </Card>
      </div>

      <FobsCard member={member} company={company} />

      <PrintingCard />

      <ChangePassword />
    </div>
  )
}

// The member's after-hours access devices + a self-serve request. RLS scopes
// reads/inserts to the member's own company.
function FobsCard({ member, company }) {
  const [rows, setRows] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('fob')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    const [a, r] = await Promise.all([
      supabase.from('fob_assignments').select('data'),
      supabase.from('fob_requests').select('data'),
    ])
    setRows((a.data ?? []).map((x) => x.data).filter((x) => x && !x.returnedAt && (member ? x.memberId === member.id : x.companyId === company?.id)))
    setPending((r.data ?? []).map((x) => x.data).filter((x) => x && x.status === 'pending' && (member ? x.memberId === member.id : true)))
    setLoading(false)
  }
  useEffect(() => { load() }, [member?.id, company?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function request() {
    if (!company?.id) return
    setBusy(true); setMsg(null)
    const rec = {
      id: `freq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      memberId: member?.id ?? null, memberName: member?.name ?? company?.contactName ?? '',
      companyId: company.id, companyName: company.businessName ?? '',
      type, note: note.trim(), status: 'pending', createdAt: new Date().toISOString(),
    }
    const { error } = await supabase.from('fob_requests').upsert({ id: rec.id, data: rec, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Request sent — our team will be in touch to arrange your device and deposit.' }); setNote(''); load() }
  }

  return (
    <div>
      <Eyebrow className="mb-4">Access &amp; Fobs</Eyebrow>
      <Card className="p-7 space-y-5">
        {loading ? <p className="hx-prose text-[13px]">Loading…</p>
          : rows.length === 0 ? <p className="hx-prose text-[13px]">You don't have any access devices on hand yet.</p>
          : (
            <div className="space-y-2.5">
              {rows.map((a) => {
                const ds = DEPOSIT_STATUS[depositState(a)] ?? {}
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 border border-ink/10 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <KeyRound size={15} className="text-hexa-green" />
                      <span className="font-mono text-[13px] text-ink">{a.serial}</span>
                      <span className="hx-prose text-[12px] capitalize">{a.type}</span>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${ds.cls || 'bg-gray-100 text-gray-600'}`}>{ds.label || 'Deposit'}</span>
                  </div>
                )
              })}
            </div>
          )}

        {pending.length > 0 && (
          <p className="hx-prose text-[12px] text-amber-700">{pending.length} request{pending.length > 1 ? 's' : ''} awaiting our team.</p>
        )}

        <div className="border-t border-ink/10 pt-4">
          <label className="hx-eyebrow block mb-2">Request a device</label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <select value={type} onChange={(e) => setType(e.target.value)} className="hx-input sm:w-40">
              <option value="fob">Fob — $100 deposit</option>
              <option value="remote">Remote — $200 deposit</option>
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="hx-input flex-1" />
            <button onClick={request} disabled={busy} className="hx-btn disabled:opacity-50 whitespace-nowrap">{busy ? 'Sending…' : 'Request'}</button>
          </div>
          <p className="hx-prose text-[11px] mt-2">A refundable deposit is invoiced when the device is issued, and refunded when it's returned.</p>
          {msg && <div className={`mt-2 text-[13px] px-3 py-2 border ${msg.type === 'success' ? 'text-hexa-green bg-hexa-green/5 border-hexa-green/30' : 'text-red-700 bg-red-50 border-red-200'}`}>{msg.text}</div>}
        </div>
      </Card>
    </div>
  )
}

// Member's print PIN (PaperCut Primary Card/Identity number). Only their own,
// via the owner-scoped endpoint. Renders nothing until/unless a PIN comes back.
function PrintingCard() {
  const pin = usePrintPin()
  if (!pin) return null
  return (
    <div>
      <Eyebrow className="mb-4">Printing</Eyebrow>
      <Card className="p-7 flex items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="h-11 w-11 shrink-0 bg-charcoal text-paper flex items-center justify-center"><Printer size={18} strokeWidth={1.4} /></span>
          <div>
            <div className="font-heading uppercase tracking-nav text-[11px] text-ink">Your print PIN</div>
            <div className="hx-prose text-[12px] mt-0.5">Type at any printer keypad to release your jobs, or tap your access pass.</div>
          </div>
        </div>
        <span className="font-mono text-3xl tracking-[0.25em] text-ink shrink-0">{pin}</span>
      </Card>
    </div>
  )
}

function ChangePassword() {
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  async function submit(e) {
    e.preventDefault()
    if (form.password.length < 8) return setMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
    if (form.password !== form.confirm) return setMsg({ type: 'error', text: 'Passwords do not match.' })
    setSaving(true); setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: form.password })
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Password updated.' }); setForm({ password: '', confirm: '' }) }
  }
  return (
    <div>
      <Eyebrow className="mb-4">Security</Eyebrow>
      <Card className="p-7">
        <div className="flex items-center gap-2 mb-5"><Lock size={15} className="text-portal-muted" /><span className="font-heading uppercase tracking-nav text-[11px]">Change password</span></div>
        <form onSubmit={submit} className="space-y-4 max-w-sm">
          {msg && <div className={`text-sm px-3 py-2 border ${msg.type === 'success' ? 'text-hexa-green bg-hexa-green/5 border-hexa-green/30' : 'text-red-700 bg-red-50 border-red-200'}`}>{msg.text}</div>}
          <div><label className="hx-eyebrow block mb-1.5">New password</label><input type="password" className="hx-input" value={form.password} minLength={8} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></div>
          <div><label className="hx-eyebrow block mb-1.5">Confirm password</label><input type="password" className="hx-input" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required /></div>
          <button type="submit" disabled={saving} className="hx-btn disabled:opacity-50">{saving ? 'Saving…' : 'Update password'}</button>
        </form>
      </Card>
    </div>
  )
}

// ── Team Members ─────────────────────────────────────────────────────────────
function TeamTab({ company, members, me }) {
  const [removedIds, setRemovedIds] = useState([])
  const team = members
    .filter(m => m.companyId === company.id && m.status !== 'Former' && !removedIds.includes(m.id))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [removing, setRemoving] = useState(null) // member id in flight

  async function remove(m) {
    if (!window.confirm(`Remove ${m.name || m.email} from your team? Their portal login and door access will be revoked.`)) return
    setRemoving(m.id); setMsg(null)
    try {
      const res = await fetch('/api/portal/remove-teammate', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ memberId: m.id }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(b.error || 'Could not remove the team member.')
      setRemovedIds(ids => [...ids, m.id])
      setMsg({ type: 'success', text: `${m.name || m.email} removed — portal access revoked and door access removal is underway.` })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally { setRemoving(null) }
  }

  async function invite(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      // Server-side (member-gated) teammate invite: creates the member record,
      // the auth user and the set-password email under our own company.
      const res = await fetch('/api/portal/add-teammate', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ companyId: company.id, name: form.name, email: form.email }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || 'Invite could not be sent (will work once deployed).')
      }
      setMsg({ type: 'success', text: `Invitation sent to ${form.email}.` })
      setForm({ name: '', email: '' }); setAdding(false)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally { setBusy(false) }
  }

  return (
    <div className="max-w-3xl space-y-5">
      {msg && <div className={`text-sm px-3 py-2 border ${msg.type === 'success' ? 'text-hexa-green bg-hexa-green/5 border-hexa-green/30' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>{msg.text}</div>}
      <div className="flex items-center justify-between">
        <Eyebrow>{team.length} team {team.length === 1 ? 'member' : 'members'}</Eyebrow>
        {!adding && <button onClick={() => setAdding(true)} className="hx-btn inline-flex"><Plus size={13} /> Add member</button>}
      </div>

      {adding && (
        <Card className="p-6">
          <form onSubmit={invite} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div><label className="hx-eyebrow block mb-1.5">Name</label><input className="hx-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><label className="hx-eyebrow block mb-1.5">Email</label><input type="email" className="hx-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
            <button type="submit" disabled={busy} className="hx-btn disabled:opacity-50">{busy ? 'Sending…' : 'Invite'}</button>
          </form>
          <p className="hx-prose text-[12px] mt-3">They'll receive an email to set their password and access the portal.</p>
        </Card>
      )}

      {team.length === 0 ? <Empty label="No team members yet." /> : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-ink/5">
            {team.map(m => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                <Monogram name={m.name} className="h-10 w-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-heading uppercase tracking-nav text-[11px] text-ink truncate">{m.name}</div>
                  <div className="hx-prose text-[13px] truncate">{m.email}</div>
                </div>
                <StatusBadge status={m.status === 'invited' ? 'pending' : 'active'} />
                {(m.email || '').toLowerCase() !== (me?.email || '').toLowerCase() && !m.billingPerson && (
                  <button onClick={() => remove(m)} disabled={removing === m.id} title="Remove from team"
                    className="text-portal-muted hover:text-red-700 disabled:opacity-40 shrink-0">
                    <UserMinus size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Bookings ─────────────────────────────────────────────────────────────────
function BookingsTab({ bookings, spaces }) {
  const [when, setWhen] = useState('upcoming')
  const todayStr = new Date().toISOString().split('T')[0]
  const list = [...bookings]
    .filter(b => b.date && (when === 'upcoming' ? b.date >= todayStr : b.date < todayStr))
    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')) * (when === 'upcoming' ? 1 : -1))
  return (
    <div className="max-w-3xl space-y-5">
      <Segmented options={[{ key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past' }]} active={when} onChange={setWhen} />
      {list.length === 0 ? <Empty label="No bookings to show." /> : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-ink/5">
            {list.map((b, i) => (
              <div key={b.id ?? i} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="font-heading uppercase tracking-nav text-[11px] text-ink">{bookingName(spaces, b)}</div>
                  <div className="hx-prose text-[13px]">{fmt(b.date)}{b.startTime ? ` · ${to12(b.startTime)}${b.endTime ? `–${to12(b.endTime)}` : ''}` : ''}</div>
                </div>
                {b.status && <StatusBadge status={b.status} />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Allowance ────────────────────────────────────────────────────────────────
function AllowanceTab({ member }) {
  const credits = member?.credits
  if (credits == null) return <Empty label="No allowance on file." sub="Credits included with your membership will appear here." />
  return (
    <div className="max-w-md">
      <Card className="p-8 text-center">
        <Coins size={22} className="mx-auto text-hexa-green" />
        <div className="hx-display text-4xl mt-4">{credits}</div>
        <p className="hx-prose mt-1">credits remaining</p>
        <p className="hx-prose text-[12px] mt-4 border-t border-ink/10 pt-4">Applies to meeting rooms, studios and one-off services.</p>
      </Card>
    </div>
  )
}

// ── Tickets ──────────────────────────────────────────────────────────────────
function TicketsTab() {
  return (
    <div className="max-w-2xl">
      <Empty label="No tickets to show." sub="Need a hand? Send us a message and we'll take care of it." />
      <div className="mt-5"><Link to="/messages" className="hx-btn inline-flex">Submit a ticket</Link></div>
    </div>
  )
}

// ── Terms & Conditions ───────────────────────────────────────────────────────
function TermsTab({ templates }) {
  const docs = (templates ?? []).filter(t => t.type === 'terms' || t.type === 'house-rules')
  const [view, setView] = useState(null)
  if (docs.length === 0) return <Empty label="No documents on file." />
  return (
    <div className="max-w-3xl">
      <Card className="overflow-hidden">
        <div className="divide-y divide-ink/5">
          {docs.map(t => (
            <button key={t.id} onClick={() => setView(t)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-bone transition-colors">
              <div className="flex items-center gap-3">
                <FileText size={15} className="text-portal-muted" />
                <div>
                  <div className="font-heading uppercase tracking-nav text-[11px] text-ink">{t.name}</div>
                  <div className="hx-prose text-[12px]">Version {t.version} · updated {fmt(t.updatedAt)}</div>
                </div>
              </div>
              <span className="hx-btn-ghost">View</span>
            </button>
          ))}
        </div>
      </Card>

      {view && (
        <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={() => setView(null)}>
          <div className="bg-paper max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink/10 sticky top-0 bg-paper">
              <div>
                <div className="font-heading uppercase tracking-nav text-[12px]">{view.name}</div>
                <div className="hx-prose text-[12px]">Version {view.version}</div>
              </div>
              <button onClick={() => setView(null)} className="text-portal-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="template-html-body px-6 py-6" dangerouslySetInnerHTML={{ __html: view.content }} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function PortalAccount({ data }) {
  const { company, member, members, bookings, templates, spaces } = data
  const [tab, setTab] = useState('profile')
  return (
    <Page>
      <PageHeader kicker="Account" title="Account" />
      <SubTabs
        tabs={[
          { key: 'profile', label: 'Profile' },
          { key: 'team', label: 'Team Members' },
          { key: 'bookings', label: 'Bookings' },
          { key: 'allowance', label: 'Allowance' },
          { key: 'tickets', label: 'Tickets' },
          { key: 'terms', label: 'Terms & Conditions' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'profile' && <ProfileTab company={company} member={member} />}
      {tab === 'team' && <TeamTab company={company} members={members} me={member} />}
      {tab === 'bookings' && <BookingsTab bookings={bookings} spaces={spaces} />}
      {tab === 'allowance' && <AllowanceTab member={member} />}
      {tab === 'tickets' && <TicketsTab />}
      {tab === 'terms' && <TermsTab templates={templates} />}
    </Page>
  )
}
