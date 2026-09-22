import { floorOf, FLOOR_LABELS } from './roomFloor.js'
import { holdsSpace } from './spaceHold.js'

export const OFFICE_LEVELS = Object.entries(FLOOR_LABELS).map(([id, label]) => ({ id, label }))

export function officeSuiteLabel(space) {
  if (!space) return ''
  const suite = /^suite\b/i.test(space.unitNumber || '') ? space.unitNumber : `Suite ${space.unitNumber || '—'}`
  return `${FLOOR_LABELS[floorOf(space)] || 'Level not recorded'} · ${suite} · ${Number(space.pax) > 0 ? `${space.pax} pax` : 'Pax not recorded'}`
}

export function officeSuites(spaces = [], level = '') {
  return spaces.filter((space) => space.type === 'office' && (!level || floorOf(space) === level))
    .sort((a, b) => (floorOf(a) || '').localeCompare(floorOf(b) || '') || String(a.unitNumber).localeCompare(String(b.unitNumber), undefined, { numeric: true }))
}

export function matchingAvailableOffices(entry, { spaces = [], leases = [] } = {}) {
  // Old non-office requests must not receive unrelated office availability.
  const interest = entry.enquiryType || entry.interest
  if (!entry.spaceId && interest && !['Private Office', 'Enterprise Suites'].includes(interest)) return []
  return officeSuites(spaces, entry.preferredFloor).filter((space) => {
    if (entry.spaceId && space.id !== entry.spaceId) return false
    if (Number(entry.preferredPax) > 0 && !(Number(space.pax) >= Number(entry.preferredPax))) return false
    if (!['vacant', 'available'].includes(space.status) || space.occupantTenantId || space.occupantName) return false
    // Check primary units AND additional contract items, including pending holds.
    return !leases.some((lease) => holdsSpace(lease) && (lease.spaceId === space.id || (lease.items || []).some((item) => item.spaceId === space.id)))
  })
}

export function availabilityEmailDraft(entry, space) {
  const suite = officeSuiteLabel(space)
  return {
    subject: `Office available: ${suite} — Hexa Space`,
    body: `Hi ${entry.name || entry.businessName || 'there'},\n\n${entry.kind === 'member' ? 'Following your request to upsize at Hexa Space' : 'Following your enquiry about office availability at Hexa Space'}, we have an office available that matches your waiting-list preferences:\n\n${suite}\nAvailable now${space.address ? `\n${space.address}` : ''}\n\n${entry.preferredStartAsap ? 'We noted that you would like to move in as soon as possible. ' : entry.preferredStartDate ? `We noted your preferred start date of ${entry.preferredStartDate.split('-').reverse().join('/')}. ` : ''}Please reply if you are interested, and we can confirm pricing, move-in timing and arrange a viewing.\n\nThe suite is subject to availability until confirmed.\n\nKind regards,\nThe Hexa Space Team`,
  }
}
