import { useMemo, useState, useEffect } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Plus, X, CheckCircle2, XCircle, Clock, ShieldCheck, Info, Undo2 } from 'lucide-react'
import { getSession } from '../lib/auth.js'
import {
  managerList, isPricingManager, approvalsRequired, canDecide, applyDecision,
  decisionsFor, approvalsOf, discountPct, concessionValue,
  APPROVER_GUIDE, REQUESTER_GUIDE,
} from '../lib/pricingApproval.js'

const money = (v) => `$${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
const dmy = (d) => { try { return format(parseISO(d), 'dd/MM/yyyy') } catch { return '—' } }
const dmyt = (d) => { try { return format(parseISO(d), 'dd/MM/yyyy HH:mm') } catch { return '—' } }

const STATUS_STYLE = {
  pending:   { cls: 'bg-amber-50 text-amber-700 border border-amber-200',  icon: Clock,        label: 'Awaiting approval' },
  approved:  { cls: 'bg-green-50 text-green-700 border border-green-200',  icon: CheckCircle2, label: 'Approved' },
  declined:  { cls: 'bg-red-50 text-red-700 border border-red-200',        icon: XCircle,      label: 'Declined' },
  withdrawn: { cls: 'bg-gray-100 text-gray-600 border border-gray-200',    icon: Undo2,        label: 'Withdrawn' },
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${s.cls}`}>
      <Icon size={13} />{s.label}
    </span>
  )
}

const EMPTY = {
  spaceId: '', companyName: '', contactEmail: '',
  listRent: '', proposedRent: '', termMonths: 12, rentFreeMonths: 0,
  incentives: '', justification: '',
}

