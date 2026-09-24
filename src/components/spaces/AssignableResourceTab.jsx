import SearchSelect from '../SearchSelect.jsx'
import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, UserPlus, UserMinus, Search, X, Lock, Link2, AlertTriangle } from 'lucide-react'
import {
  FLOORS, CAR_PARK_FLOORS, floorLabel, StatusPill, money, Field, Modal, ic,
  memberOptions, assignmentFor, contractFor, nextUnitNumber,
} from './shared.jsx'
import {
  nextVirtualSuite, virtualSuiteHolding, relinkVirtualSuitePatch, VO_LIST_PRICE,
} from '../../lib/virtualSuites.js'
import {
  PARKING_RATE, PARKING_INCLUDED_LABEL, missingParkingBays, retiredParkingSpaces,
  parkingSetupPrompt, parkingSetupSummary, normalisePlate,
} from '../../lib/parkingBays.js'

// Generic manager for assignable, auto-numbered resources:
// Media Studios, Podcast Room, Parking Slots, Dedicated Desks, Virtual Offices.
// Behaviour is driven by `config` passed from the Spaces shell.
export default function AssignableResourceTab({ ctx, config }) {
  const {
    type, noun, prefix, start = 1,
    rateLabel = 'Monthly Rate', ratePer = '/mo',
    note, autoAssignOnAdd = false,
  } = config
  const { spaces, members, tenants, leases = [], addSpace, updateSpace, deleteSpace, setUpParkingBays } = ctx

  const [editId, setEditId] = useState(undefined) // undefined=closed, null=new
  const [form, setForm] = useState({})
  const [assignFor, setAssignFor] = useState(null)
  const [assignMember, setAssignMember] = useState('')
  const [setupNote, setSetupNote] = useState('')
  const [plateSearch, setPlateSearch] = useState('')

  const isParking = type === 'parking'
  const isVirtual = type === 'virtual'
  // Memoised so the holdings below (one payment schedule per suite) only
  // recompute when the data behind them actually changes.
  const items = useMemo(() => {
    const list = spaces.filter((s) => s.type === type)
    // Car park bays read best in bay-number order: 201, 202 … 432.
    if (isParking) list.sort((a, b) => String(a.unitNumber).localeCompare(String(b.unitNumber), undefined, { numeric: true }))
    return list
  }, [spaces, type, isParking])
  // Match full or partial registrations regardless of case, spaces or hyphens.
  const plateKey = normalisePlate(plateSearch).replace(/[\s-]+/g, '')
  const filteredItems = isParking && plateSearch.trim()
    ? items.filter((space) => plateKey && normalisePlate(space.numberPlate).replace(/[\s-]+/g, '').includes(plateKey))
    : items
  // A resource sold on a contract is taken even when no member is assigned to
  // it — true of a parking bay, and true of a virtual suite, whose number is
  // the member's registered address and so belongs to the CONTRACT, not to
  // whatever the space record happens to have stored.
  //
  // Resolved once per render rather than per lookup: the rent-free test behind
  // each holding builds the contract's whole payment schedule, and the banner,
  // the counts and every row all want the same answer.
  const holdings = useMemo(
    () => (isVirtual
      ? new Map(items.map((s) => [s.id, virtualSuiteHolding(s, { leases, tenants, members, spaces })]))
      : new Map()),
    [isVirtual, items, leases, tenants, members, spaces], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const holdingOf = (s) => holdings.get(s?.id) ?? null
  const contractOf = (s) => (isVirtual ? holdingOf(s)?.lease ?? null : isParking ? contractFor(s, leases) : null)
  const assigned = items.filter((s) => s.assignedMemberId || contractOf(s)).length
  const memberOpts = memberOptions(members, tenants)
  const editHolding = editId ? holdingOf({ id: editId }) : null
  // Suites whose space record no longer agrees with the contract holding them.
  // This used to need a one-off repair script to find (scripts/fix-vo-suites.mjs
  // cleaned up the OfficeRND import); surfacing it here means the next drift is
  // visible the day it happens, while the mail is still reaching the right desk.
  const drifted = [...holdings.entries()]
    .map(([id, h]) => ({ space: items.find((s) => s.id === id), h }))
    .filter(({ space, h }) => space && (h.suiteMismatch || h.companyDrift || h.unlinked || h.rivals.length || h.noRent))
  const setupPrompt = isParking
    ? parkingSetupPrompt(missingParkingBays(spaces).length, retiredParkingSpaces(spaces, leases).length)
    : ''

  function blank() {
    // Virtual offices are numbered in the BUILDING's Level 4 series, so their
    // next number has to dodge the physical suites and the legacy OfficeRND
    // VOs that live only on a contract — nextUnitNumber can only see spaces.
    const { unitNumber } = type === 'virtual'
      ? nextVirtualSuite({ spaces, leases })
      : nextUnitNumber(spaces, type, prefix, start)
    // A suite created with no price reads as "Free" in the table and bills at
    // $0 if a contract is ever pointed at it, so start from the list price.
    return {
      unitNumber, floor: 'l4', size: '', rate: isVirtual ? String(VO_LIST_PRICE) : '',
      attributes: '', numberPlate: '', included: false,
    }
  }
  function openNew() {
    if (autoAssignOnAdd) {
      // Virtual-office style: instantly create the next number, then offer to assign.
      const created = create({ ...blank() })
      setAssignFor(created); setAssignMember('')
      return
    }
    setEditId(null); setForm(blank())
  }
  function openEdit(s) {
    setEditId(s.id)
    setForm({
      unitNumber: s.unitNumber ?? '', floor: s.floor ?? 'l4', size: s.size ?? '', rate: s.rate ?? s.monthlyRate ?? '',
      attributes: s.attributes ?? '', numberPlate: s.numberPlate ?? '', included: !!s.includedInContract,
    })
  }

  // Price fields as stored. A car bay included in the member's licence has no
  // price; parking also records the number plate using the bay.
  function priceFields(f) {
    const rate = f.included ? 0 : f.rate !== '' ? Number(f.rate) : 0
    return {
      monthlyRate: rate, rate,
      ...(isParking ? { numberPlate: normalisePlate(f.numberPlate) || undefined, includedInContract: f.included || undefined } : {}),
    }
  }

  function create(f) {
    const data = {
      type, unitNumber: f.unitNumber, floor: f.floor, size: f.size || undefined,
      ...priceFields(f),
      attributes: f.attributes || undefined, status: 'vacant',
      location: 'whitehorse', address: '830 Whitehorse Rd, Box Hill',
    }
    return addSpace(data)
  }
  function save() {
    if (!form.unitNumber) return
    const data = {
      unitNumber: form.unitNumber, floor: form.floor, size: form.size || undefined,
      ...priceFields(form),
      attributes: form.attributes || undefined,
    }
    if (editId) updateSpace(editId, data)
    else create(form)
    setEditId(undefined)
  }

  function doAssign() {
    const m = members.find((x) => x.id === assignMember)
    // A live contract owns its suite: re-pointing it by hand would leave the
    // signed agreement, the directory and the mail board naming three
    // different companies. Relink repairs drift; assign never overrides.
    const held = isVirtual ? contractOf(assignFor) : null
    if (held) {
      alert(`${assignFor.unitNumber} is held by contract ${held.contractNumber ?? held.id}. Move the contract to a different suite instead of reassigning the space.`)
      setAssignFor(null)
      return
    }
    updateSpace(assignFor.id, {
      assignedMemberId: assignMember || undefined,
      assignedCompanyId: m?.companyId || undefined,
      // occupantTenantId is what the directory, mail board and reconcile pass
      // read; leaving it behind is how a suite ends up assigned here and
      // invisible everywhere else.
      ...(isVirtual ? { occupantTenantId: m?.companyId || undefined } : {}),
      status: assignMember ? 'occupied' : 'vacant',
    })
    setAssignFor(null)
  }

  // Unassigning a virtual suite takes away the address the member registered
  // with ASIC, so it is refused outright while a contract holds it and
  // confirmed when it doesn't. (The number itself is never recycled — see
  // takenSuiteNumbers — so releasing a suite only frees it for its own holder.)
  function unassign(s) {
    const held = contractOf(s)
    if (held) {
      alert(`${s.unitNumber} is held by contract ${held.contractNumber ?? held.id}${held.companyName ? ` (${held.companyName})` : ''}. Terminate or move that contract to release the suite.`)
      return
    }
    const who = assignmentFor(s, members, tenants)
    const warn = isVirtual
      ? `Release ${s.unitNumber} from ${who?.company || who?.name || 'this member'}?

`
        + 'This is their registered business address — mail addressed to it will no longer be matched to them.'
      : `Unassign ${s.unitNumber}?`
    if (!confirm(warn)) return
    updateSpace(s.id, {
      assignedMemberId: undefined, assignedCompanyId: undefined,
      ...(isVirtual ? { occupantTenantId: undefined } : {}),
      status: 'vacant',
    })
  }

  // Re-point a drifted suite at the contract that actually holds it.
  function relink(space) {
    const patch = relinkVirtualSuitePatch(space, holdingOf(space))
    if (Object.keys(patch).length) updateSpace(space.id, patch)
  }

  function remove(s) {
    const held = contractOf(s)
    if (held) {
      alert(`${s.unitNumber} is held by contract ${held.contractNumber ?? held.id}. Deleting it would orphan that contract — terminate the contract first.`)
      return
    }
    const warn = isVirtual
      ? `Delete ${s.unitNumber}?

`
        + 'Suite numbers are never reissued, so this one will not come back and the series will skip it.'
      : `Delete this ${noun.toLowerCase()}?`
    if (confirm(warn)) deleteSpace(s.id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-muted-foreground">
          {items.length} {noun.toLowerCase()}{items.length === 1 ? '' : 's'} · {assigned} assigned · {items.length - assigned} available
        </p>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
          <Plus size={15} /> Add {noun}
        </button>
      </div>
      {note && <p className="text-xs text-muted-foreground mb-4">{note}</p>}
      {!note && <div className="mb-4" />}

      {setupPrompt && setUpParkingBays && (
        <div className="mb-4 flex items-center gap-3 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-3 py-2">
          <span>{setupPrompt} — update Spaces to match the car park plans.</span>
          <button
            onClick={() => setSetupNote(parkingSetupSummary(setUpParkingBays()))}
            className="ml-auto shrink-0 text-xs font-semibold bg-amber-900 text-white px-2.5 py-1.5 rounded-md hover:bg-amber-800"
          >
            Update bays
          </button>
        </div>
      )}
      {setupNote && <p className="text-xs text-green-700 mb-4">{setupNote}</p>}

      {drifted.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={15} aria-hidden="true" />
            {drifted.length} suite{drifted.length === 1 ? '' : 's'} out of step with the contract holding {drifted.length === 1 ? 'it' : 'them'}
          </div>
          <ul className="mt-1.5 space-y-1 text-xs">
            {drifted.map(({ space, h }) => (
              <li key={space.id} className="flex items-center gap-2">
                <span className="font-medium">{space.unitNumber}</span>
                <span>
                  {h.noRent
                    ? `contract ${h.lease.contractNumber ?? h.lease.id} has no rent set for its whole term — it bills nothing and renews silently`
                    : h.rivals.length
                    ? `claimed by ${[h.lease, ...h.rivals].map((l) => l.contractNumber ?? l.id).join(' and ')} — two companies on one address`
                    : h.suiteMismatch
                      ? `contract ${h.lease.contractNumber ?? h.lease.id} says Suite ${h.contractSuite}`
                      : h.companyDrift
                        ? `tagged to a different company than contract ${h.lease.contractNumber ?? h.lease.id}`
                        : `held by contract ${h.lease.contractNumber ?? h.lease.id} but not linked to a company`}
                </span>
                {!h.suiteMismatch && !h.rivals.length && !h.noRent && (
                  <button onClick={() => relink(space)} className="ml-auto shrink-0 font-semibold underline hover:no-underline">
                    Relink
                  </button>
                )}
              </li>
            ))}
          </ul>
          {drifted.some(({ h }) => h.suiteMismatch || h.rivals.length || h.noRent) && (
            <p className="mt-1.5 text-xs">
              A mismatched number, a contested one, or a missing rent has to be settled on the contract — the member registered one of those numbers with ASIC, and the contract’s own pricing lines decide what gets invoiced. Set a rent with rent-free months rather than $0, which never expires. Fix it there, then relink.
            </p>
          )}
        </div>
      )}

      {isParking && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative w-full max-w-sm">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search" aria-label="Search parking by number plate" placeholder="Search number plate…"
              value={plateSearch} onChange={(event) => setPlateSearch(event.target.value)}
              className={`${ic} pl-9 pr-9`} autoComplete="off" spellCheck={false}
            />
            {plateSearch && <button type="button" onClick={() => setPlateSearch('')} aria-label="Clear number plate search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"><X size={15} /></button>}
          </div>
          <p aria-live="polite" className="text-xs text-muted-foreground">{plateSearch.trim() ? `${filteredItems.length} of ${items.length} bays` : 'Search a full or partial plate; spaces and hyphens are ignored.'}</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {[noun, 'Floor', rateLabel, isParking && 'Number plate', 'Assigned to', 'Status'].filter(Boolean).map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 && (
              <tr><td colSpan={isParking ? 7 : 6} className="px-4 py-12 text-center text-muted-foreground text-sm">{isParking && plateSearch.trim() ? `No parking bays match number plate “${plateSearch.trim()}”.` : `No ${noun.toLowerCase()}s yet.`}</td></tr>
            )}
            {filteredItems.map((s) => {
              // A virtual suite's contract outranks the stored assignment —
              // that is the whole point: the fields drift, the contract doesn't.
              const h = holdingOf(s)
              const a = h?.lease
                ? { name: h.member?.name ?? h.lease.memberName ?? '—', company: h.tenant?.businessName ?? h.lease.companyName ?? '' }
                : assignmentFor(s, members, tenants)
              const contract = h?.lease ?? (a ? null : contractOf(s))
              const locked = !!h?.locked
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{s.unitNumber}</div>
                    {s.size && <div className="text-xs text-muted-foreground">{s.size}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{floorLabel(s.floor)}</td>
                  {rateLabel && (
                    <td className="px-4 py-3 font-medium text-foreground">
                      {s.includedInContract ? (
                        <span className="font-normal text-muted-foreground">{PARKING_INCLUDED_LABEL}</span>
                      ) : h?.lease ? (
                        // What the member is charged this month, off the
                        // contract's own pricing step — not the rate stored on
                        // the space, which is a default nobody re-checks.
                        <div>
                          <div className={h.noRent ? 'text-amber-700' : undefined}>
                            {h.noRent ? 'No rent set'
                              : h.complimentary ? 'Complimentary'
                              : h.rentFree ? 'Rent-free'
                              : `${money(h.monthly)}${ratePer}`}
                          </div>
                          {(h.noRent || h.complimentary || h.rentFree || (h.list != null && h.list > (h.monthly ?? 0))) && (
                            <div className={`text-xs font-normal ${h.noRent ? 'text-amber-700' : 'text-muted-foreground'}`}>
                              {h.noRent || h.complimentary ? 'whole term'
                                : h.rentFree ? 'rent-free month'
                                : `was ${money(h.list)}${ratePer}`}
                            </div>
                          )}
                          <div className="text-xs font-normal text-muted-foreground">on contract</div>
                        </div>
                      ) : (s.rate ?? s.monthlyRate) ? (
                        <div>
                          <div>{money(s.rate ?? s.monthlyRate)}{ratePer}</div>
                          {isVirtual && <div className="text-xs font-normal text-muted-foreground">list price</div>}
                        </div>
                      ) : 'Free'}
                    </td>
                  )}
                  {isParking && (
                    <td className="px-4 py-3">
                      {s.numberPlate
                        ? <span className="font-mono text-xs tracking-wider text-foreground border border-border bg-muted/50 rounded px-1.5 py-0.5">{s.numberPlate}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {h?.lease ? (
                      <div>
                        <div className="text-foreground">{a.company || a.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[h.lease.contractNumber && `Contract ${h.lease.contractNumber}`, a.company && a.name !== '—' ? a.name : null]
                            .filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    ) : a ? (
                      <div>
                        <div className="text-foreground">{a.name}</div>
                        {a.company && <div className="text-xs text-muted-foreground">{a.company}</div>}
                      </div>
                    ) : contract ? (
                      <div>
                        <div className="text-foreground">{tenants.find((t) => t.id === contract.tenantId)?.businessName ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{contract.contractNumber ? `Contract ${contract.contractNumber}` : 'On a contract'}</div>
                      </div>
                    ) : <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {locked ? (
                        <span title={`Held by contract ${h.lease.contractNumber ?? h.lease.id} — release it there`} className="flex items-center gap-1 text-xs text-muted-foreground border border-border px-2.5 py-1.5 rounded-md">
                          <Lock size={12} aria-hidden="true" /> On contract
                        </span>
                      ) : s.assignedMemberId ? (
                        <button onClick={() => unassign(s)} title="Unassign" className="flex items-center gap-1 text-xs text-foreground border border-input px-2.5 py-1.5 rounded-md hover:bg-muted/50">
                          <UserMinus size={12} /> Unassign
                        </button>
                      ) : contract ? null : (
                        <button onClick={() => { setAssignFor(s); setAssignMember('') }} className="flex items-center gap-1 text-xs text-primary-foreground bg-primary hover:bg-primary/90 px-2.5 py-1.5 rounded-md font-medium">
                          <UserPlus size={12} /> Assign
                        </button>
                      )}
                      {locked && (h.companyDrift || h.unlinked) && (
                        <button onClick={() => relink(s)} title="Re-point this suite at the contract holding it" className="p-1.5 rounded hover:bg-muted text-amber-600"><Link2 size={14} /></button>
                      )}
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                      <button
                        onClick={() => remove(s)}
                        disabled={locked}
                        title={locked ? 'Held by a live contract' : `Delete this ${noun.toLowerCase()}`}
                        className="p-1.5 rounded text-muted-foreground enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      ><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editId !== undefined && (
        <Modal title={editId ? `Edit ${noun}` : `Add ${noun}`} onClose={() => setEditId(undefined)}>
          <div className="space-y-4">
            {editHolding?.lease && (
              <p className="flex items-start gap-2 text-xs bg-muted/50 border border-border rounded-md px-3 py-2 text-muted-foreground">
                <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Held by contract <span className="font-medium text-foreground">{editHolding.lease.contractNumber ?? editHolding.lease.id}</span>
                  {editHolding.tenant?.businessName ? ` — ${editHolding.tenant.businessName}` : ''}, billing{' '}
                  <span className="font-medium text-foreground">{editHolding.rentFree ? 'rent-free this month' : `${money(editHolding.monthly)}${ratePer}`}</span>.
                  {isVirtual && ' The suite number is their registered business address and the contract sets the price — change either on the contract, not here.'}
                </span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name *">
                <input
                  value={form.unitNumber}
                  onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                  readOnly={isVirtual && !!editHolding?.lease}
                  className={`${ic}${isVirtual && editHolding?.lease ? ' bg-muted text-muted-foreground cursor-not-allowed' : ''}`}
                />
              </Field>
              <Field label="Floor">
                <select value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className={ic}>
                  {(isParking ? CAR_PARK_FLOORS : FLOORS).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </Field>
              <Field label="Size / detail"><input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="optional" className={ic} /></Field>
              {rateLabel && !(isParking && form.included) && (
                <Field label={`${rateLabel} (AUD)`}><input type="number" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className={ic} /></Field>
              )}
              {isParking && (
                <Field label="Number plate">
                  <input value={form.numberPlate} onChange={(e) => setForm({ ...form, numberPlate: e.target.value.toUpperCase() })} placeholder="e.g. ABC123" className={`${ic} uppercase tracking-wider`} />
                </Field>
              )}
            </div>
            {isParking && (
              <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!form.included}
                  onChange={(e) => setForm({ ...form, included: e.target.checked, rate: !e.target.checked && !Number(form.rate) ? PARKING_RATE : form.rate })}
                />
                <span>
                  Included in licence — no separate charge
                  <span className="block text-xs text-muted-foreground mt-0.5">For a bay that comes with the member’s licence agreement. Removes the monthly price.</span>
                </span>
              </label>
            )}
            <Field label="Notes"><textarea rows={2} value={form.attributes} onChange={(e) => setForm({ ...form, attributes: e.target.value })} className={`${ic} resize-none`} /></Field>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setEditId(undefined)} className="px-4 py-2 text-sm text-foreground border border-input rounded-md hover:bg-muted/50">Cancel</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">{editId ? 'Save' : `Add ${noun}`}</button>
            </div>
          </div>
        </Modal>
      )}

      {assignFor && (
        <Modal title={`Assign — ${assignFor.unitNumber}`} onClose={() => setAssignFor(null)}>
          <div className="space-y-4">
            <Field label="Member">
              <SearchSelect aria-label="Member or contact" value={assignMember} onChange={(e) => setAssignMember(e.target.value)} className={ic}>
                <option value="">Unassigned</option>
                {memberOpts.map((m) => <option key={m.id} value={m.id} data-search={[m.email, m.phone, m.search].filter(Boolean).join(' ')}>{m.label}</option>)}
              </SearchSelect>
            </Field>
            <p className="text-xs text-muted-foreground">
              {isVirtual
                ? 'Assigning records the company holding this suite so mail, the directory and the getting-started pack can find them. A suite on a live contract is set from the contract instead and cannot be reassigned here.'
                : `Assigning sets this ${noun.toLowerCase()} to occupied and records which member it belongs to.`}
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setAssignFor(null)} className="px-4 py-2 text-sm text-foreground border border-input rounded-md hover:bg-muted/50">Cancel</button>
              <button onClick={doAssign} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
