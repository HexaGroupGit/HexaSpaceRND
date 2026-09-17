// Admin (re)invite to the member portal.
//
// Pass the company the invite is for: the server then also undoes an earlier
// offboarding (login ban lifted, that company's member record switched back
// on) and returns what it changed. The patches are applied to the admin app's
// in-memory copy through updateMember, because a later save of a stale copy
// from this tab would switch portal access off again.
import { authHeaders } from './apiFetch.js'

export async function sendPortalInvite({ email, companyId, updateMember, ...copy }) {
  const r = await fetch('/api/auth/invite', {
    method: 'POST', headers: await authHeaders(),
    body: JSON.stringify({ email, ...(companyId ? { companyId } : {}), ...copy }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? `Invite failed (HTTP ${r.status})`)
  for (const { id, patch } of d.restored ?? []) updateMember?.(id, patch)
  return d
}
