// PaperCut MF → Hexa: sync members' login PINs.
//
// Separate from the billing run (index.mjs) on purpose: PINs change rarely (new
// members), so run this occasionally or after onboarding — not tied to month-end.
// Reads each user's `pin` and pushes { email, pin } to /api/papercut/pins, which
// stores them in the access-controlled member_pins table. Members then see their
// OWN pin in the app/portal. See docs/papercut-integration.md.
//
// RUNS ON THE LAN (same as index.mjs). Env (reuse the same .env):
//   PAPERCUT_AUTH_TOKEN, PAPERCUT_SERVER (default http://localhost:9191),
//   HEXA_PINS_URL (default https://portal.hexaspace.com.au/api/papercut/pins),
//   PAPERCUT_SYNC_TOKEN, PAPERCUT_DRY_RUN ('1' → count only, never prints pins)
//
// SECURITY: this script NEVER prints a pin. Dry run reports counts only.

import xmlrpc from 'xmlrpc'

const SERVER = process.env.PAPERCUT_SERVER || 'http://localhost:9191'
const AUTH = process.env.PAPERCUT_AUTH_TOKEN || ''
const PINS_URL = process.env.HEXA_PINS_URL || 'https://portal.hexaspace.com.au/api/papercut/pins'
const SYNC_TOKEN = process.env.PAPERCUT_SYNC_TOKEN || ''
const DRY_RUN = process.env.PAPERCUT_DRY_RUN === '1'

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, [AUTH, ...params], (err, value) => (err ? reject(err) : resolve(value)))
  })
}

async function main() {
  if (!AUTH) throw new Error('PAPERCUT_AUTH_TOKEN not set.')
  const url = new URL(SERVER)
  const isHttps = url.protocol === 'https:'
  const opts = { host: url.hostname, port: Number(url.port) || (isHttps ? 9192 : 9191), path: '/rpc/api/xmlrpc' }
  const client = isHttps ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts)

  const users = []
  for (let offset = 0; ; offset += 1000) {
    const batch = await call(client, 'api.listUserAccounts', [offset, 1000])
    users.push(...batch)
    if (batch.length < 1000) break
  }

  const pins = []
  for (const u of users) {
    // The member's printer login on THIS MF version is the Primary Card/Identity
    // number (`primary-card-number`). `pin`/`card-pin` are NOT valid properties here
    // (the API rejects the names), which is why earlier runs read 0.
    const [email, card] = await Promise.all([
      call(client, 'api.getUserProperty', [u, 'email']).catch(() => ''),
      call(client, 'api.getUserProperty', [u, 'primary-card-number']).catch(() => ''),
    ])
    if (card != null && String(card).length > 0) pins.push({ email: email || u, pin: String(card) })
  }

  // Count only — NEVER print a number.
  console.log(`PaperCut: ${users.length} users scanned, ${pins.length} have a card/login number.`)

  if (DRY_RUN) { console.log('DRY RUN — nothing sent.'); return }
  if (!SYNC_TOKEN) throw new Error('PAPERCUT_SYNC_TOKEN not set. Use PAPERCUT_DRY_RUN=1 to preview counts.')

  const res = await fetch(PINS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SYNC_TOKEN}` },
    body: JSON.stringify({ pins }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`pins sync failed (${res.status}): ${JSON.stringify(out)}`)
  console.log(`Stored ${out.stored} PINs${out.failed ? `, ${out.failed} failed` : ''}.`)
}

main().catch((err) => { console.error('PaperCut pins sync failed:', err.message); process.exit(1) })
