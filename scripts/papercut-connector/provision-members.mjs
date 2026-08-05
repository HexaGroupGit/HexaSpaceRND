// PaperCut MF ← Hexa: provision members (the OfficeRnD model).
//
// Ensures each active Hexa member has a PaperCut user AND a printer login number
// (the Primary Card/Identity number, `primary-card-number` — what members type at
// the copier, and what the app/portal shows them as their PIN).
// See docs/papercut-integration.md.
//
// THE FULL SET-UP THIS PERFORMS, per member on the Hexa roster:
//   1. EMAIL   — matches the Hexa member to their PaperCut user by email (existing
//                OfficeRnD/AD users have non-email usernames, so we index by email
//                and update in place — never creating a duplicate account).
//   2. PASSWORD— reports who has a PORTAL password. After the Phase 5 auth switch
//                that password is what members type into Mobility Print, so anyone
//                without one is listed as NOT READY (they still get an account +
//                PIN, and card release at the copier still works — only the client
//                sign-in fails until they set a portal password).
//   3. PIN     — allocates the CORRECT number, in this order of preference:
//                  a. the number the PaperCut user already has        → keep
//                  b. else the number Hexa already showed them        → restore
//                     (user recreated / card cleared — their PIN doesn't change)
//                  c. else a fresh unique 4-digit number              → assign
//   4. PUSH    — sends every member's number straight back to Hexa
//                (POST /api/papercut/pins) so it shows in their portal/app and in
//                the admin portal the moment provisioning finishes, instead of
//                waiting for the next sync-pins run. Disable with
//                PAPERCUT_SKIP_PIN_PUSH=1.
//
// NO password is ever copied from Hexa into PaperCut — members authenticate
// against their live portal login via auth-provider.mjs.
//
// RUNS ON THE LAN (localhost). Env: PAPERCUT_AUTH_TOKEN, PAPERCUT_SERVER
// (default http://localhost:9191), HEXA_ROSTER_URL, HEXA_PINS_URL,
// PAPERCUT_SYNC_TOKEN.
// SAFETY: DRY-RUN by default; writes only with PAPERCUT_PROVISION_APPLY=1.
// SECURITY: never prints a PIN — counts and emails only.

import xmlrpc from 'xmlrpc'

