import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ClipboardList, List, Table2, Pencil, X, Mail } from 'lucide-react'
import { officeSuiteLabel } from '../lib/waitingOffice.js'
import { FLOOR_LABELS } from '../lib/roomFloor.js'

function dateLabel(value) {
  if (!value) return '—'
  try { return format(parseISO(value), 'dd/MM/yyyy') } catch { return '—' }
}

export default function WaitingList({ leads, spaces, filtered = false, onOpen, onEdit, onRemove, matches = {}, onNotify }) {
  const [view, setView] = useState('table')
  const [search, setSearch] = useState('')
  const spaceLabel = (lead) => {
    const space = spaces.find((space) => space.id === lead.spaceId)
    return space?.type === 'office' ? officeSuiteLabel(space) : space?.unitNumber
  }
  const rows = leads.filter((lead) => [lead.name, lead.businessName, lead.email, lead.phone, lead.enquiryType, lead.interest, spaceLabel(lead), lead.notes, lead.waitingListNotes, lead.currentSpace, lead.waitingListReason]
    .filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (a.waitingListAddedAt || a.createdAt || '').localeCompare(b.waitingListAddedAt || b.createdAt || ''))

  const actions = (lead) => (
    <div className="flex items-center gap-1 justify-end">
      <button type="button" onClick={() => onEdit(lead)} aria-label={`Edit ${lead.name}`} title="Edit waiting-list entry" className="p-2 rounded hover:bg-muted text-muted-foreground"><Pencil size={15} /></button>
      <button type="button" onClick={() => onRemove(lead)} aria-label={`Remove ${lead.name} from waiting list`} title="Remove from waiting list" className="p-2 rounded hover:bg-muted text-muted-foreground"><X size={15} /></button>
    </div>
  )
  const name = (lead) => (
    <div>
      <button type="button" onClick={() => onOpen(lead)} className="font-medium text-foreground text-left hover:underline">{lead.name || lead.businessName || 'Unnamed contact'}</button>
      {lead.businessName && <div className="text-xs text-muted-foreground">{lead.businessName}</div>}
    </div>
  )
  const interest = (lead) => [lead.enquiryType || lead.interest, spaceLabel(lead) || FLOOR_LABELS[lead.preferredFloor], lead.preferredPax ? `Minimum ${lead.preferredPax} pax` : ''].filter(Boolean).join(' · ') || 'Any suitable office suite'
  const start = (lead) => lead.preferredStartAsap ? 'ASAP' : dateLabel(lead.preferredStartDate)
  const availability = (lead) => {
    const available = matches[lead.id] || []
    const lastSent = (lead.waitingListNotifications || []).at(-1)
    return <div className="space-y-1">
      <p className={`text-xs ${available.length ? 'text-green-700 font-medium' : 'text-muted-foreground'}`}>{available.length ? `${available.length} ${available.length === 1 ? 'office available' : 'offices available'}` : 'Waiting for availability'}</p>
      {available.length > 0 && <button type="button" onClick={() => onNotify(lead)} className="inline-flex items-center gap-1 text-xs font-medium border border-input rounded-md px-2 py-1.5 hover:bg-muted"><Mail size={13} /> Review email</button>}
      {lastSent && <p className="text-xs text-muted-foreground">Last emailed {dateLabel(lastSent.sentAt)}</p>}
    </div>
  }
  const request = (lead) => (
    <div>
      <span className={`text-xs px-2 py-1 rounded ${lead.kind === 'member' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-800'}`}>{lead.waitingListReason || 'Waiting for availability'}</span>
      {lead.currentSpace && <p className="text-xs text-muted-foreground mt-2">Current: {lead.currentSpace}</p>}
    </div>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input aria-label="Search waiting list" placeholder="Search name, company, contact or requirements…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 border border-input rounded-md px-3 py-2 text-sm" />
        <div className="flex gap-1 bg-muted rounded-md p-0.5" role="group" aria-label="Waiting list view">
          {[['table', Table2, 'Table'], ['list', List, 'List']].map(([key, Icon, label]) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded ${view === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}><Icon size={15} />{label}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{rows.length} {rows.length === 1 ? 'person' : 'people'} · Longest waiting first</p>
      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <ClipboardList size={26} className="mx-auto mb-2" />
          <p className="text-sm">{search.trim() || filtered ? 'No entries match your filters.' : 'Your waiting list is empty. Add an existing member, an existing enquiry or a new lead.'}</p>
        </div>
      ) : view === 'table' ? (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wide">
              <tr>{['Name', 'Request', 'Contact', 'Interested in', 'Preferred start', 'Availability', 'Waiting since', 'Actions'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{name(lead)}</td>
                  <td className="px-4 py-3">{request(lead)}</td>
                  <td className="px-4 py-3 text-muted-foreground"><div>{lead.email || '—'}</div><div>{lead.phone}</div></td>
                  <td className="px-4 py-3">{interest(lead)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{start(lead)}</td>
                  <td className="px-4 py-3">{availability(lead)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{dateLabel(lead.waitingListAddedAt || lead.createdAt)}</td>
                  <td className="px-4 py-3">{actions(lead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((lead) => (
            <li key={lead.id} className="bg-card border border-border rounded-xl p-4 text-sm">
              <div className="flex items-start justify-between gap-3">{name(lead)}{actions(lead)}</div>
              <div className="mt-2">{request(lead)}</div>
              <p className="mt-2">{interest(lead)}</p>
              <p className="text-muted-foreground break-words">{[lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
              <p className="text-xs text-muted-foreground mt-2">Waiting since {dateLabel(lead.waitingListAddedAt || lead.createdAt)} · Preferred start: {start(lead)}</p>
              <div className="mt-2">{availability(lead)}</div>
              {(lead.waitingListNotes || lead.notes) && <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{lead.waitingListNotes || lead.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
