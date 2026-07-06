// PaperCut MF ← Hexa: provision members (the OfficeRnD model).
//
// Ensures each active Hexa member has a PaperCut user: company → group, member →
// user, generated PIN identity. NO password is copied — members auth at the device
// with their PIN. See docs/papercut-integration.md.
//
// MATCH BY EMAIL (important): PaperCut enforces unique emails, and existing users
// (synced from OfficeRnD/AD) are keyed by a NON-email username. So we first build an
// email→username map from PaperCut, then:
//   - email already in PaperCut → UPDATE that existing user in place (group, name),
//     keep its username + PIN. (Never create a duplicate — that's what broke before.)
//   - email not in PaperCut → CREATE a new internal user (username = email, gen PIN).
// Because we read the full email map first, the DRY RUN is now accurate — it foresees
// create-vs-update correctly instead of only checking the username.
//
// RUNS ON THE LAN (localhost). Env: PAPERCUT_AUTH_TOKEN, PAPERCUT_SERVER
// (default http://localhost:9191), HEXA_ROSTER_URL, PAPERCUT_SYNC_TOKEN.
// SAFETY: DRY-RUN by default; writes only with PAPERCUT_PROVISION_APPLY=1.

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

  // 1. Roster from Hexa (already deduped + demo-filtered server-side).
  const rosterRes = await fetch(ROSTER_URL, { headers: { Authorization: `Bearer ${SYNC_TOKEN}` } })
  const roster = await rosterRes.json()
  if (!rosterRes.ok) throw new Error(`roster fetch failed (${rosterRes.status}): ${JSON.stringify(roster)}`)
  const members = roster.members ?? []
  const used = new Set((roster.usedPins ?? []).map(String))
  console.log(`Roster: ${members.length} active Hexa members. ${APPLY ? 'APPLY mode' : 'DRY RUN (set PAPERCUT_PROVISION_APPLY=1 to write)'}.`)

  // 2. Connect.
  const url = new URL(SERVER)
  const isHttps = url.protocol === 'https:'
  const opts = { host: url.hostname, port: Number(url.port) || (isHttps ? 9192 : 9191), path: '/rpc/api/xmlrpc' }
  const client = isHttps ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts)

  // 3. Build email → username map from ALL existing PaperCut users. This is what
  // makes match-by-email (and an accurate dry run) possible.
  console.log('Indexing existing PaperCut users by email…')
  const allUsers = []
  for (let off = 0; ; off += 1000) {
    const batch = await call(client, 'api.listUserAccounts', [off, 1000])
    allUsers.push(...batch)
    if (batch.length < 1000) break
  }
  const emailToUser = new Map()
  for (const uname of allUsers) {
    const em = await call(client, 'api.getUserProperty', [uname, 'email']).catch(() => '')
    if (em && String(em).length) emailToUser.set(String(em).toLowerCase(), uname)
  }
  console.log(`Indexed ${allUsers.length} PaperCut users, ${emailToUser.size} with an email.`)

  // 4. Reconcile.
  const toCreate = [], toUpdate = [], errors = []
  const groupsSeen = new Set()

  for (const m of members) {
    try {
      const existingUser = emailToUser.get(m.email)

      if (m.companyName && !groupsSeen.has(m.companyName)) {
        groupsSeen.add(m.companyName)
        if (APPLY) await call(client, 'api.addNewGroup', [m.companyName]).catch(() => {})
      }

      if (existingUser) {
        // Update the EXISTING user in place — keep its username + PIN.
        if (APPLY) {
          await call(client, 'api.setUserProperty', [existingUser, 'full-name', m.fullName]).catch(() => {})
          if (m.companyName) await call(client, 'api.addUserToGroup', [existingUser, m.companyName]).catch(() => {})
        }
        toUpdate.push({ email: m.email, username: existingUser, group: m.companyName || null })
      } else {
        const pin = newPin(used)
        if (APPLY) {
          const pw = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
          await call(client, 'api.addNewInternalUser', [m.email, pw, m.fullName, m.email, '', pin])
          if (m.companyName) await call(client, 'api.addUserToGroup', [m.email, m.companyName]).catch(() => {})
        }
        toCreate.push({ email: m.email, group: m.companyName || null }) // pin not logged
      }
    } catch (err) {
      errors.push({ email: m.email, reason: err.message })
    }
  }

  console.log(`\nWould ${APPLY ? '' : '(dry-run) '}CREATE: ${toCreate.length}, UPDATE existing: ${toUpdate.length}, Errors: ${errors.length}`)
  if (errors.length) console.log('Errors:', JSON.stringify(errors.slice(0, 20), null, 2))
  if (!APPLY) console.log('\nDRY RUN — nothing written. This forecast is accurate (email-matched). Re-run with PAPERCUT_PROVISION_APPLY=1 to apply, then run sync-pins.mjs.')
  else console.log('\nApplied. Now run: node --env-file=.env sync-pins.mjs')
}

main().catch((err) => { console.error('PaperCut provisioning failed:', err.message); process.exit(1) })
