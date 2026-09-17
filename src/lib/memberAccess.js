// Which member record opens the portal. Shared by the member portal, the app
// and the server (invite restore, portal status) so they agree.
//
// portalAccess is switched off by offboarding (company has no live contract)
// and by a teammate removal, which also marks the record Former. An archived
// record is hidden from the company's team list.
export function isLiveMember(m) {
  return !!m && m.portalAccess !== false && !['Former', 'archived'].includes(m.status)
}

// A person can hold several records — one per company, and sometimes two for
// the same company (re-added after a removal leaves the old record behind).
// Prefer a live record, newest first; fall back to the newest of the rest.
export function pickMemberRecord(rows) {
  const list = [...(rows ?? [])].sort((a, b) => String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')))
  return list.find(isLiveMember) ?? list[0] ?? null
}
