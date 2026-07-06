// One-off cleanup: delete PaperCut internal users that were mistakenly created for
// Hexa DEMO/seed members during the first provisioning apply (before the roster
// excluded demo_co* rows). We created those as internal users with username = email,
// so we delete by username = email — this cannot hit the OfficeRnD/AD-synced users
// (their usernames are NOT emails).
//
// Pass the demo emails as arguments. DRY-RUN by default; deletes only with
// PAPERCUT_CLEANUP_APPLY=1. Deletion is permanent (api.deleteExistingUser).
//
//   node --env-file=.env cleanup-demo.mjs demo@hexaspace.com.au jamie.demo@hexaspace.com.au ...
//   PAPERCUT_CLEANUP_APPLY=1 node --env-file=.env cleanup-demo.mjs <emails...>

import xmlrpc from 'xmlrpc'

const SERVER = process.env.PAPERCUT_SERVER || 'http://localhost:9191'
const AUTH = process.env.PAPERCUT_AUTH_TOKEN || ''
const APPLY = process.env.PAPERCUT_CLEANUP_APPLY === '1'

const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean)

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, [AUTH, ...params], (err, value) => (err ? reject(err) : resolve(value)))
  })
}

async function main() {
  if (!AUTH) throw new Error('PAPERCUT_AUTH_TOKEN not set.')
  if (!emails.length) throw new Error('Pass the demo emails as arguments.')
  const url = new URL(SERVER)
  const isHttps = url.protocol === 'https:'
  const client = (isHttps ? xmlrpc.createSecureClient : xmlrpc.createClient)({ host: url.hostname, port: Number(url.port) || (isHttps ? 9192 : 9191), path: '/rpc/api/xmlrpc' })

  console.log(`${APPLY ? 'DELETING' : 'DRY RUN — would delete'} ${emails.length} demo internal users (by username = email).`)
  for (const email of emails) {
    // Only act if an internal user with username === email exists.
    const exists = await call(client, 'api.isUserExists', [email]).catch(() => false)
    const internal = exists ? await call(client, 'api.getUserProperty', [email, 'internal']).catch(() => '') : ''
    if (!exists) { console.log(`  skip ${email} — no user with that username`); continue }
    if (String(internal).toLowerCase() !== 'true') { console.log(`  SKIP ${email} — exists but is NOT an internal user (safety); leaving it`); continue }
    if (APPLY) {
      await call(client, 'api.deleteExistingUser', [email]).then(() => console.log(`  deleted ${email}`)).catch((e) => console.log(`  FAILED ${email}: ${e.message}`))
    } else {
      console.log(`  would delete ${email} (internal user)`)
    }
  }
  if (!APPLY) console.log('\nDRY RUN — nothing deleted. Re-run with PAPERCUT_CLEANUP_APPLY=1 to delete.')
}

main().catch((err) => { console.error('cleanup failed:', err.message); process.exit(1) })
