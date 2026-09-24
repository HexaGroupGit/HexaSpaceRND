import { virtualSuiteHolding, virtualSuiteContract, relinkVirtualSuitePatch } from '../src/lib/virtualSuites.js'
import { monthlyRentNow } from '../src/lib/leasePricing.js'

let failed = 0
const check = (label, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`); if (!ok) failed++ }

const tenants = [{ id: 't1', businessName: 'Acme Pty Ltd' }, { id: 't2', businessName: 'Other Co' }]
const members = [{ id: 'm1', name: 'Jo Tan', companyId: 't1' }]

// 1. stepped + discounted contract: the CURRENT step wins, not lease.monthlyRent
const s429 = { id: 'hx_vo_suite_429', type: 'virtual', unitNumber: 'Suite 429', floor: 'l4', rate: 150, assignedCompanyId: 't1' }
const l1 = {
  id: 'CON-301', contractNumber: 'CON-301', tenantId: 't1', memberId: 'm1', status: 'active',
  spaceId: s429.id, resource: 'Virtual Office Plus · Suite 429', monthlyRent: 150,
  startDate: '2026-01-01', endDate: '2027-12-31',
  items: [{ spaceId: s429.id, steps: [
    { startDate: '2026-01-01', endDate: '2026-06-30', listPrice: 150, qty: 1, discount: '20%' },
    { startDate: '2026-07-01', endDate: '2027-12-31', listPrice: 165, qty: 1, discount: '' },
  ] }],
}
const h1 = virtualSuiteHolding(s429, { leases: [l1], tenants, members, spaces: [s429] })
check('current step prices the suite (not stale monthlyRent)', h1.monthly === 165 && h1.lease.contractNumber === 'CON-301')
check('company resolved from the contract', h1.tenant?.businessName === 'Acme Pty Ltd')
check('held suite is locked', h1.locked === true && h1.suite === 429 && !h1.suiteMismatch)

// 2. migrated VO: number on the contract only, dangling spaceId
const s424 = { id: 'hx_vo_CON-9', type: 'virtual', unitNumber: 'Suite 424', floor: 'l4', rate: 0 }
const l2 = { id: 'CON-9', contractNumber: 'CON-9', tenantId: 't2', status: 'active', spaceId: 'gone_id', resource: 'Suite 424', monthlyRent: 75, startDate: '2025-03-01' }
const h2 = virtualSuiteHolding(s424, { leases: [l2], tenants, members, spaces: [s424] })
check('migrated VO matched by suite number', h2.lease?.contractNumber === 'CON-9' && h2.monthly === 75 && h2.unlinked)
check('relink patch repairs the link + rate', relinkVirtualSuitePatch(s424, h2).assignedCompanyId === 't2')

// 3. space and contract disagree on the number
const s430 = { id: 'hx_vo_x', type: 'virtual', unitNumber: 'Suite 430', floor: 'l4', assignedCompanyId: 't1' }
const l3 = { ...l1, id: 'CON-5', contractNumber: 'CON-5', spaceId: s430.id, resource: 'Suite 414', items: undefined }
const h3 = virtualSuiteHolding(s430, { leases: [l3], tenants, members, spaces: [s430] })
check('suite-number mismatch detected', h3.suiteMismatch && h3.suite === 430 && h3.contractSuite === 414)

// 4. company drift — the contract's company is shown, not the stale tag
const s431 = { id: 'hx_vo_y', type: 'virtual', unitNumber: 'Suite 431', floor: 'l4', assignedCompanyId: 't2' }
const l4 = { ...l1, id: 'CON-7', contractNumber: 'CON-7', spaceId: s431.id, resource: 'Suite 431', items: undefined }
const h4 = virtualSuiteHolding(s431, { leases: [l4], tenants, members, spaces: [s431] })
check('company drift detected, contract wins', h4.companyDrift && h4.tenant?.businessName === 'Acme Pty Ltd')

// 4b. relink must not demote an occupied suite back to reserved
const sOcc = { id: 'hx_vo_occ', type: 'virtual', unitNumber: 'Suite 450', floor: 'l4', status: 'occupied', assignedCompanyId: 't1' }
const lPend = { ...l1, id: 'CON-8', contractNumber: 'CON-8', status: 'pending', spaceId: sOcc.id, resource: 'Suite 450', items: undefined }
const hOcc = virtualSuiteHolding(sOcc, { leases: [lPend], tenants, members, spaces: [sOcc] })
check('relink never demotes occupied -> reserved', !('status' in relinkVirtualSuitePatch(sOcc, hOcc)))
const sVac = { ...sOcc, id: 'hx_vo_vac', status: 'vacant' }
const lPend2 = { ...lPend, spaceId: sVac.id }
const hVac = virtualSuiteHolding(sVac, { leases: [lPend2], tenants, members, spaces: [sVac] })
check('relink still promotes vacant -> reserved', relinkVirtualSuitePatch(sVac, hVac).status === 'reserved')

// 5. free suite, no contract → not locked
const s432 = { id: 'hx_vo_z', type: 'virtual', unitNumber: 'Suite 432', floor: 'l4', rate: 150 }
const h5 = virtualSuiteHolding(s432, { leases: [l1], tenants, members, spaces: [s432] })
check('unheld suite is assignable', !h5.locked && h5.lease === null)

// 6. a dead contract must not lock a suite
const l6 = { ...l1, id: 'CON-99', status: 'terminated', spaceId: s432.id }
check('terminated contract does not lock', !virtualSuiteContract(s432, [l6], [s432]))

// 7. promotional free month vs no rent at all
const lFree = { id: 'CON-400', contractNumber: 'CON-400', tenantId: 't1', status: 'active', spaceId: s429.id,
  startDate: '2026-04-01', endDate: '2026-09-30', rentFreeMonths: 2, monthlyRent: 150,
  items: [{ spaceId: s429.id, steps: [{ startDate: '2026-04-01', endDate: '2026-09-30', listPrice: 150, qty: 1 }] }] }
const hFree = virtualSuiteHolding(s429, { leases: [lFree], tenants, members, spaces: [s429] })
check('rent-free month flagged, not no-rent', hFree.rentFree && !hFree.noRent && hFree.monthly === 0)

// $0 has two spellings — both must read as "no rent", neither as "rent-free".
const lZero = { id: 'CON-401', contractNumber: 'CON-401', tenantId: 't1', status: 'active', spaceId: s429.id,
  startDate: '2026-07-01', endDate: '2027-03-31', monthlyRent: 0 }
const lDisc = { id: 'CON-402', contractNumber: 'CON-402', tenantId: 't1', status: 'active', spaceId: s429.id,
  startDate: '2026-07-01', endDate: '2027-03-31', monthlyRent: 0, listPrice: 150, discount: '100%' }
for (const [label, l] of [['monthlyRent: 0', lZero], ['100% discount', lDisc]]) {
  const h = virtualSuiteHolding(s429, { leases: [l], tenants, members, spaces: [s429] })
  check(`no rent set (${label}) flagged as noRent`, h.noRent && !h.rentFree)
}

// 7b. a freebie declared on the contract is not an error
const lComp = { ...lDisc, id: 'CON-403', contractNumber: 'CON-403', complimentary: true }
const hComp = virtualSuiteHolding(s429, { leases: [lComp], tenants, members, spaces: [s429] })
check('declared complimentary is not flagged as noRent', hComp.complimentary && !hComp.noRent && hComp.monthly === 0)

// 8. past the last step the price holds — an expired schedule must not read $0
const l8 = { id: 'CON-500', contractNumber: 'CON-500', tenantId: 't1', status: 'active', spaceId: s429.id, monthlyRent: 150,
  startDate: '2024-01-01', items: [{ spaceId: s429.id, steps: [{ startDate: '2024-01-01', endDate: '2024-12-31', listPrice: 140, qty: 1 }] }] }
check('expired schedule holds its last price', monthlyRentNow(l8, { spaceId: s429.id }).monthly === 140)

// 9. bundled parking must not inflate the suite's line
const l9 = { id: 'CON-600', contractNumber: 'CON-600', tenantId: 't1', status: 'active', spaceId: s429.id, monthlyRent: 450,
  startDate: '2026-01-01', items: [
    { spaceId: s429.id, steps: [{ startDate: '2026-01-01', listPrice: 150, qty: 1 }] },
    { spaceId: 'hx_park_P12', steps: [{ startDate: '2026-01-01', listPrice: 300, qty: 1 }] },
  ] }
check('suite line excludes bundled parking', monthlyRentNow(l9, { spaceId: s429.id }).monthly === 150 && monthlyRentNow(l9).monthly === 450)

// 10. claim ranking: a primary spaceId beats a stale items[] entry, whatever the order
const rival = { ...l1, id: 'CON-800', contractNumber: 'CON-800', tenantId: 't2', spaceId: 'other', items: [{ spaceId: s429.id, steps: [{ startDate: '2026-01-01', listPrice: 99, qty: 1 }] }] }
for (const order of [[rival, l1], [l1, rival]]) {
  const h = virtualSuiteHolding(s429, { leases: order, tenants, members, spaces: [s429, { id: 'other', type: 'virtual', unitNumber: 'Suite 440' }] })
  check(`spaceId outranks items[] (order ${order[0].contractNumber} first)`, h.lease.contractNumber === 'CON-301' && h.rivals.length === 1)
}

// 11. an unsigned pending quoting a live member's number is not a claim on it
const pending = { id: 'CON-900', contractNumber: 'CON-900', tenantId: 't2', status: 'pending', spaceId: 'hx_vo_CON-900', resource: 'Suite 429', monthlyRent: 150, startDate: '2026-09-01' }
const h11 = virtualSuiteHolding(s429, { leases: [l1, pending], tenants, members, spaces: [s429] })
check('pending quoting a held number is not a rival', h11.lease.contractNumber === 'CON-301' && h11.rivals.length === 0)

console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`)
process.exit(failed === 0 ? 0 : 1)
