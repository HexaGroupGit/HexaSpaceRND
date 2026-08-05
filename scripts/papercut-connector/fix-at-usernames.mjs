// Rename PaperCut accounts whose username contains "@" to the user_domain.com form.
//
// WHY: PaperCut treats "@" in a username as a domain separator and TRUNCATES it.
// An account called "scarlett@hexaspace.com.au" is looked up as "scarlett",
// which does not exist, so the login is refused with "your account is not
// registered with this system" - even though the account is there, the password
// was accepted, and the auth provider returned OK. Diagnosed 5 Aug 2026 from
// PaperCut's own log:
//   User "scarlett" attempted to log in, but they have no account...
//   User "scarlett" failed to authenticate as name is unknown.
// This is exactly why OfficeRnD named every account user_domain.com. That
// convention was load-bearing.
//
// Members are unaffected in how they sign in: they still type their EMAIL.
// auth-provider.mjs resolves email -> this username, and the user source keeps
// the email as an alias.
//
// api.renameUserAccount preserves the account itself - email, card number,
// balance, groups and print history all stay attached (verified on a fresh
// account before this script was written).
//
// SAFETY: DRY-RUN by default; writes only with PAPERCUT_RENAME_APPLY=1.
// Skips any rename whose target name is already taken and reports it rather
// than merging two accounts.

import xmlrpc from 'xmlrpc'

const SERVER = process.env.PAPERCUT_SERVER || 'http://localhost:9191'
const AUTH = process.env.PAPERCUT_AUTH_TOKEN || ''
const APPLY = process.env.PAPERCUT_RENAME_APPLY === '1'

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, [AUTH, ...params], (err, value) => (err ? reject(err) : resolve(value)))
  })
}

async function main() {
  if (!AUTH) throw new Error('PAPERCUT_AUTH_TOKEN not set.')
  const url = new URL(SERVER)
  const isHttps = url.protocol === 'https:'
  const client = (isHttps ? xmlrpc.createSecureClient : xmlrpc.createClient)({
    host: url.hostname, port: Number(url.port) || (isHttps ? 9192 : 9191), path: '/rpc/api/xmlrpc',
  })

  const users = []
  for (let off = 0; ; off += 1000) {
    const batch = await call(client, 'api.listUserAccounts', [off, 1000])
    users.push(...batch)
    if (batch.length < 1000) break
  }
  const existing = new Set(users.map((u) => u.toLowerCase()))
  const offenders = users.filter((u) => u.includes('@'))

  console.log(`${users.length} accounts; ${offenders.length} have "@" in the username and CANNOT log in.`)
  console.log(APPLY ? 'APPLY mode.' : 'DRY RUN (set PAPERCUT_RENAME_APPLY=1 to write).')

  const renamed = [], collisions = [], errors = []
  for (const old of offenders) {
    const next = old.replace('@', '_')
    if (existing.has(next.toLowerCase())) {
      // Two accounts for one person. Renaming would merge or fail - leave it for
      // a human, since picking which one keeps the balance is not automatable.
      collisions.push(`${old} -> ${next} (target already exists)`)
      continue
    }
    if (APPLY) {
      try {
        await call(client, 'api.renameUserAccount', [old, next])
        existing.add(next.toLowerCase())
        existing.delete(old.toLowerCase())
        renamed.push(`${old} -> ${next}`)
      } catch (err) {
        errors.push(`${old}: ${err.message}`)
      }
    } else {
      renamed.push(`${old} -> ${next}`)
    }
  }

  console.log(`\n${APPLY ? 'Renamed' : 'Would rename'}: ${renamed.length}`)
  renamed.slice(0, 10).forEach((r) => console.log('  ' + r))
  if (renamed.length > 10) console.log(`  ... and ${renamed.length - 10} more`)
  if (collisions.length) {
    console.log(`\nSKIPPED - target name already in use (resolve by hand): ${collisions.length}`)
    collisions.forEach((c) => console.log('  ' + c))
  }
  if (errors.length) {
    console.log(`\nErrors: ${errors.length}`)
    errors.slice(0, 10).forEach((e) => console.log('  ' + e))
  }
  if (!APPLY) console.log('\nDRY RUN - nothing changed. Re-run with PAPERCUT_RENAME_APPLY=1.')
}

main().catch((err) => { console.error('rename failed:', err.message); process.exit(1) })
