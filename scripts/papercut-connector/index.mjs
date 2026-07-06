// PaperCut MF → Hexa connector.
//
// RUNS ON THE LAN at Box Hill (on/near the PaperCut server), NOT on Vercel — the
// XML-RPC API binds to 127.0.0.1 and the auth token must never leave the network.
// It reads each user's print charge for a billing month and POSTs the batch to
// https://portal.hexaspace.com.au/api/papercut/sync, which lands PaperCut fees for
// the month-end bill run. See docs/papercut-integration.md.
//
// Schedule monthly (Windows Task Scheduler) a day or two before the bill run:
//   node scripts/papercut-connector/index.mjs --period 2026-07
//
// Env (set on the on-prem box, e.g. a .env or the Task Scheduler action):
//   PAPERCUT_SERVER      default http://localhost:9191
//   PAPERCUT_AUTH_TOKEN  the Web Services API auth token (PaperCut → Options → Advanced)
//   HEXA_SYNC_URL        default https://portal.hexaspace.com.au/api/papercut/sync
//   PAPERCUT_SYNC_TOKEN  shared secret; must match the same var on Vercel
//   PAPERCUT_DRY_RUN     '1' → print the payload instead of POSTing
//
// XML-RPC dependency: install once on the box — `npm i xmlrpc` (in this folder).
// Kept out of the app's package.json on purpose: this never runs in the web build.

import xmlrpc from 'xmlrpc'

const SERVER = process.env.PAPERCUT_SERVER || 'http://localhost:9191'
const AUTH = process.env.PAPERCUT_AUTH_TOKEN || ''
const SYNC_URL = process.env.HEXA_SYNC_URL || 'https://portal.hexaspace.com.au/api/papercut/sync'
const SYNC_TOKEN = process.env.PAPERCUT_SYNC_TOKEN || ''
const DRY_RUN = process.env.PAPERCUT_DRY_RUN === '1'

// --period YYYY-MM (defaults to the previous calendar month)
function argPeriod() {
  const i = process.argv.indexOf('--period')
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1]
  const d = new Date()
  d.setDate(0) // last day of previous month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Promisified XML-RPC call. Every PaperCut method takes the auth token first.
function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, [AUTH, ...params], (err, value) => (err ? reject(err) : resolve(value)))
  })
}

async function main() {
  const period = argPeriod()
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`--period must be YYYY-MM, got "${period}"`)
  if (!AUTH) throw new Error('PAPERCUT_AUTH_TOKEN not set.')

  const isHttps = SERVER.startsWith('https')
  const url = new URL(SERVER)
  const opts = { host: url.hostname, port: Number(url.port) || (isHttps ? 9192 : 9191), path: '/rpc/api/xmlrpc' }
  const client = isHttps ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts)

  // Page through all users. api.listUserAccounts(auth, offset, limit) → [usernames].
  const users = []
  for (let offset = 0; ; offset += 1000) {
    const batch = await call(client, 'api.listUserAccounts', [offset, 1000])
    users.push(...batch)
    if (batch.length < 1000) break
  }

  // For each user read the identity + the period charge. HOW you get "the period
  // charge" depends on the account model you settle on (docs §3, open question):
  //
  // CHARGE MODEL (Hexa): each member gets a $30/month print allowance (auto top-up).
  // Printing draws it down at PaperCut's configured rates ($0.30 mono / $0.60 colour).
  // The balance only goes NEGATIVE once they print past $30 — and that negative
  // amount is EXACTLY the overage Hexa bills. PaperCut has already done the
  // mono/colour cost math, so we don't split pages; we just read the balance.
  //   balance >= 0  → still within allowance → owes nothing → skip.
  //   balance <  0  → owes abs(balance).
  //
  // TIMING IS LOAD-BEARING: run this at MONTH-END, BEFORE the balance resets to
  // $30. Run it after the reset and every balance reads +$30 and you bill nothing.
  const usage = []
  for (const email of users) {
    // getUserProperty(auth, user, prop) — props: 'email','balance'
    const [addr, balance] = await Promise.all([
      call(client, 'api.getUserProperty', [email, 'email']).catch(() => ''),
      call(client, 'api.getUserProperty', [email, 'balance']).catch(() => '0'),
    ])
    const bal = Number(balance) || 0
    const amount = bal < 0 ? Math.round(Math.abs(bal) * 100) / 100 : 0
    if (amount <= 0) continue
    usage.push({ email: addr || email, amount, balance: bal })
  }

  const payload = { period, usage }
  console.log(`PaperCut ${period}: ${users.length} users scanned, ${usage.length} over their $30 allowance, total overage A$${usage.reduce((s, u) => s + u.amount, 0).toFixed(2)}`)

  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }
  if (!SYNC_TOKEN) throw new Error('PAPERCUT_SYNC_TOKEN not set (needed to authenticate to Hexa). Use PAPERCUT_DRY_RUN=1 to preview.')

  const res = await fetch(SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SYNC_TOKEN}` },
    body: JSON.stringify(payload),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`sync failed (${res.status}): ${JSON.stringify(out)}`)
  console.log('Synced:', JSON.stringify(out, null, 2))
  if (out.unmatched?.length) console.warn(`⚠ ${out.unmatched.length} emails had no matching member:`, out.unmatched)
}

main().catch((err) => { console.error('PaperCut connector failed:', err.message); process.exit(1) })
