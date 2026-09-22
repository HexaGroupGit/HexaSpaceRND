import SearchSelect from './SearchSelect.jsx'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import WaitingList from './WaitingList.jsx'
import LeadDetail from './LeadDetail.jsx'
import WaitingAvailabilityEmail from './WaitingAvailabilityEmail.jsx'
import { OFFICE_LEVELS, officeSuites, officeSuiteLabel, matchingAvailableOffices } from '../lib/waitingOffice.js'
import { floorOf } from '../lib/roomFloor.js'
import { isWaitingLead, memberCurrentSpaces, waitingListEntries, waitingListUpdates, waitingRequestFields } from '../lib/waitingList.js'

const OFFERINGS = ['Private Office', 'Enterprise Suites', 'Dedicated Desk', 'Flexible Desk', 'Warehouse', 'Virtual Office', 'Parking', 'Other']
const MODES = [
  ['member', 'Existing member — Upsize'],
  ['lead', 'Existing lead — Waiting for availability'],
  ['new', 'New lead — Waiting for availability'],
]

export default function WaitingListManager({ store }) {
  const navigate = useNavigate()
  const [kind, setKind] = useState('all')
  const [interest, setInterest] = useState('all')
  const [editing, setEditing] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [notifyId, setNotifyId] = useState(null)
  const [availableOnly, setAvailableOnly] = useState(false)
  const entries = waitingListEntries(store)
  const notifyEntry = entries.find((entry) => entry.id === notifyId)
  const matches = Object.fromEntries(entries.map((entry) => [entry.id, matchingAvailableOffices(entry, store)]))
  const interests = [...new Set(entries.map((entry) => entry.enquiryType || entry.interest).filter(Boolean))].sort()
  const visible = entries.filter((entry) => (kind === 'all' || entry.kind === kind) && (interest === 'all' || (entry.enquiryType || entry.interest) === interest) && (!availableOnly || matches[entry.id].length > 0))
  const openLead = (store.leads || []).find((lead) => lead.id === openId)

  function remove(entry) {
    if (entry.kind === 'member') {
      const member = store.members.find((item) => item.id === entry.recordId)
      if (member) store.updateMember(member.id, { waitingListRequest: { ...member.waitingListRequest, ...waitingListUpdates(false) } })
    } else store.updateLead(entry.recordId, waitingListUpdates(false))
  }

  function open(entry) {
    if (entry.kind === 'member') navigate(`/members?member=${encodeURIComponent(entry.recordId)}`)
    else setOpenId(entry.recordId)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <select aria-label="Waiting-list request type" value={kind} onChange={(event) => setKind(event.target.value)} className="border border-input rounded-md px-3 py-2 text-sm">
            <option value="all">All requests</option>
            <option value="member">Member upsizes</option>
            <option value="lead">Leads waiting for availability</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} /> Office available ({entries.filter((entry) => matches[entry.id].length > 0).length})</label>
          <select aria-label="Waiting-list space type" value={interest} onChange={(event) => setInterest(event.target.value)} className="border border-input rounded-md px-3 py-2 text-sm">
            <option value="all">All space types</option>
            {interests.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <button onClick={() => setEditing({})} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"><Plus size={15} /> Add to Waiting List</button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Matching available offices are flagged below. Review and customise an email, then send it as an admin.</p>
      <WaitingList leads={visible} spaces={store.spaces || []} filtered={kind !== 'all' || interest !== 'all' || availableOnly} onOpen={open} onEdit={setEditing} onRemove={remove} matches={matches} onNotify={(entry) => setNotifyId(entry.id)} />
      {editing && <WaitingListForm entry={editing} store={store} onClose={() => setEditing(null)} />}
      {notifyEntry && <WaitingAvailabilityEmail entry={notifyEntry} store={store} onClose={() => setNotifyId(null)} />}
      {openLead && <LeadDetail lead={openLead} store={store} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function WaitingListForm({ entry, store, onClose }) {
  const { members = [], leads = [], tenants = [], spaces = [], leases = [], pipelineStages = [] } = store
  const [mode, setMode] = useState(entry.kind || 'member')
  const [recordId, setRecordId] = useState(entry.recordId || '')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', businessName: '', email: '', phone: '',
    enquiryType: entry.enquiryType || entry.interest || 'Private Office', spaceId: entry.spaceId || '',
    preferredStartDate: entry.preferredStartDate || '', waitingListNotes: entry.waitingListNotes || '',
    preferredStartAsap: entry.preferredStartAsap === true || (!entry.recordId && !entry.preferredStartDate),
    preferredFloor: entry.preferredFloor || floorOf(spaces.find((space) => space.id === entry.spaceId)) || '', preferredPax: entry.preferredPax || '',
  })
  const isEdit = !!entry.recordId
  const selected = (mode === 'member' ? members : leads).find((record) => record.id === recordId)
  const companyName = (member) => tenants.find((tenant) => tenant.id === member.companyId)?.businessName || ''
  const alreadyWaiting = (record) => mode === 'member' ? record.waitingListRequest?.waitingList === true : isWaitingLead(record, pipelineStages)
  const eligible = mode === 'member' ? members.filter((member) => member.clientType !== 'function') : leads.filter((lead) => !lead.tenantId && !lead.dealClosed && pipelineStages.find((stage) => stage.id === lead.stageId)?.category !== 'won')
  const options = [...new Set([...OFFERINGS, ...leads.map((lead) => lead.enquiryType || lead.interest).filter(Boolean), form.enquiryType].filter(Boolean))]
  const currentSpace = mode === 'member' && selected ? memberCurrentSpaces(selected, leases, spaces) : ''
  const suites = officeSuites(spaces, form.preferredFloor)
  const invalidUnit = form.spaceId && !suites.some((space) => space.id === form.spaceId)
  const lost = mode === 'lead' && selected && pipelineStages.find((stage) => stage.id === selected.stageId)?.category === 'lost'
  const input = 'w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
  const change = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))

  function chooseRecord(id) {
    setRecordId(id)
    setError('')
    const record = (mode === 'member' ? members : leads).find((item) => item.id === id)
    const previous = mode === 'member' ? record?.waitingListRequest : record
    setForm((value) => ({ ...value,
      enquiryType: previous?.enquiryType || previous?.interest || 'Private Office',
      spaceId: previous?.spaceId || '', preferredStartDate: previous?.preferredStartDate || '',
      preferredStartAsap: previous?.preferredStartAsap === true || !previous?.preferredStartDate,
      preferredFloor: previous?.preferredFloor || floorOf(spaces.find((space) => space.id === previous?.spaceId)) || '', preferredPax: previous?.preferredPax || '',
      waitingListNotes: previous?.waitingListNotes || '',
    }))
  }

  function save(event) {
    event.preventDefault()
    setError('')
    if (mode !== 'new' && (!selected || !eligible.some((record) => record.id === selected.id))) { setError('Select an available member or lead.'); return }
    if (!isEdit && selected && alreadyWaiting(selected)) { setError('This person is already on the waiting list. Edit their existing request.'); return }
    if (mode === 'new' && !form.name.trim()) { setError('Enter a contact name.'); return }
    if (invalidUnit) { setError('Choose an office suite, or select any suitable office suite.'); return }
    const previous = mode === 'member' ? selected.waitingListRequest : selected
    const request = waitingRequestFields(form, previous)
    if (mode === 'member') {
      store.updateMember(selected.id, { waitingListRequest: { ...previous, ...request } })
    } else {
      const initialStage = [...pipelineStages].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).find((stage) => stage.category === 'new')
        || pipelineStages.find((stage) => !['won', 'lost'].includes(stage.category))
      if ((mode === 'new' || lost) && !initialStage) { setError('Add an open CRM pipeline stage before adding this lead.'); return }
      if (mode === 'new') {
        store.addLead({ ...request, name: form.name.trim(), businessName: form.businessName.trim(), email: form.email.trim(), phone: form.phone.trim(), source: 'other', stageId: initialStage.id })
      } else {
        // Reopen and queue in one persisted update, preserving the activity log.
        if (lost) {
          const now = new Date().toISOString()
          Object.assign(request, {
            stageId: initialStage.id, stageEnteredAt: now.slice(0, 10),
            activity: [...(selected.activity || []), { id: `act${Date.now()}`, type: 'stage', stageId: initialStage.id, createdAt: now, text: 'Reopened: waiting for availability' }],
          })
        }
        store.updateLead(selected.id, request)
      }
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="waiting-form-title" className="bg-card rounded-xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="waiting-form-title" className="font-semibold">{isEdit ? 'Edit waiting-list request' : 'Add to Waiting List'}</h2>
          <button type="button" onClick={onClose} aria-label="Close waiting-list form" className="p-1 text-muted-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <label className="block text-sm font-medium">Request type
            <select disabled={isEdit} value={mode} onChange={(event) => { setMode(event.target.value); setRecordId(''); setError(''); setForm({ name: '', businessName: '', email: '', phone: '', enquiryType: 'Private Office', spaceId: '', preferredStartDate: '', preferredStartAsap: true, preferredFloor: '', preferredPax: '', waitingListNotes: '' }) }} className={`${input} mt-1`}>
              {MODES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          {mode !== 'new' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium">{mode === 'member' ? 'Existing member' : 'Existing lead or enquiry'}
                <SearchSelect aria-label={mode === 'member' ? 'Existing member' : 'Existing lead or enquiry'} placeholder="Search name, company, email or phone…" required disabled={isEdit} value={recordId} onChange={(event) => chooseRecord(event.target.value)} className={`${input} mt-1`}>
                  <option value="">Select {mode === 'member' ? 'a member' : 'a lead'}</option>
                  {eligible.map((record) => <option key={record.id} value={record.id} data-search={[record.email, record.phone].filter(Boolean).join(' ')} disabled={!isEdit && alreadyWaiting(record)}>{[record.name || record.businessName, mode === 'member' ? companyName(record) : record.businessName, record.email].filter(Boolean).join(' · ')}{alreadyWaiting(record) ? ' — Already waiting' : ''}</option>)}
                </SearchSelect>
              </label>
              {!eligible.length && <p className="text-xs text-muted-foreground">No matching {mode === 'member' ? 'members' : 'leads'}.</p>}
              {selected && <p className="text-sm text-muted-foreground">{[selected.email, selected.phone].filter(Boolean).join(' · ') || 'No contact details recorded'}</p>}
              {mode === 'member' && selected && <p className="text-sm text-muted-foreground">Current space: {currentSpace || 'No active space recorded'}</p>}
              {lost && <p className="text-xs text-muted-foreground">This enquiry will return to the open pipeline while waiting for availability.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">Contact name *<input required value={form.name} onChange={change('name')} className={`${input} mt-1`} /></label>
              <label className="text-sm">Company<input value={form.businessName} onChange={change('businessName')} className={`${input} mt-1`} /></label>
              <label className="text-sm">Email<input type="email" value={form.email} onChange={change('email')} className={`${input} mt-1`} /></label>
              <label className="text-sm">Phone<input type="tel" value={form.phone} onChange={change('phone')} className={`${input} mt-1`} /></label>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">Requested space type
              <select value={form.enquiryType} onChange={change('enquiryType')} className={`${input} mt-1`}><option value="">Not specified</option>{options.map((type) => <option key={type}>{type}</option>)}</select>
            </label>
            <label className="text-sm">Preferred level
              <select value={form.preferredFloor} onChange={(event) => setForm({ ...form, preferredFloor: event.target.value, spaceId: '' })} className={`${input} mt-1`}><option value="">Any level</option>{OFFICE_LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select>
            </label>
            <label className="text-sm sm:col-span-2">Preferred office suite
              <SearchSelect aria-label="Room or space" value={invalidUnit ? '' : form.spaceId} onChange={change('spaceId')} className={`${input} mt-1`}><option value="">Any suitable office suite</option>{OFFICE_LEVELS.map((level) => <optgroup key={level.id} label={level.label}>{suites.filter((space) => floorOf(space) === level.id).map((space) => <option key={space.id} value={space.id}>{officeSuiteLabel(space)}</option>)}</optgroup>)}{suites.filter((space) => !floorOf(space)).map((space) => <option key={space.id} value={space.id}>{officeSuiteLabel(space)}</option>)}</SearchSelect>
              {invalidUnit && <span className="block text-xs text-amber-700 mt-1">The saved unit is not an office suite on this level. Choose an office suite or clear the preference.</span>}
              {invalidUnit && <button type="button" onClick={() => setForm({ ...form, spaceId: '' })} className="text-xs underline mt-1">Clear saved unit</button>}
            </label>
            <label className="text-sm">Minimum pax<input type="number" min="1" step="1" placeholder="Any capacity" value={form.preferredPax} onChange={change('preferredPax')} className={`${input} mt-1`} /></label>
            <label className="text-sm">Preferred start
              <select value={form.preferredStartAsap ? 'asap' : 'date'} onChange={(event) => setForm({ ...form, preferredStartAsap: event.target.value === 'asap', preferredStartDate: event.target.value === 'asap' ? '' : form.preferredStartDate })} className={`${input} mt-1`}><option value="asap">ASAP</option><option value="date">Specific date / flexible</option></select>
            </label>
            {!form.preferredStartAsap && <label className="text-sm">Preferred start date<input type="date" value={form.preferredStartDate} onChange={change('preferredStartDate')} className={`${input} mt-1`} /></label>}
          </div>
          <label className="block text-sm">Requirements / notes<textarea rows={3} placeholder={mode === 'member' ? 'Desired office size, team size, budget, timing…' : 'Space needed, unavailable dates, budget, follow-up…'} value={form.waitingListNotes} onChange={change('waitingListNotes')} className={`${input} mt-1`} /></label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-input rounded-md">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium">{isEdit ? 'Save changes' : 'Add to Waiting List'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
