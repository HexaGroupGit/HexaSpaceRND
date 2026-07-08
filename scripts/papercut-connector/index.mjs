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

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Adjust a user's balance by `delta` dollars. PaperCut's balance methods require a
// <double>; node-xmlrpc serialises whole-dollar amounts (e.g. 30.0) as <int>, which
// PaperCut rejects — so post this one call as raw XML with an explicit <double>.
async function adjustBalanceDouble(rpcUrl, user, delta, comment) {
  const xml = `<?xml version="1.0"?><methodCall>` +
    `<methodName>api.adjustUserAccountBalance</methodName><params>` +
    `<param><value><string>${xmlEsc(AUTH)}</string></value></param>` +
    `<param><value><string>${xmlEsc(user)}</string></value></param>` +
    `<param><value><double>${delta.toFixed(2)}</double></value></param>` +
    `<param><value><string>${xmlEsc(comment)}</string></value></param>` +
    `</params></methodCall>`
  const r = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml })
  const text = await r.text()
  if (!r.ok || text.includes('<fault>') || !text.includes('<boolean>1</boolean>')) {
    throw new Error(text.replace(/\s+/g, ' ').slice(0, 200))
  }
}

async function main() {
  const period = argPeriod()
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`--period must be YYYY-MM, got "${period}"`)
  if (!AUTH) throw new Error('PAPERCUT_AUTH_TOKEN not set.')

  const isHttps = SERVER.startsWith('https')
  const url = new URL(SERVER)
  const opts = { host: url.hostname, port: Number(url.port) || (isHttps ? 9192 : 9191), path: '/rpc/api/xmlrpc' }
  const client = isHttps ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts)
  const rpcUrl = `${isHttps ? 'https' : 'http'}://${opts.host}:${opts.port}${opts.path}`

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
  // CHARGE MODEL (Hexa): each member gets a $30/month print allowance. Printing draws
  // it down at PaperCut's rates (A4 $0.30 mono / $0.60 colour · A3 $0.60 / $1.20).
  // Accounts are RESTRICTED but with OVERDRAFT enabled, so members are never blocked —
  // they print past $30 and the balance goes NEGATIVE. That negative amount is exactly
  // the overage Hexa bills. PaperCut already did the mono/colour cost math, so we just
  // read the balance.
  //   balance >= 0  → still within allowance → owes nothing → skip.
  //   balance <  0  → owes abs(balance); AFTER billing we reset them to $30 (below).
  //
  // TIMING IS LOAD-BEARING: run this at MONTH-END, BEFORE the native monthly quota
  // allocation. We reset billed members to $30 ourselves (the native quota only ADDS
  // $30 and won't lift a −$50 balance back to +$30). Run it after the allocation and
  // balances read higher and you under-bill.
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
    usage.push({ user: email, email: addr || email, amount, balance: bal })
  }

  const payload = { period, usage }
  console.log(`PaperCut ${period}: ${users.length} users scanned, ${usage.length} over their $30 allowance, total overage A$${usage.reduce((s, u) => s + u.amount, 0).toFixed(2)}`)

  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2))
    console.log(`(dry-run) would reset ${usage.length} billed member(s) to $30 after billing.`)
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

  // Reset each billed member's balance to $30 for the new month, so the same overage
  // is never billed twice. delta = 30 − (their negative balance). ONLY runs on a live,
  // successful sync (never in dry-run, and never if the POST above threw). The native
  // monthly quota tops up everyone else and, with MaxAccumulation=$30, won't push a
  // just-reset member above $30 — so no double credit. Must run at month-end BEFORE
  // the native quota allocation.
  let reset = 0
  const resetFailed = []
  for (const u of usage) {
    const delta = Math.round((30 - u.balance) * 100) / 100
    try { await adjustBalanceDouble(rpcUrl, u.user, delta, `Hexa ${period} overage billed — reset to $30`); reset++ }
    catch (e) { resetFailed.push({ user: u.user, error: e.message }) }
  }
  console.log(`Reset ${reset}/${usage.length} billed member(s) to $30.`)
  if (resetFailed.length) {
    console.error(`⚠ ${resetFailed.length} balance reset(s) FAILED — these members were billed but NOT reset; fix manually or they'll be re-billed next month:`, resetFailed)
    process.exitCode = 1
  }
}

main().catch((err) => { console.error('PaperCut connector failed:', err.message); process.exit(1) })
