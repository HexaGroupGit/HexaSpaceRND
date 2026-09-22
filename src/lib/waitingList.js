// Waiting-list membership lives on the existing lead, preserving its history.
export function isWaitingLead(lead, stages = []) {
  const category = stages.find((stage) => stage.id === lead.stageId)?.category
  return lead.waitingList === true && !lead.tenantId && !lead.dealClosed && category !== 'won' && category !== 'lost'
}

export function waitingListUpdates(enabled) {
  return { waitingList: enabled, waitingListAddedAt: enabled ? new Date().toISOString() : null }
}

export function memberCurrentSpaces(member, leases = [], spaces = []) {
  const ids = new Set(leases.filter((lease) => lease.status === 'active' && (
    lease.memberId === member.id || (member.companyId && lease.tenantId === member.companyId)
  )).map((lease) => lease.spaceId))
  return spaces.filter((space) => ids.has(space.id)).map((space) => space.unitNumber).join(', ')
}

// Member requests stay on the member record, so an upsize never creates a second
// tenant or changes their current contracts, billing or portal access.
export function waitingListEntries({ leads = [], members = [], tenants = [], pipelineStages = [], leases = [], spaces = [] }) {
  return [
    ...leads.filter((lead) => isWaitingLead(lead, pipelineStages)).map((lead) => ({
      ...lead, id: `lead:${lead.id}`, recordId: lead.id, kind: 'lead',
      waitingListReason: 'Waiting for availability',
    })),
    ...members.filter((member) => member.waitingListRequest?.waitingList === true).map((member) => ({
      ...member.waitingListRequest,
      id: `member:${member.id}`, recordId: member.id, kind: 'member',
      name: member.name, email: member.email, phone: member.phone,
      businessName: tenants.find((tenant) => tenant.id === member.companyId)?.businessName || '',
      currentSpace: memberCurrentSpaces(member, leases, spaces),
      waitingListReason: 'Member upsize',
    })),
  ]
}

export function waitingRequestFields(form, previous = {}) {
  return {
    waitingList: true,
    waitingListAddedAt: previous.waitingList && previous.waitingListAddedAt ? previous.waitingListAddedAt : new Date().toISOString(),
    enquiryType: form.enquiryType.trim(),
    spaceId: form.spaceId,
    preferredFloor: form.preferredFloor || '',
    preferredPax: form.preferredPax ? Number(form.preferredPax) : null,
    preferredStartAsap: form.preferredStartAsap === true,
    preferredStartDate: form.preferredStartAsap ? '' : form.preferredStartDate,
    waitingListNotes: form.waitingListNotes.trim(),
  }
}
