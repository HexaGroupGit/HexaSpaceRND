import { authHeaders } from './apiFetch.js'

// Cancel a podcast studio session — or withdraw a request still pending — via
// the server, which waives the session's Booking Fee and tells the client and
// the studio team (api/studio/cancel.js). Used by the portal, the app and the
// admin screens alike, so "no charge" means the same thing everywhere.
//
// `url` maps an /api path to a fetchable URL: the native app passes apiUrl so
// the call reaches the live API instead of the bundled files.
//
// Resolves with the server's answer: { booking, waived, billed, failed, ... }.
// `billed` lists fees that had already gone out on an invoice — those need a
// credit note, which is the studio team's job, not something to pull silently.
export async function cancelStudioSession({ bookingId, reason = '', url = (p) => p }) {
  const r = await fetch(url('/api/studio/cancel'), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ bookingId, reason }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'We couldn’t cancel the session — please try again, or email info@hexaspace.com.au.')

  // Re-run the door-access sweep so the grant for the session is withdrawn.
  // Best-effort: the hourly cron is the safety net.
  ;(async () => {
    try { await fetch(url('/api/salto/room-access'), { method: 'POST', headers: await authHeaders() }) }
    catch { /* cron will catch up */ }
  })()
  return d
}

/**
 * What staff still have to do after a cancellation, or '' when nothing:
 *   billed     — already invoiced/paid → raise a credit note
 *   failed     — the waive itself errored → mark it Waived by hand
 *   unverified — the booking points at a fee that isn't provably this
 *                session's → look before touching it
 */
export function studioCancelFollowUp(d) {
  const sum = (list) => list.reduce((s, f) => s + Number(f.price || 0), 0).toFixed(2)
  const billed = d?.billed ?? []
  const failed = d?.failed ?? []
  const unverified = d?.unverified ?? []
  const lines = []
  if (billed.length) {
    const invs = [...new Set(billed.map((f) => f.invoiceNumber).filter(Boolean))].join(', ')
    lines.push(`A$${sum(billed)} for it had already been ${invs ? `invoiced on ${invs}` : 'invoiced or paid'} — raise a credit note so the client isn't charged.`)
  }
  if (failed.length) lines.push('Its Booking Fee could not be waived automatically — mark it Waived in Fees so it isn\'t billed.')
  if (unverified.length) lines.push(`The booking points at fee ${unverified.map((f) => f.id).join(', ')}, which couldn't be matched to this session, so it was left alone — check it in Fees.`)
  return lines.length ? `Session cancelled. ${lines.join(' ')}` : ''
}