export default function PricingRequests() {
  const ctx = useOutletContext()
  const { spaces, settings, pricingRequests, addPricingRequest, updatePricingRequest } = ctx
  const [params, setParams] = useSearchParams()
  const [me, setMe] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [openId, setOpenId] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [reasoning, setReasoning] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { getSession().then((s) => setMe(s?.user?.email ?? '')) }, [])

  // Deep link from Spaces: /pricing-requests?space=<id> opens the form primed.
  useEffect(() => {
    const sid = params.get('space')
    if (!sid) return
    const sp = (spaces ?? []).find((s) => s.id === sid)
    setForm({ ...EMPTY, spaceId: sid, listRent: sp?.monthlyRate ?? '' })
    setShowForm(true)
    setParams({}, { replace: true })
  }, [params, spaces, setParams])

  const iAmManager = isPricingManager(me, settings)
  const managers = managerList(settings)
  const need = approvalsRequired(settings)

  const rows = useMemo(() => (pricingRequests ?? [])
    .filter((r) => filter === 'all' || r.status === filter)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))),
  [pricingRequests, filter])

  const counts = useMemo(() => {
    const c = { all: (pricingRequests ?? []).length, pending: 0, approved: 0, declined: 0, withdrawn: 0 }
    for (const r of pricingRequests ?? []) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [pricingRequests])

  const open = (pricingRequests ?? []).find((r) => r.id === openId) ?? null
  const gate = open ? canDecide(open, me, settings) : { ok: false, why: '' }
  const spaceName = (id) => (spaces ?? []).find((s) => s.id === id)?.unitNumber ?? id

  function submit(e) {
    e.preventDefault()
    setErr('')
    if (!form.spaceId) return setErr('Choose the space this pricing is for.')
    if (!form.companyName.trim()) return setErr('Who is the pricing for? Enter the company or prospect name.')
    if (!Number(form.proposedRent)) return setErr('Enter the proposed monthly rent (ex GST).')
    if (!form.justification.trim()) return setErr('Add a short justification — this is what the manager approves against.')
    const now = new Date().toISOString()
    addPricingRequest({
      id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ref: `PR-${Math.floor(100000 + Math.random() * 900000)}`,
      spaceId: form.spaceId,
      spaceName: spaceName(form.spaceId),
      companyName: form.companyName.trim(),
      contactEmail: form.contactEmail.trim(),
      listRent: Number(form.listRent || 0),
      proposedRent: Number(form.proposedRent),
      termMonths: Number(form.termMonths || 0),
      rentFreeMonths: Number(form.rentFreeMonths || 0),
      incentives: form.incentives.trim(),
      justification: form.justification.trim(),
      requestedBy: me,
      status: 'pending',
      decisions: [],
      createdAt: now,
      updatedAt: now,
    })
    setForm(EMPTY)
    setShowForm(false)
    setFilter('pending')
  }

  function decide(decision) {
    setErr('')
    if (!gate.ok) return setErr(gate.why)
    if (!reasoning.trim()) return setErr('Reasoning is required — record why you are approving or declining.')
    updatePricingRequest(open.id, applyDecision(open, { decision, by: me, reasoning, settings }))
    setReasoning('')
  }

  function withdraw(r) {
    if (!window.confirm(`Withdraw ${r.ref}? It will no longer be waiting on a manager.`)) return
    updatePricingRequest(r.id, { ...r, status: 'withdrawn', closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    setOpenId(null)
  }

  const officeish = (spaces ?? []).filter((s) => ['office', 'warehouse', 'desk', 'popup'].includes(s.type))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pricing Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Staff propose a rate for a space; {need === 1 ? 'one manager' : `${need} managers`} must approve it with reasoning.
          </p>
        </div>
        <button onClick={() => { setForm(EMPTY); setShowForm(true) }}
          className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-md text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New pricing request
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck size={14} />
        <span>Approvers: {managers.join(', ')}</span>
        {iAmManager && <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-medium">You can approve</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {['pending', 'approved', 'declined', 'withdrawn', 'all'].map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-md text-sm border capitalize ${filter === k ? 'bg-foreground text-background border-foreground' : 'border-input hover:bg-muted/50'}`}>
            {k} {counts[k] ? <span className="opacity-70">({counts[k]})</span> : null}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="border border-border rounded-md p-10 text-center text-sm text-muted-foreground">
          Nothing {filter === 'all' ? 'here' : filter} yet.
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Ref</th><th className="px-4 py-3">Space</th>
                <th className="px-4 py-3">For</th><th className="px-4 py-3 text-right">List</th>
                <th className="px-4 py-3 text-right">Proposed</th><th className="px-4 py-3 text-right">Disc.</th>
                <th className="px-4 py-3">Raised by</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => { setOpenId(r.id); setReasoning('') }}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer">
                  <td className="px-4 py-3 font-medium">{r.ref}</td>
                  <td className="px-4 py-3">{r.spaceName || spaceName(r.spaceId)}</td>
                  <td className="px-4 py-3">{r.companyName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.listRent ? money(r.listRent) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{money(r.proposedRent)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{discountPct(r) ? `${discountPct(r)}%` : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.requestedBy}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New request ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-background w-full max-w-2xl rounded-md my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold">New pricing request</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="px-6 py-5 space-y-4">
              <div className="bg-muted/40 border border-border rounded-md p-4">
                <p className="text-xs font-medium mb-2 flex items-center gap-1.5"><Info size={13} /> Before you raise this</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  {REQUESTER_GUIDE.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Space *</label>
                  <select value={form.spaceId} className="w-full border border-input rounded-md px-3 py-2 text-sm"
                    onChange={(e) => {
                      const sp = officeish.find((s) => s.id === e.target.value)
                      setForm({ ...form, spaceId: e.target.value, listRent: sp?.monthlyRate ?? '' })
                    }}>
                    <option value="">Choose a space…</option>
                    {officeish.map((s) => <option key={s.id} value={s.id}>{s.unitNumber} — {s.type}{s.monthlyRate ? ` (${money(s.monthlyRate)})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Company / prospect *</label>
                  <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm" placeholder="e.g. Acme Pty Ltd" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Contact email</label>
                  <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm" placeholder="optional" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">List rent (ex GST/mo)</label>
                  <input type="number" value={form.listRent} onChange={(e) => setForm({ ...form, listRent: e.target.value })}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Proposed rent (ex GST/mo) *</label>
                  <input type="number" value={form.proposedRent} onChange={(e) => setForm({ ...form, proposedRent: e.target.value })}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Term (months)</label>
                    <input type="number" value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                      className="w-full border border-input rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Rent-free months</label>
                    <input type="number" value={form.rentFreeMonths} onChange={(e) => setForm({ ...form, rentFreeMonths: e.target.value })}
                      className="w-full border border-input rounded-md px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Other incentives</label>
                <input value={form.incentives} onChange={(e) => setForm({ ...form, incentives: e.target.value })}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm" placeholder="e.g. fit-out contribution, parking included" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Justification *</label>
                <textarea rows={3} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm"
                  placeholder="What are you trying to win? Competing offer, term length, a space that's been vacant…" />
              </div>
              {Number(form.proposedRent) > 0 && (
                <div className="text-xs text-muted-foreground border border-border rounded-md p-3">
                  Discount <strong>{discountPct({ listRent: form.listRent, proposedRent: form.proposedRent })}%</strong> ·
                  concession over the term <strong>{money(concessionValue({ ...form }))}</strong> ex GST
                </div>
              )}
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-input rounded-md hover:bg-muted/50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-foreground text-background rounded-md hover:opacity-90">Send for approval</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail + decision ───────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpenId(null)}>
          <div className="bg-background w-full max-w-2xl rounded-md my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-border">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold">{open.ref}</h2><StatusPill status={open.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {open.spaceName || spaceName(open.spaceId)} · {open.companyName}
                </p>
              </div>
              <button onClick={() => setOpenId(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">List rent</p><p className="font-medium">{open.listRent ? money(open.listRent) : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Proposed</p><p className="font-medium">{money(open.proposedRent)}{discountPct(open) ? ` (−${discountPct(open)}%)` : ''}</p></div>
                <div><p className="text-xs text-muted-foreground">Term</p><p className="font-medium">{open.termMonths || '—'} months{open.rentFreeMonths ? ` · ${open.rentFreeMonths} rent-free` : ''}</p></div>
              </div>
              {concessionValue(open) > 0 && (
                <div className="text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-md px-4 py-3">
                  Total concession over the term: <strong>{money(concessionValue(open))}</strong> ex GST
                </div>
              )}
              {open.incentives && <div><p className="text-xs text-muted-foreground mb-1">Other incentives</p><p className="text-sm">{open.incentives}</p></div>}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Justification</p>
                <p className="text-sm whitespace-pre-wrap">{open.justification}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Raised by {open.requestedBy} on {dmy(open.createdAt)}
                {open.contactEmail ? ` · contact ${open.contactEmail}` : ''}
              </p>

              {decisionsFor(open).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">Decisions ({approvalsOf(open).length}/{need} approvals)</p>
                  {decisionsFor(open).map((d, i) => (
                    <div key={i} className={`border rounded-md px-4 py-3 text-sm ${d.decision === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="font-medium flex items-center gap-1.5">
                        {d.decision === 'approved' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {d.decision === 'approved' ? 'Approved' : 'Declined'} by {d.by}
                        <span className="font-normal text-muted-foreground">· {dmyt(d.at)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{d.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}

              {open.status === 'pending' && (
                gate.ok ? (
                  <div className="border border-border rounded-md p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-1.5"><ShieldCheck size={15} /> Your decision</p>
                    <div className="bg-muted/40 rounded-md p-3">
                      <p className="text-xs font-medium mb-1.5">What to check</p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                        {APPROVER_GUIDE.map((g, i) => <li key={i}>{g}</li>)}
                      </ul>
                    </div>
                    <textarea rows={3} value={reasoning} onChange={(e) => setReasoning(e.target.value)}
                      className="w-full border border-input rounded-md px-3 py-2 text-sm"
                      placeholder="Reasoning (required) — why this rate is or isn't acceptable, and what would be." />
                    {err && <p className="text-sm text-red-600">{err}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => decide('approved')} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:opacity-90">
                        <CheckCircle2 size={15} /> Approve
                      </button>
                      <button onClick={() => decide('declined')} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:opacity-90">
                        <XCircle size={15} /> Decline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-border rounded-md px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
                    <Info size={15} className="mt-0.5 shrink-0" /><span>{gate.why}</span>
                  </div>
                )
              )}

              {open.status === 'pending' && (
                <button onClick={() => withdraw(open)} className="text-xs text-muted-foreground underline hover:text-foreground">Withdraw this request</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
