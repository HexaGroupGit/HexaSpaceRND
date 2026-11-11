// Saving a contract from the admin app writes the whole record as this tab last
// loaded it, and leases aren't live-updated. A member signing in the meantime
// (api/sign/submit.js) was therefore erased by the next save from any tab opened
// before they signed. So: read the row, keep a newer signature, and write only
// if the row hasn't moved since — the same compare-and-swap the endpoint uses.

const SIGNED = ['manually_signed', 'e_signed']
const time = (iso) => Date.parse(iso ?? '') || 0

// `local` with any signature the server has that this tab hasn't seen. A re-send
// from this tab after that signature asks for a new one, so it stands.
export function keepServerSignature(local, server) {
  const signedAt = time(server?.tenantSignedAt)
  if (!signedAt || signedAt <= time(local.tenantSignedAt) || signedAt < time(local.eSignSentAt)) return local
  return {
    ...local,
    tenantSignedAt: server.tenantSignedAt,
    tenantSignerName: server.tenantSignerName,
    eSignMemberLink: server.eSignMemberLink,
    eSignAdminLink: server.eSignAdminLink,
    signatureStatus: SIGNED.includes(local.signatureStatus) ? local.signatureStatus : server.signatureStatus,
  }
}

async function writeLease(client, id, data, isDeleted) {
  let seen = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: rows, error } = await client.from('leases').select('data, updated_at').eq('id', id)
    if (error) break
    if (isDeleted()) return
    const row = rows?.[0]
    seen = row?.data ?? null
    const updated_at = new Date().toISOString()
    if (!row) {
      const { error: insertErr } = await client.from('leases').insert({ id, data, updated_at })
      if (!insertErr) return
      continue // another writer created it first: go round and swap against theirs
    }
    const swap = client.from('leases').update({ data: keepServerSignature(data, row.data), updated_at }).eq('id', id)
    const { data: won, error: swapErr } = await (row.updated_at ? swap.eq('updated_at', row.updated_at) : swap.is('updated_at', null)).select('id')
    if (swapErr) break
    if (won?.length) return
  }
  // Couldn't get a clean swap: an admin's edit still beats losing it.
  if (isDeleted()) return
  const { error } = await client.from('leases').upsert({ id, data: keepServerSignature(data, seen), updated_at: new Date().toISOString() })
  if (error) console.error('Supabase sync (leases):', error)
}

// One write at a time per contract, latest state wins — retries must never let
// an older save land after a newer one.
const pending = new Map() // id → newest unsaved data (null while one is in flight)
const deleted = new Set()

export function saveLease(client, id, data) {
  const running = pending.has(id)
  pending.set(id, data)
  if (running) return
  ;(async () => {
    while (pending.get(id)) {
      const next = pending.get(id)
      pending.set(id, null)
      try { await writeLease(client, id, next, () => deleted.has(id)) }
      catch (e) { console.error('Supabase sync (leases):', e) }
    }
    pending.delete(id)
  })()
}

// A deleted contract must not be brought back by a save still in flight.
export function forgetLease(id) {
  deleted.add(id)
  if (pending.has(id)) pending.set(id, null)
}