const SERVER = process.env.PAPERCUT_SERVER || 'http://localhost:9191'
const AUTH = process.env.PAPERCUT_AUTH_TOKEN || ''
const ROSTER_URL = process.env.HEXA_ROSTER_URL || 'https://portal.hexaspace.com.au/api/papercut/members'
const PINS_URL = process.env.HEXA_PINS_URL || 'https://portal.hexaspace.com.au/api/papercut/pins'
const SYNC_TOKEN = process.env.PAPERCUT_SYNC_TOKEN || ''
const APPLY = process.env.PAPERCUT_PROVISION_APPLY === '1'
const SKIP_PIN_PUSH = process.env.PAPERCUT_SKIP_PIN_PUSH === '1'
// Pilot one or a few members before a bulk run: PAPERCUT_ONLY=a@x.com,b@y.com
// Everyone else is ignored entirely - not created, not touched, not pushed.
const ONLY = (process.env.PAPERCUT_ONLY || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

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

  // 1. Roster from Hexa (deduped + demo-filtered server-side). Each row carries
  // the member's email, their portal-password status, and the PIN Hexa already
  // holds for them.
  const rosterRes = await fetch(ROSTER_URL, { headers: { Authorization: `Bearer ${SYNC_TOKEN}` } })
  const roster = await rosterRes.json()
  if (!rosterRes.ok) throw new Error(`roster fetch failed (${rosterRes.status}): ${JSON.stringify(roster)}`)
  const all = roster.members ?? []
  const members = ONLY.length ? all.filter((m) => ONLY.includes(m.email)) : all
  if (ONLY.length) {
    console.log(`PAPERCUT_ONLY set: ${members.length}/${all.length} member(s) in scope - ${members.map((m) => m.email).join(', ') || '(no roster match!)'}`)
    const missing = ONLY.filter((e) => !all.some((m) => m.email === e))
    if (missing.length) console.log(`  NOT ON THE ROSTER (check spelling / portal access): ${missing.join(', ')}`)
  }
  console.log(`Roster: ${members.length} active Hexa members. ${APPLY ? 'APPLY mode' : 'DRY RUN (set PAPERCUT_PROVISION_APPLY=1 to write)'}.`)
  if (roster.passwordCheck === 'unavailable') {
    console.log('NOTE: portal-password status unavailable (run papercut-has-password-schema.sql in Supabase) — provisioning continues, readiness unknown.')
  }

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
  // Cards actually held in PaperCut right now — the set a restore must not tread
  // on. Snapshot it before folding in Hexa's numbers below.
  const cardsHeldInPaperCut = new Set(usedCards)
  // Numbers Hexa has on record count as in-use too: a member may hold a PIN that
  // this PaperCut server has since lost, and re-issuing it to someone else would
  // hand two people the same login number.
  const hexaPins = new Map(
    members.filter((m) => m.pin).map((m) => [m.email, String(m.pin)]),
  )
  for (const pin of roster.usedPins ?? []) usedCards.add(String(pin))
  // A number Hexa recorded for this member is safe to put back only if no OTHER
  // PaperCut user has since been given it.
  const restorable = (email) => {
    const pin = hexaPins.get(email)
    return pin && !cardsHeldInPaperCut.has(pin) ? pin : null
  }
  console.log(`Indexed ${allUsers.length} users; ${emailToCard.size} already have a card number; ${usedCards.size} numbers in use overall.`)

  // 4. Reconcile.
  const created = [], assignedCard = [], restoredCard = [], keptCard = [], errors = []
  const groupsSeen = new Set()
  const pinsForHexa = []   // { email, pin } — pushed back so the portal shows it

  for (const m of members) {
    try {
      const existingUser = emailToUser.get(m.email)

      if (m.companyName && !groupsSeen.has(m.companyName)) {
        groupsSeen.add(m.companyName)
        if (APPLY) await call(client, 'api.addNewGroup', [m.companyName]).catch(() => {})
      }

      let card
      if (existingUser) {
        // Update in place. Keep their username.
        if (APPLY) {
          await call(client, 'api.setUserProperty', [existingUser, 'full-name', m.fullName]).catch(() => {})
          if (m.companyName) await call(client, 'api.addUserToGroup', [existingUser, m.companyName]).catch(() => {})
        }
        const restore = restorable(m.email)
        if (emailToCard.has(m.email)) {
          card = emailToCard.get(m.email)
          keptCard.push(m.email)           // PaperCut already has their number → never overwrite
        } else if (restore) {
          card = restore                   // Hexa knows the number they've been shown → put it back
          if (APPLY) await call(client, 'api.setUserProperty', [existingUser, 'primary-card-number', card])
          restoredCard.push(m.email)
        } else {
          card = newCard(usedCards)        // nobody has one → issue a fresh unique number
          if (APPLY) await call(client, 'api.setUserProperty', [existingUser, 'primary-card-number', card])
          assignedCard.push(m.email)
        }
      } else {
        // Create a new internal user WITH their card (6th arg = cardId). Reuse the
        // number Hexa already showed them if there is one, so a member whose
        // PaperCut account was deleted keeps the same PIN.
        const restore = restorable(m.email)
        card = restore ?? newCard(usedCards)
        if (APPLY) {
          const pw = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
          await call(client, 'api.addNewInternalUser', [m.email, pw, m.fullName, m.email, card, ''])
          if (m.companyName) await call(client, 'api.addUserToGroup', [m.email, m.companyName]).catch(() => {})
        }
        created.push(m.email)
        // Count separately: a create that puts back the number the member has
        // already been shown in the app is the case that matters most here.
        if (restore) restoredCard.push(m.email)
      }

      // This number is now spoken for, in both senses — no later member can be
      // generated it, and none can restore it out from under this one.
      usedCards.add(String(card))
      cardsHeldInPaperCut.add(String(card))
      pinsForHexa.push({ email: m.email, pin: String(card) })
    } catch (err) {
      errors.push({ email: m.email, reason: err.message })
    }
  }

  // RESTORE overlaps CREATE on purpose (a created user can be restored a number),
  // so it's reported as a subset rather than a fourth disjoint bucket.
  console.log(`\n${APPLY ? '' : '(dry-run) '}CREATE user: ${created.length}, ASSIGN new card: ${assignedCard.length}, KEEP existing card: ${keptCard.length}, Errors: ${errors.length}`)
  console.log(`  of which RESTORE a card Hexa already showed the member: ${restoredCard.length}`)
  if (!members.some((m) => m.pin) && (roster.usedPins ?? []).length) {
    console.log('  NOTE: the roster returned no per-member `pin`, so nothing can be restored — the portal is running an older /api/papercut/members. Deploy it, then re-run.')
  }
  if (errors.length) console.log('Errors:', JSON.stringify(errors.slice(0, 20), null, 2))

  // 5. Sign-in readiness. A PIN alone gets a member through the copier; signing in
  // to Mobility Print needs their PORTAL password once the auth switch is done.
  const noPassword = members.filter((m) => m.hasPassword === false).map((m) => m.email)
  if (roster.passwordCheck === 'ok') {
    console.log(`\nMobility Print sign-in: ${members.length - noPassword.length}/${members.length} members have a portal password.`)
    if (noPassword.length) {
      console.log(`${noPassword.length} member(s) have NO portal password — they get a PaperCut account + PIN (card release works) but can't sign in to the print client until they set one. Send them a portal invite:`)
      for (const e of noPassword.slice(0, 50)) console.log(`  - ${e}`)
      if (noPassword.length > 50) console.log(`  … and ${noPassword.length - 50} more`)
    }
  }

  // 6. Push every number back to Hexa so it shows in the member's portal/app and
  // the admin portal immediately — no separate sync-pins run needed for the PIN.
  // (sync-pins still runs on a schedule for the printing BALANCE.)
  if (!APPLY) {
    console.log('\nDRY RUN — nothing written, nothing pushed. Re-run with PAPERCUT_PROVISION_APPLY=1 to apply.')
  } else if (SKIP_PIN_PUSH) {
    console.log('\nApplied. PIN push skipped (PAPERCUT_SKIP_PIN_PUSH=1) — run sync-pins.mjs to show numbers in the portal.')
  } else if (pinsForHexa.length) {
    const res = await fetch(PINS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SYNC_TOKEN}` },
      body: JSON.stringify({ pins: pinsForHexa }),
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error(`\nApplied, but the PIN push to Hexa failed (${res.status}): ${JSON.stringify(out)}`)
      console.error('Run sync-pins.mjs to retry — PaperCut is already correct.')
      process.exitCode = 1
    } else {
      console.log(`\nApplied. Pushed ${out.stored ?? 0} PIN(s) to Hexa${out.failed ? `, ${out.failed} failed` : ''} — members can see their number now.`)
      console.log('Run sync-pins.mjs on its schedule to keep printing balances fresh.')
    }
  }
}

main().catch((err) => { console.error('PaperCut provisioning failed:', err.message); process.exit(1) })
