// Waiting-list membership lives on the existing lead, preserving its history.
export function isWaitingLead(lead, stages = []) {
  const category = stages.find((stage) => stage.id === lead.stageId)?.category
  return lead.waitingList === true && !lead.tenantId && !lead.dealClosed && category !== 'won' && category !== 'lost'
}

export function waitingListUpdates(enabled) {
  return { waitingList: enabled, waitingListAddedAt: enabled ? new Date().toISOString() : null }
}
