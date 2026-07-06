// PaperCut MF ← Hexa: provision members (the OfficeRnD model).
//
// Ensures each active Hexa member has a PaperCut user AND a printer login number
// (the Primary Card/Identity number, `primary-card-number` — what members type at
// the copier). NO password is copied from Hexa. See docs/papercut-integration.md.
//
// LOGIN NUMBER RULES (as requested):
//   - member already HAS a primary-card-number  → keep it (never overwrite).
//   - member has none / is newly created        → generate a unique number + set it.
// After this runs, sync-pins.mjs reads primary-card-number → member_pins → the number
// shows on the member's app + portal.
//
// MATCH BY EMAIL: existing users (OfficeRnD/AD) are keyed by non-email usernames and
// PaperCut enforces unique emails, so we build an email→username map first and update
// in place — never creating duplicates. This also makes the dry run accurate.
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

// Unique login number, avoiding all numbers already in use. 4 digits to match the
// existing style (e.g. 5927); widen to 6 if the 4-digit space is exhausted.
function newCard(used) {
  for (let i = 0; i < 300; i++) { const c = String(Math.floor(1000 + Math.random() * 9000)); if (!used.has(c)) { used.add(c); return c } }
  for (let i = 0; i < 300; i++) { const c = String(Math.floor(100000 + Math.random() * 900000)); if (!used.has(c)) { used.add(c); return c } }
  throw new Error('Could not allocate a unique card number')
}

async function main() {
  if (!AUTH) throw new Error('PAPERCUT_AUTH_TOKEN not set.')
  if (!SYNC_TOKEN) throw new Error('PAPERCUT_SYNC_TOKEN not set (needed to fetch the Hexa roster).')

  // 1. Roster from Hexa (deduped + demo-filtered server-side).
  const rosterRes = await fetch(ROSTER_URL, { headers: { Authorization: `Bearer ${SYNC_TOKEN}` } })
  const roster = await rosterRes.json()
  if (!rosterRes.ok) throw new Error(`roster fetch failed (${rosterRes.status}): ${JSON.stringify(roster)}`)
  const members = roster.members ?? []
  console.log(`Roster: ${members.length} active Hexa members. ${APPLY ? 'APPLY mode' : 'DRY RUN (set PAPERCUT_PROVISION_APPLY=1 to write)'}.`)

  // 2. Connect.
  const url = new URL(SERVER)
  const isHttps = url.protocol === 'https:'
  const opts = { host: url.hostname, port: Number(url.port) || (isHttps ? 9192 : 9191), path: '/rpc/api/xmlrpc' }
  const client = isHttps ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts)

  // 3. Index existing users by email, and collect used card numbers (so generated
  // ones never collide, and so we can preserve numbers members already have).
  console.log('Indexing existing PaperCut users (email + card number)…')
  const allUsers = []
  for (let off = 0; ; off += 1000) {
    const batch = await call(client, 'api.listUserAccounts', [off, 1000])
    allUsers.push(...batch)
    if (batch.length < 1000) break
  }
  const emailToUser = new Map()
  const emailToCard = new Map()
  const usedCards = new Set()
  for (const uname of allUsers) {
    const [em, card] = await Promise.all([
      call(client, 'api.getUserProperty', [uname, 'email']).catch(() => ''),
      call(client, 'api.getUserProperty', [uname, 'primary-card-number']).catch(() => ''),
    ])
    if (em && String(em).length) {
      emailToUser.set(String(em).toLowerCase(), uname)
      if (card && String(card).length) emailToCard.set(String(em).toLowerCase(), String(card))
    }
    if (card && String(card).length) usedCards.add(String(card))
  }
  console.log(`Indexed ${allUsers.length} users; ${emailToCard.size} already have a card number.`)

  // 4. Reconcile.
  const created = [], assignedCard = [], keptCard = [], errors = []
  const groupsSeen = new Set()

  for (const m of members) {
    try {
      const existingUser = emailToUser.get(m.email)

      if (m.companyName && !groupsSeen.has(m.companyName)) {
        groupsSeen.add(m.companyName)
        if (APPLY) await call(client, 'api.addNewGroup', [m.companyName]).catch(() => {})
      }

      if (existingUser) {
        // Update in place. Keep their username + PIN.
        if (APPLY) {
          await call(client, 'api.setUserProperty', [existingUser, 'full-name', m.fullName]).catch(() => {})
          if (m.companyName) await call(client, 'api.addUserToGroup', [existingUser, m.companyName]).catch(() => {})
        }
        if (emailToCard.has(m.email)) {
          keptCard.push(m.email) // already has a number → leave it
        } else {
          const card = newCard(usedCards) // no number yet → assign one
          if (APPLY) await call(client, 'api.setUserProperty', [existingUser, 'primary-card-number', card])
          assignedCard.push(m.email)
        }
      } else {
        // Create a new internal user WITH a generated card (6th arg = cardId).
        const card = newCard(usedCards)
        if (APPLY) {
          const pw = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
          await call(client, 'api.addNewInternalUser', [m.email, pw, m.fullName, m.email, card, ''])
          if (m.companyName) await call(client, 'api.addUserToGroup', [m.email, m.companyName]).catch(() => {})
        }
        created.push(m.email)
      }
    } catch (err) {
      errors.push({ email: m.email, reason: err.message })
    }
  }

  console.log(`\n${APPLY ? '' : '(dry-run) '}CREATE new: ${created.length}, ASSIGN card to existing: ${assignedCard.length}, KEEP existing card: ${keptCard.length}, Errors: ${errors.length}`)
  if (errors.length) console.log('Errors:', JSON.stringify(errors.slice(0, 20), null, 2))
  if (!APPLY) console.log('\nDRY RUN — nothing written. Re-run with PAPERCUT_PROVISION_APPLY=1 to apply, then run sync-pins.mjs.')
  else console.log('\nApplied. Now run: node --env-file=.env sync-pins.mjs  (pulls card numbers into Hexa for display)')
}

main().catch((err) => { console.error('PaperCut provisioning failed:', err.message); process.exit(1) })
