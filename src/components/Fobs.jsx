import SearchSelect from './SearchSelect.jsx'
import { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { KeyRound, Plus, RefreshCw, X, Search, AlertTriangle, Trash2 } from 'lucide-react'
import {
  DEVICE_TYPES, LOCATIONS, FOB_STATUS, DEPOSIT_STATUS, depositFor, normalizeSerial, money,
  openAssignment, depositPaid, depositState, isUnmatched,
} from '../lib/fobs.js'
import FobOrderTab from './FobOrderTab.jsx'

const today = () => new Date().toISOString().split('T')[0]
const nowIso = () => new Date().toISOString()
const rid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

function persist(table, row) {
  return supabase.from(table).upsert({ id: row.id, data: row, updated_at: nowIso() })
}

function Badge({ map, k }) {
  const s = map[k] ?? { label: k, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>
}

export default function Fobs() {
  const store = useOutletContext()
  const { members = [], tenants = [], invoices = [], addInvoice, voidInvoice, settings } = store
  const [fobs, setFobs] = useState([])
  const [assignments, setAssignments] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('devices')
  const [search, setSearch] = useState('')
  const [onlyUnmatched, setOnlyUnmatched] = useState(false)
  const [modal, setModal] = useState(null) // { kind:'issue'|'return'|'lost'|'add'|'reassign'|'waive'|'delete'|'faulty', fob?, member? }

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [f, a, r] = await Promise.all([
      supabase.from('fobs').select('data'),
      supabase.from('fob_assignments').select('data'),
      supabase.from('fob_requests').select('data'),
    ])
    setFobs((f.data ?? []).map((x) => x.data).filter(Boolean))
    setAssignments((a.data ?? []).map((x) => x.data).filter(Boolean))
    setRequests((r.data ?? []).map((x) => x.data).filter(Boolean))
    setLoading(false)
  }

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])
  const companyById = useMemo(() => Object.fromEntries(tenants.map((t) => [t.id, t])), [tenants])
  const pendingRequests = requests.filter((r) => r.status === 'pending')

  const stats = useMemo(() => ({
    total: fobs.length,
    issued: fobs.filter((f) => f.status === 'assigned').length,
    available: fobs.filter((f) => f.status === 'available').length,
    lost: fobs.filter((f) => f.status === 'lost').length,
    faulty: fobs.filter((f) => f.status === 'faulty').length,
    requests: pendingRequests.length,
  }), [fobs, pendingRequests.length])

  // Devices still "Issued" to a migrated OfficeRND name that never matched a
  // member record — out of circulation until an admin reassigns or releases them.
  const unmatchedCount = useMemo(
    () => fobs.filter((f) => f.status === 'assigned' && isUnmatched(openAssignment(f.id, assignments))).length,
    [fobs, assignments],
  )

  const shownFobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return fobs
      .filter((f) => {
        if ((tab === 'faulty') !== (f.status === 'faulty')) return false
        const a = openAssignment(f.id, assignments)
        if (onlyUnmatched && !(f.status === 'assigned' && isUnmatched(a))) return false
        if (!q) return true
        const holder = a ? `${a.memberName ?? ''} ${a.companyName ?? ''}` : ''
        return `${f.serial} ${f.type} ${holder}`.toLowerCase().includes(q)
      })
      .sort((a, b) => String(a.serial).localeCompare(String(b.serial)))
  }, [fobs, assignments, search, onlyUnmatched, tab])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function addDevice({ serial, type, location, notes }) {
    const s = normalizeSerial(serial)
    if (!s) return alert('Serial number is required.')
    if (fobs.some((x) => x.serial === s)) return alert(`Serial ${s} is already in inventory — use Issue to assign it.`)
    if (fobs.some((f) => f.serial === s)) return alert(`A device with serial ${s} already exists.`)
    const fob = { id: rid('fob'), serial: s, type, location, status: 'available', currentMemberId: null, currentCompanyId: null, currentAssignmentId: null, notes: notes || '', createdAt: today() }
    await persist('fobs', fob)
    setFobs((prev) => [fob, ...prev])
    setModal(null)
  }

  async function issueDevice({ fob, memberId, expectedReturnAt, notes }) {
    const member = memberById[memberId]
    if (!member) return alert('Pick a member.')
    const company = companyById[member.companyId]
    const deposit = depositFor(fob.type)
    const assignment = {
      id: rid('fa'), fobId: fob.id, serial: fob.serial, type: fob.type,
      memberId: member.id, memberName: member.name, companyId: member.companyId, companyName: company?.businessName ?? '',
      issuedAt: nowIso(), expectedReturnAt: expectedReturnAt || null, returnedAt: null,
      depositAmount: deposit, depositStatus: 'pending', lost: false, issueNotes: notes || '', createdAt: today(),
    }
    const rA = await persist('fob_assignments', assignment)
    if (rA.error) return alert(`Could not issue the device — the assignment didn't save.\n\n${rA.error.message}\n\nIf this keeps happening, check you're signed in as an admin.`)
    setAssignments((prev) => [assignment, ...prev])
    const upFob = { ...fob, status: 'assigned', currentMemberId: member.id, currentCompanyId: member.companyId, currentAssignmentId: assignment.id }
    const rF = await persist('fobs', upFob)
    if (rF.error) return alert(`The assignment saved, but the device status didn't update:\n\n${rF.error.message}`)
    setFobs((prev) => prev.map((f) => (f.id === fob.id ? upFob : f)))
    // Refundable deposit invoice (billed to the member's company, no GST).
    if (member.companyId) addInvoice?.({
      tenantId: member.companyId, source: 'fob', invoiceType: 'fob_deposit', fobAssignmentId: assignment.id,
      status: 'pending', sentStatus: 'not_sent', clientName: company?.businessName ?? '', clientEmail: company?.email ?? '',
      issueDate: today(), dueDate: today(), vatEnabled: false, reference: `${fob.type} deposit — ${fob.serial}`,
      lineItems: [{ id: rid('li'), description: `Refundable ${fob.type} deposit — ${fob.serial}`, revenueAccount: 'Security Deposit', unitPrice: deposit, qty: 1, discountPct: 0, vatExempt: true }],
    })
    // Resolve any matching portal request.
    const req = requests.find((r) => r.status === 'pending' && r.memberId === member.id)
    if (req) await resolveRequest(req, 'issued')
    setModal(null)
  }

  // Link a migrated (unmatched) assignment to the real member. The device stays
  // out on the same deposit — this only corrects who the tracker says holds it.
  async function reassignDevice({ fob, assignment, memberId }) {
    const member = memberById[memberId]
    if (!member) return alert('Pick a member.')
    const company = companyById[member.companyId]
    const upA = {
      ...assignment, memberId: member.id, memberName: member.name,
      companyId: member.companyId ?? null, companyName: company?.businessName ?? '',
      needsReview: false, matchMethod: 'manual', reassignedAt: nowIso(),
    }
    const rA = await persist('fob_assignments', upA)
    if (rA.error) return alert(`Could not reassign the device — the assignment didn't save.\n\n${rA.error.message}`)
    setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? upA : a)))
    const upFob = { ...fob, currentMemberId: member.id, currentCompanyId: member.companyId ?? null }
    const rF = await persist('fobs', upFob)
    if (rF.error) return alert(`The holder was corrected, but the device row didn't update:\n\n${rF.error.message}`)
    setFobs((prev) => prev.map((f) => (f.id === fob.id ? upFob : f)))
    setModal(null)
  }

  // Put an unmatched device back into stock so it can be issued normally. No
  // refund is raised — a migrated deposit has no invoice of ours behind it.
  async function releaseDevice({ fob, assignment, notes }) {
    const upA = {
      ...assignment, returnedAt: nowIso(), needsReview: false, depositStatus: 'waived',
      returnNotes: notes || 'Released back to stock — migrated holder never matched a member',
    }
    const rA = await persist('fob_assignments', upA)
    if (rA.error) return alert(`Could not release the device — the assignment didn't save.\n\n${rA.error.message}`)
    setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? upA : a)))
    const upFob = { ...fob, status: 'available', currentMemberId: null, currentCompanyId: null, currentAssignmentId: null }
    const rF = await persist('fobs', upFob)
    if (rF.error) return alert(`The holder was cleared, but the device status didn't update:\n\n${rF.error.message}`)
    setFobs((prev) => prev.map((f) => (f.id === fob.id ? upFob : f)))
    setModal(null)
  }

  async function returnDevice({ fob, assignment, notes, refund, faulty }) {
    const paid = depositPaid(assignment, invoices)
    const upA = { ...assignment, returnedAt: nowIso(), returnNotes: notes || '', depositStatus: refund && paid ? 'refunding' : (paid ? 'waived' : 'pending') }
    await persist('fob_assignments', upA)
    setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? upA : a)))
    const upFob = {
      ...fob, status: faulty ? 'faulty' : 'available', currentMemberId: null, currentCompanyId: null, currentAssignmentId: null,
      ...(faulty ? { faultyAt: nowIso(), faultNotes: notes || 'Returned not working' } : {}),
    }
    await persist('fobs', upFob)
    setFobs((prev) => prev.map((f) => (f.id === fob.id ? upFob : f)))
    // Refund the deposit as a credit note → Billing "pending refunds" approval queue.
    if (refund && paid && assignment.companyId) addInvoice?.({
      tenantId: assignment.companyId, source: 'fob', invoiceType: 'bond_refund', approvalStatus: 'pending', fobAssignmentId: assignment.id,
      status: 'pending', sentStatus: 'not_sent', clientName: assignment.companyName ?? '',
      issueDate: today(), dueDate: today(), vatEnabled: false, reference: `${fob.type} deposit refund — ${fob.serial}`,
      lineItems: [{ id: rid('li'), description: `${fob.type} deposit refund — ${fob.serial}`, revenueAccount: 'Security Deposit', unitPrice: -Number(assignment.depositAmount || 0), qty: 1, discountPct: 0 }],
    })
    setModal(null)
  }

  async function markLost({ fob, assignment, notes }) {
    const upA = { ...assignment, returnedAt: nowIso(), lost: true, returnNotes: notes || 'Reported lost', depositStatus: 'forfeited' }
    await persist('fob_assignments', upA)
    setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? upA : a)))
    const upFob = { ...fob, status: 'lost', currentMemberId: null, currentCompanyId: null, currentAssignmentId: null }
    await persist('fobs', upFob)
    setFobs((prev) => prev.map((f) => (f.id === fob.id ? upFob : f)))
    setModal(null)
  }

  // Waive an unpaid deposit: the member keeps the device, nothing is owed, and
  // the linked deposit invoice is voided so it stops being chased.
  async function waiveDeposit({ fob, assignment, notes }) {
    const upA = { ...assignment, depositStatus: 'waived', depositWaivedAt: nowIso(), waiveNotes: notes || '' }
    const rA = await persist('fob_assignments', upA)
    if (rA.error) return alert(`Could not waive the deposit — the assignment didn't save.\n\n${rA.error.message}`)
    setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? upA : a)))
    invoices
      .filter((i) => i.fobAssignmentId === assignment.id && i.invoiceType === 'fob_deposit' && !['paid', 'voided'].includes(i.status))
      .forEach((i) => voidInvoice?.(i.id))
    setModal(null)
  }

  // Remove a device row entirely (duplicates, data-entry mistakes, binned
  // devices) along with its issue/return history. If it's still issued, any
  // unpaid deposit invoice can be voided in the same step so nobody is chased
  // for a device that no longer exists; a paid deposit is left for a refund.
  async function deleteDevice({ fob, voidDeposit }) {
    const history = assignments.filter((a) => a.fobId === fob.id)
    if (history.length) {
      const rA = await supabase.from('fob_assignments').delete().in('id', history.map((a) => a.id))
      if (rA.error) return alert(`Could not delete the device history:\n\n${rA.error.message}`)
    }
    const rF = await supabase.from('fobs').delete().eq('id', fob.id)
    if (rF.error) return alert(`Could not delete the device:\n\n${rF.error.message}`)
    if (voidDeposit) unpaidDeposits(invoices, history).forEach((i) => voidInvoice?.(i.id))
    setAssignments((prev) => prev.filter((a) => a.fobId !== fob.id))
    setFobs((prev) => prev.filter((f) => f.id !== fob.id))
    setModal(null)
  }

  // Move an in-stock device to / from the "Not functioning" section.
  async function setFaulty({ fob, faulty, notes }) {
    const upFob = faulty
      ? { ...fob, status: 'faulty', faultyAt: nowIso(), faultNotes: notes || '' }
      : { ...fob, status: 'available', faultyAt: null, faultNotes: '' }
    const rF = await persist('fobs', upFob)
    if (rF.error) return alert(`Could not update the device:\n\n${rF.error.message}`)
    setFobs((prev) => prev.map((f) => (f.id === fob.id ? upFob : f)))
    setModal(null)
  }

  async function resolveRequest(req, status) {
    const up = { ...req, status, resolvedAt: nowIso() }
    await persist('fob_requests', up)
    setRequests((prev) => prev.map((r) => (r.id === req.id ? up : r)))
  }

  const StatCard = ({ label, value, tone }) => (
    <div className="border border-border rounded-lg bg-card px-4 py-3">
      <div className={`text-2xl font-bold ${tone ?? 'text-foreground'}`}>{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><KeyRound size={22} /> Fobs & Remotes</h1>
          <p className="text-sm text-muted-foreground mt-1">After-hours access devices — inventory, deposits and returns.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-muted-foreground hover:text-foreground border border-border rounded-md" title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={() => setModal({ kind: 'add' })} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"><Plus size={15} /> Add device</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <StatCard label="In circulation" value={stats.issued} tone="text-blue-700" />
        <StatCard label="Available" value={stats.available} tone="text-green-700" />
        <StatCard label="Lost" value={stats.lost} tone="text-red-700" />
        <StatCard label="Not functioning" value={stats.faulty} tone={stats.faulty ? 'text-orange-700' : undefined} />
        <StatCard label="Total devices" value={stats.total} />
        <StatCard label="Requests" value={stats.requests} tone={stats.requests ? 'text-amber-700' : undefined} />
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {[['devices', 'Devices'], ['faulty', `Not functioning${stats.faulty ? ` (${stats.faulty})` : ''}`], ['requests', `Requests${pendingRequests.length ? ` (${pendingRequests.length})` : ''}`], ['order', 'Fob Order']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      {(tab === 'devices' || tab === 'faulty') && (
        <>
          {tab === 'faulty' && <p className="mb-3 text-sm text-muted-foreground">Devices that don't work. They can't be issued until marked working again.</p>}
          {tab === 'devices' && unmatchedCount > 0 && (
            <div className="mb-3 flex items-start gap-2 text-sm border border-amber-200 bg-amber-50 text-amber-900 rounded-md px-3 py-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div>
                <strong>{unmatchedCount} device{unmatchedCount === 1 ? '' : 's'}</strong> still show as Issued to a migrated name that never matched a member,
                so they can't be issued to anyone. Reassign them to the real member, or release them back to stock.
                <button onClick={() => setOnlyUnmatched((v) => !v)} className="ml-1.5 underline font-medium hover:no-underline">
                  {onlyUnmatched ? 'Show all devices' : 'Show only these'}
                </button>
              </div>
            </div>
          )}
          <div className="relative mb-3 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial / holder…" className="pl-8 pr-3 py-1.5 border border-border rounded text-sm bg-background w-full focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            {loading ? <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
              : shownFobs.length === 0 ? <div className="p-10 text-center text-muted-foreground text-sm">{tab === 'faulty' && !search.trim() ? 'No devices are marked as not functioning.' : fobs.length === 0 ? 'No devices yet. Add your first fob or remote.' : 'No devices match. Available stock has no holder, so searching a member name only finds devices they already hold.'}</div>
              : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Serial</th>
                      <th className="text-left px-4 py-2.5 font-medium">Type</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium">Holder</th>
                      <th className="text-left px-4 py-2.5 font-medium">Deposit</th>
                      <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownFobs.map((f) => {
                      const a = openAssignment(f.id, assignments)
                      return (
                        <tr key={f.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                          <td className="px-4 py-3 font-mono text-foreground">{f.serial}</td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">{f.type}</td>
                          <td className="px-4 py-3"><Badge map={FOB_STATUS} k={f.status} />{f.status === 'faulty' && f.faultNotes && <span className="text-muted-foreground text-xs block mt-0.5">{f.faultNotes}</span>}</td>
                          <td className="px-4 py-3 text-foreground">{a ? <>{a.memberName || <span className="text-muted-foreground">unnamed</span>}<span className="text-muted-foreground text-xs block">{isUnmatched(a) ? <span className="text-amber-700 font-medium">Not linked to a member</span> : a.companyName}</span></> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3">{a ? <Badge map={DEPOSIT_STATUS} k={depositState(a, invoices)} /> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {f.status === 'available' && <button onClick={() => setModal({ kind: 'issue', fob: f })} className="text-xs bg-primary text-primary-foreground rounded px-2.5 py-1 font-medium hover:bg-primary/90">Issue</button>}
                              {f.status === 'available' && <button onClick={() => setModal({ kind: 'faulty', fob: f })} className="text-xs border border-orange-200 text-orange-700 rounded px-2.5 py-1 font-medium hover:bg-orange-50">Not working</button>}
                              {f.status === 'faulty' && <button onClick={() => setFaulty({ fob: f, faulty: false })} className="text-xs border border-input rounded px-2.5 py-1 font-medium hover:bg-muted/50">Working again</button>}
                              {a && !isUnmatched(a) && depositState(a, invoices) === 'pending' && (
                                <button onClick={() => setModal({ kind: 'waive', fob: f, assignment: a })} className="text-xs border border-input rounded px-2.5 py-1 font-medium hover:bg-muted/50">Waive deposit</button>
                              )}
                              {f.status === 'assigned' && a && isUnmatched(a) && (
                                <button onClick={() => setModal({ kind: 'reassign', fob: f, assignment: a })} className="text-xs bg-amber-600 text-white rounded px-2.5 py-1 font-medium hover:bg-amber-700">Reassign</button>
                              )}
                              {f.status === 'assigned' && a && <>
                                {!isUnmatched(a) && <button onClick={() => setModal({ kind: 'return', fob: f, assignment: a })} className="text-xs border border-input rounded px-2.5 py-1 font-medium hover:bg-muted/50">Return</button>}
                                <button onClick={() => setModal({ kind: 'lost', fob: f, assignment: a })} className="text-xs border border-red-200 text-red-600 rounded px-2.5 py-1 font-medium hover:bg-red-50">Lost</button>
                              </>}
                              <button onClick={() => setModal({ kind: 'delete', fob: f, assignment: a })} title="Delete this device from the system" className="flex items-center gap-1 text-xs border border-red-200 text-red-600 rounded px-2.5 py-1 font-medium hover:bg-red-50"><Trash2 size={12} /> Delete</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}

      {tab === 'requests' && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {pendingRequests.length === 0 ? <div className="p-10 text-center text-muted-foreground text-sm">No open fob requests.</div>
            : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                  <tr><th className="text-left px-4 py-2.5 font-medium">Member</th><th className="text-left px-4 py-2.5 font-medium">Type</th><th className="text-left px-4 py-2.5 font-medium">Note</th><th className="text-right px-4 py-2.5 font-medium">Actions</th></tr>
                </thead>
                <tbody>
                  {pendingRequests.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3 text-foreground">{r.memberName}<span className="text-muted-foreground text-xs block">{r.companyName}</span></td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{r.type || 'fob'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.note || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setModal({ kind: 'issue', requestMemberId: r.memberId, requestType: r.type })} className="text-xs bg-primary text-primary-foreground rounded px-2.5 py-1 font-medium hover:bg-primary/90">Issue</button>
                          <button onClick={() => resolveRequest(r, 'declined')} className="text-xs border border-input rounded px-2.5 py-1 font-medium hover:bg-muted/50">Decline</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {tab === 'order' && <FobOrderTab settings={settings} />}

      {modal?.kind === 'add' && <AddModal fobs={fobs} onClose={() => setModal(null)} onSave={addDevice} />}
      {modal?.kind === 'issue' && <IssueModal fobs={fobs} preFob={modal.fob} members={members} tenants={tenants} requestMemberId={modal.requestMemberId} requestType={modal.requestType} onClose={() => setModal(null)} onIssue={issueDevice} />}
      {modal?.kind === 'reassign' && <ReassignModal ctx={modal} members={members} tenants={tenants} onClose={() => setModal(null)} onReassign={reassignDevice} onRelease={releaseDevice} />}
      {modal?.kind === 'return' && <ReturnModal ctx={modal} paid={depositPaid(modal.assignment, invoices)} onClose={() => setModal(null)} onReturn={returnDevice} />}
      {modal?.kind === 'lost' && <LostModal ctx={modal} onClose={() => setModal(null)} onLost={markLost} />}
      {modal?.kind === 'waive' && <WaiveModal ctx={modal} invoices={invoices} onClose={() => setModal(null)} onWaive={waiveDeposit} />}
      {modal?.kind === 'delete' && <DeleteModal ctx={modal} history={assignments.filter((a) => a.fobId === modal.fob.id)} invoices={invoices} onClose={() => setModal(null)} onDelete={deleteDevice} />}
      {modal?.kind === 'faulty' && <FaultyModal ctx={modal} onClose={() => setModal(null)} onSave={setFaulty} />}
    </div>
  )
}

const field = 'w-full border border-border rounded px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring'
function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-md rounded-lg shadow-xl border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function AddModal({ fobs = [], onClose, onSave }) {
  const [f, setF] = useState({ serial: '', type: 'fob', location: 'hexa', notes: '' })
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })
  // Fobs only exist at Hexa; remotes can belong to any location.
  const setType = (e) => {
    const type = e.target.value
    setF({ ...f, type, location: type === 'fob' ? 'hexa' : f.location })
  }
  const locations = f.type === 'fob' ? ['hexa'] : LOCATIONS
  // Serial suggestions: every available (unassigned) device already in
  // inventory, so staff can see what exists while typing. Re-adding an
  // existing serial is blocked outright.
  const existing = fobs.find((x) => x.serial === normalizeSerial(f.serial))
  const availableSerials = fobs.filter((x) => x.status === 'available').map((x) => x.serial)
  return (
    <ModalShell title="Add device" onClose={onClose}>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Serial number</label>
        <input list="available-fob-serials" value={f.serial} onChange={up('serial')} className={`${field} font-mono`} placeholder="e.g. 807APD0A2B" />
        <datalist id="available-fob-serials">
          {availableSerials.map((s) => <option key={s} value={s} />)}
        </datalist>
        {existing && (
          <p className="text-xs text-red-600 mt-1">
            Already in inventory — {existing.type} at {existing.location}, status "{FOB_STATUS[existing.status]?.label ?? existing.status}". Use Issue to assign it.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs text-muted-foreground mb-1">Type</label><select value={f.type} onChange={setType} className={field}>{DEVICE_TYPES.map((t) => <option key={t} value={t}>{t} — {money(depositFor(t))} deposit</option>)}</select></div>
        <div><label className="block text-xs text-muted-foreground mb-1">Location</label><select value={f.location} onChange={up('location')} className={field}>{locations.map((l) => <option key={l} value={l} className="capitalize">{l}</option>)}</select></div>
      </div>
      <div><label className="block text-xs text-muted-foreground mb-1">Notes</label><input value={f.notes} onChange={up('notes')} className={field} /></div>
      <div className="flex justify-end pt-1"><button onClick={() => onSave(f)} disabled={!!existing} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50">Add device</button></div>
    </ModalShell>
  )
}

function MemberPicker({ members, tenants, value, onChange }) {
  return <SearchSelect aria-label="Member" value={value} onChange={(event) => onChange(event.target.value)} className={field}>
    <option value="">Select member</option>
    {members.map((member) => {
      const company = tenants.find((tenant) => tenant.id === member.companyId)
      return <option key={member.id} value={member.id} data-search={[member.email, member.phone].filter(Boolean).join(' ')}>
        {member.name}{company ? ' — ' + company.businessName : ''}
      </option>
    })}
  </SearchSelect>
}

// An unmatched (migrated) device: link the real member, or release it to stock.
function ReassignModal({ ctx, members, tenants, onClose, onReassign, onRelease }) {
  const { fob, assignment } = ctx
  const [memberId, setMemberId] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <ModalShell title={`Reassign ${fob.type} — ${fob.serial}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        Imported as held by <strong className="text-foreground">{assignment.memberName || 'an unnamed holder'}</strong>, which never matched a member record.
      </p>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Link to member <span className="text-muted-foreground/70">(click a name)</span></label>
        <MemberPicker members={members} tenants={tenants} value={memberId} onChange={setMemberId} />
      </div>
      <div className="flex items-center justify-end gap-3 pt-1">
        <button disabled={!memberId} onClick={() => onReassign({ fob, assignment, memberId })} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-40">Link member</button>
      </div>
      <div className="border-t border-border pt-3">
        <p className="text-xs text-muted-foreground mb-2">
          Or, if the device is back in the drawer: release it to stock so it can be issued again. No refund is raised — the imported deposit has no invoice behind it.
        </p>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Release notes (optional)" className={`${field} mb-2`} />
        <div className="flex justify-end">
          <button onClick={() => onRelease({ fob, assignment, notes })} className="border border-input px-4 py-2 rounded text-sm font-medium hover:bg-muted/50">Release to stock</button>
        </div>
      </div>
    </ModalShell>
  )
}

function IssueModal({ fobs, preFob, members, tenants, requestMemberId, requestType, onClose, onIssue }) {
  const available = fobs.filter((f) => f.status === 'available' && (requestType ? f.type === requestType : true))
  const [fobId, setFobId] = useState(preFob?.id || available[0]?.id || '')
  const [memberId, setMemberId] = useState(requestMemberId || '')
  const [expectedReturnAt, setExpectedReturnAt] = useState('')
  const [notes, setNotes] = useState('')
  const fob = fobs.find((f) => f.id === fobId) || preFob
  return (
    <ModalShell title={`Issue ${fob?.type ?? 'device'}${fob ? ` — ${fob.serial}` : ''}`} onClose={onClose}>
      {!preFob && (
        <div><label className="block text-xs text-muted-foreground mb-1">Device</label>
          {available.length === 0 ? (
            <p className="text-xs text-amber-700 border border-amber-200 bg-amber-50 rounded px-2 py-1.5">
              No {requestType ?? 'device'} is available to issue. Add the physical device under “Add device”, or reassign/release one that's stuck with an unmatched holder.
            </p>
          ) : (
            <SearchSelect aria-label="Device" value={fobId} onChange={(e) => setFobId(e.target.value)} className={`${field} font-mono`}>
              <option value="">Select an available device…</option>
              {available.map((f) => <option key={f.id} value={f.id}>{f.serial} · {f.type}</option>)}
            </SearchSelect>
          )}
        </div>
      )}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Member <span className="text-red-500">*</span> <span className="text-muted-foreground/70">(click a name)</span></label>
        <MemberPicker members={members} tenants={tenants} value={memberId} onChange={setMemberId} />
      </div>
      <div><label className="block text-xs text-muted-foreground mb-1">Expected return (optional)</label><input type="date" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} className={field} /></div>
      <div><label className="block text-xs text-muted-foreground mb-1">Issue notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></div>
      {fob && <p className="text-xs text-muted-foreground">A refundable <strong>{money(depositFor(fob.type))}</strong> deposit invoice will be raised to the member's company.</p>}
      <div className="flex items-center justify-end gap-3 pt-1">
        {(!fob || !memberId) && <span className="text-xs text-muted-foreground">{!fob ? 'Choose a device' : 'Select a member'} to enable</span>}
        <button disabled={!fob || !memberId} onClick={() => onIssue({ fob, memberId, expectedReturnAt, notes })} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-40">Issue device</button>
      </div>
    </ModalShell>
  )
}

function ReturnModal({ ctx, paid, onClose, onReturn }) {
  const { fob, assignment } = ctx
  const [notes, setNotes] = useState('')
  const [refund, setRefund] = useState(true)
  const [faulty, setFaultyFlag] = useState(false)
  return (
    <ModalShell title={`Return ${fob.type} — ${fob.serial}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">Returned by <strong className="text-foreground">{assignment.memberName}</strong> ({assignment.companyName}).</p>
      {paid ? (
        <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} /> Refund the {money(assignment.depositAmount)} deposit (raises a credit note for approval)</label>
      ) : <p className="text-xs text-amber-700">No deposit payment recorded for this device — nothing to refund.</p>}
      <div><label className="block text-xs text-muted-foreground mb-1">Return notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></div>
      <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={faulty} onChange={(e) => setFaultyFlag(e.target.checked)} /> Device isn't working — move it to Not functioning</label>
      <div className="flex justify-end pt-1"><button onClick={() => onReturn({ fob, assignment, notes, refund, faulty })} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90">Mark returned</button></div>
    </ModalShell>
  )
}

function LostModal({ ctx, onClose, onLost }) {
  const { fob, assignment } = ctx
  const [notes, setNotes] = useState('')
  return (
    <ModalShell title={`Mark lost — ${fob.serial}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">Held by <strong className="text-foreground">{assignment.memberName}</strong> ({assignment.companyName}).</p>
      <p className="text-xs text-red-700">The {money(assignment.depositAmount)} deposit is <strong>forfeited</strong> (kept to cover the lost device). Issue a replacement separately — it takes a fresh {money(depositFor(fob.type))} deposit.</p>
      <div><label className="block text-xs text-muted-foreground mb-1">Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></div>
      <div className="flex justify-end pt-1"><button onClick={() => onLost({ fob, assignment, notes })} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700">Mark lost &amp; forfeit deposit</button></div>
    </ModalShell>
  )
}

function WaiveModal({ ctx, invoices, onClose, onWaive }) {
  const { fob, assignment } = ctx
  const [notes, setNotes] = useState('')
  const open = invoices.filter((i) => i.fobAssignmentId === assignment.id && i.invoiceType === 'fob_deposit' && !['paid', 'voided'].includes(i.status))
  return (
    <ModalShell title={`Waive deposit — ${fob.serial}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">Held by <strong className="text-foreground">{assignment.memberName}</strong> ({assignment.companyName}). They keep the device and owe no deposit.</p>
      {open.length > 0 && <p className="text-xs text-amber-700">Voids {open.map((i) => i.number || 'the deposit invoice').join(', ')} ({money(assignment.depositAmount)}) so it stops being chased.</p>}
      <div><label className="block text-xs text-muted-foreground mb-1">Reason (optional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></div>
      <div className="flex justify-end pt-1"><button onClick={() => onWaive({ fob, assignment, notes })} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90">Waive deposit</button></div>
    </ModalShell>
  )
}

// Deposit invoices on these assignments that are still being chased.
function unpaidDeposits(invoices, assignments) {
  const ids = new Set(assignments.map((a) => a.id))
  return invoices.filter((i) => ids.has(i.fobAssignmentId) && i.invoiceType === 'fob_deposit' && !['paid', 'voided'].includes(i.status))
}

function DeleteModal({ ctx, history, invoices, onClose, onDelete }) {
  const { fob, assignment } = ctx
  const unpaid = unpaidDeposits(invoices, history)
  const paidOpen = assignment && depositPaid(assignment, invoices) && !['refunding', 'refunded'].includes(assignment.depositStatus)
  const [voidDeposit, setVoidDeposit] = useState(true)
  return (
    <ModalShell title={`Delete ${fob.type} — ${fob.serial}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        Removes this device from the system permanently{history.length ? `, along with its ${history.length} issue/return record${history.length === 1 ? '' : 's'}` : ''}.
      </p>
      {assignment && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Still issued to <strong>{assignment.memberName || 'an unnamed holder'}</strong>{assignment.companyName ? ` (${assignment.companyName})` : ''}.
        </p>
      )}
      {unpaid.length > 0 && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-0.5" checked={voidDeposit} onChange={(e) => setVoidDeposit(e.target.checked)} />
          <span>Also void the unpaid deposit invoice{unpaid.length === 1 ? '' : 's'} {unpaid.map((i) => i.number).filter(Boolean).join(', ')}</span>
        </label>
      )}
      {paidOpen && <p className="text-xs text-amber-700">The {money(assignment.depositAmount)} deposit was paid — raise a refund separately if it's owed back.</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="border border-input px-4 py-2 rounded text-sm font-medium hover:bg-muted/50">Cancel</button>
        <button onClick={() => onDelete({ fob, voidDeposit: unpaid.length > 0 && voidDeposit })} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700">Delete device</button>
      </div>
    </ModalShell>
  )
}

function FaultyModal({ ctx, onClose, onSave }) {
  const { fob } = ctx
  const [notes, setNotes] = useState('')
  return (
    <ModalShell title={`Not working — ${fob.serial}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">Moves the device to the Not functioning section. It can't be issued until it's marked working again.</p>
      <div><label className="block text-xs text-muted-foreground mb-1">What's wrong? (optional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} placeholder="e.g. doesn't open the front door" /></div>
      <div className="flex justify-end pt-1"><button onClick={() => onSave({ fob, faulty: true, notes })} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90">Mark not functioning</button></div>
    </ModalShell>
  )
}
