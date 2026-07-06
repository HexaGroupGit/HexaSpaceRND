// PaperCut MF ← Hexa: provision members (the OfficeRnD model).
//
// Pulls the active Hexa member roster from /api/papercut/members and ensures each
// one exists as a PaperCut internal user: company → group, member → user, with a
// generated PIN as their printer identity. NO password is copied from Hexa —
// members authenticate at the device with their PIN. See docs/papercut-integration.md.
//
// RUNS ON THE LAN (same box/.env as the other connector scripts).
//   PAPERCUT_AUTH_TOKEN, PAPERCUT_SERVER (default http://localhost:9191),
//   HEXA_ROSTER_URL (default https://portal.hexaspace.com.au/api/papercut/members),
//   PAPERCUT_SYNC_TOKEN
//
// SAFETY: this WRITES to your live PaperCut server (creates users, groups). It is
// DRY-RUN BY DEFAULT — it only reports what it would do. To actually apply, set
// PAPERCUT_PROVISION_APPLY=1. Existing users' PINs are never overwritten.
// After a successful provision run, run sync-pins.mjs to pull PINs into Hexa for display.

import xmlrpc from 'xmlrpc'

const SERVER = process.env.PAPERCUT_SERVER || 'http://localhost:9191'
const AUTH = process.env.PAPERCUT_AUTH_TOKEN || ''
const ROSTER_URL = process.env.HEXA_ROSTER_URL || 'https://portal.hexaspace.com.au/api/papercut/members'
const SYNC_TOKEN = process.env.PAPERCUT_SYNC_TOKEN || ''
const APPLY = process.env.PAPERCUT_PROVISION_APPLY === '1'

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, [AUTH, ...params], (err, value) => (err ? reject(err) : resolve(value)))
  })
}

// 6-digit PIN, avoiding any already in use. Index only varies the retry, not entropy
// (Math.random is fine here — collisions are re-rolled against `used`).
function newPin(used) {
  for (let i = 0; i < 50; i++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000))
    if (!used.has(pin)) { used.add(pin); return pin }
  }
  throw new Error('Could not allocate a unique PIN after 50 tries')
}

async function main() {
  if (!AUTH) throw new Error('PAPERCUT_AUTH_TOKEN not set.')
  if (!SYNC_TOKEN) throw new Error('PAPERCUT_SYNC_TOKEN not set (needed to fetch the Hexa roster).')

  // 1. Pull the roster from Hexa.
  const rosterRes = await fetch(ROSTER_URL, { headers: { Authorization: `Bearer ${SYNC_TOKEN}` } })
  const roster = await rosterRes.json()
  if (!rosterRes.ok) throw new Error(`roster fetch failed (${rosterRes.status}): ${JSON.stringify(roster)}`)
  const members = roster.members ?? []
  const used = new Set((roster.usedPins ?? []).map(String))
  console.log(`Roster: ${members.length} active Hexa members. ${APPLY ? 'APPLY mode' : 'DRY RUN (set PAPERCUT_PROVISION_APPLY=1 to write)'}.`)

  // 2. Connect to PaperCut.
  const url = new URL(SERVER)
  const isHttps = url.protocol === 'https:'
  const opts = { host: url.hostname, port: Number(url.port) || (isHttps ? 9192 : 9191), path: '/rpc/api/xmlrpc' }
  const client = isHttps ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts)

  const groupsSeen = new Set()
  const created = [], updated = [], errors = []

  for (const m of members) {
    try {
      const exists = await call(client, 'api.isUserExists', [m.email])

      // Ensure the company group exists (idempotent; AddNewGroup on an existing
      // group is a no-op or benign error we swallow).
      if (m.companyName && !groupsSeen.has(m.companyName)) {
        groupsSeen.add(m.companyName)
        if (APPLY) await call(client, 'api.addNewGroup', [m.companyName]).catch(() => {})
      }

      if (!exists) {
        const pin = newPin(used)
        if (APPLY) {
          // addNewInternalUser(auth, username, password, fullName, email, cardId, pin)
          // Random password is never used for login (PIN identity) but the API requires one.
          const pw = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
          await call(client, 'api.addNewInternalUser', [m.email, pw, m.fullName, m.email, '', pin])
          if (m.companyName) await call(client, 'api.addUserToGroup', [m.email, m.companyName]).catch(() => {})
        }
        created.push({ email: m.email, group: m.companyName || null }) // pin not logged
      } else {
        if (APPLY) {
          // Keep the existing PIN; just refresh identity fields + group membership.
          await call(client, 'api.setUserProperty', [m.email, 'full-name', m.fullName]).catch(() => {})
          await call(client, 'api.setUserProperty', [m.email, 'email', m.email]).catch(() => {})
          if (m.companyName) await call(client, 'api.addUserToGroup', [m.email, m.companyName]).catch(() => {})
        }
        updated.push({ email: m.email, group: m.companyName || null })
      }
    } catch (err) {
      errors.push({ email: m.email, reason: err.message })
    }
  }

  console.log(`Created: ${created.length}, Updated: ${updated.length}, Errors: ${errors.length}`)
  if (created.length) console.log('New users:', JSON.stringify(created, null, 2))
  if (errors.length) console.log('Errors:', JSON.stringify(errors, null, 2))
  if (!APPLY) console.log('\nDRY RUN — nothing written. Re-run with PAPERCUT_PROVISION_APPLY=1 to apply, then run sync-pins.mjs.')
  else console.log('\nApplied. Now run: node --env-file=.env sync-pins.mjs  (pulls PINs into Hexa for display)')
}

main().catch((err) => { console.error('PaperCut provisioning failed:', err.message); process.exit(1) })
