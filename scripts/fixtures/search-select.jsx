import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import SearchSelect from '../../src/components/SearchSelect.jsx'
import AssignableResourceTab from '../../src/components/spaces/AssignableResourceTab.jsx'
import '../../src/index.css'

const tenants = [{ id: 'beda', businessName: 'Beda Solutions' }, { id: 'other', businessName: 'Other Company' }]
const members = [{ id: 'ben', name: 'Ben Example', companyId: 'beda', email: 'ben@example.test' }, { id: 'amy', name: 'Amy Example', companyId: 'other' }]

function Fixture() {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [disabled, setDisabled] = useState(false)
  const [parking, setParking] = useState({ id: 'bay201', type: 'parking', unitNumber: '201', floor: 'l2', status: 'vacant' })
  return <main className="p-6 space-y-8">
    <form onSubmit={(event) => { event.preventDefault(); setSubmitted(new FormData(event.currentTarget).get('member')) }}>
      <div className="h-24 overflow-hidden border p-2 max-w-sm">
        <label htmlFor="member">Member</label>
        <SearchSelect id="member" name="member" required value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} className="w-full border px-3 py-2">
          <option value="">Unassigned</option>
          <optgroup label="Level 2">
            <option value="ben" data-search="ben@example.test 0411222333">Ben Example — Beda Solutions</option>
            <option value="blocked" disabled>Ben Disabled</option>
          </optgroup>
          <optgroup label="Level 4"><option value="amy">Amy Example — Other Company</option></optgroup>
        </SearchSelect>
      </div>
      <button type="submit" className="border px-4 py-2">Submit fixture</button>
      <button type="button" onClick={() => setValue('amy')}>Set externally</button>
      <button type="button" onClick={() => setDisabled(!disabled)}>Toggle disabled</button>
      <output data-testid="value">{value}</output><output data-testid="submitted">{submitted}</output>
    </form>
    <AssignableResourceTab config={{ type: 'parking', noun: 'Parking bay', prefix: '' }} ctx={{ spaces: [parking], tenants, members, leases: [], updateSpace: (id, changes) => setParking((p) => ({ ...p, ...changes })) }} />
    <output data-testid="parking">{parking.assignedMemberId || ''}</output>
  </main>
}
createRoot(document.getElementById('root')).render(<Fixture />)
