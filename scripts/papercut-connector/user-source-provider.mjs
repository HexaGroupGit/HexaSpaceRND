// PaperCut MF custom USER SOURCE (user directory) — backed by the Hexa roster.
//
// The counterpart to auth-provider.mjs, and the piece the cutover runbook missed.
// PaperCut has TWO custom-program hooks and they do different jobs:
//
//   auth.source.custom-program   validates a password        -> auth-provider.mjs
//   user-source.custom-program   answers "who exists?"       -> THIS FILE
//
// Until this one points at Hexa, PaperCut's idea of who exists comes from
// OfficeRnD's papercutauth.exe. A member created by provision-members.mjs is an
// INTERNAL user (api.addNewInternalUser is the only creation API), the directory
// has never heard of them, and PaperCut refuses the login even when
// auth-provider.mjs returns OK. Observed 4 Aug 2026 with scarlett@hexaspace.com.au:
// five OK verdicts in the audit log, five refusals on screen.
//
// With this installed, PaperCut syncs members straight from Hexa and creates them
// as DIRECTORY users (internal=false) — which auth-provider.mjs already
// authenticates correctly. It replaces provision-members.mjs as the *creation*
// path; that script stays useful only for allocating card numbers/PINs.
//
// PROTOCOL (PaperCut "Custom user directory information provider"): the program
// is run once per query with the command in argv, and answers on stdout.
// Tab-delimited, one record per line, exit 0.
//   is-valid-user <user>            -> Y | N
//   get-user-details <user>         -> user \t fullname \t email \t dept \t office \t cardno
//   all-users                       -> one get-user-details line per user
//   all-groups                      -> one group name per line
//   get-group-members <group>       -> one username per line
//   get-user-groups <user>          -> one group name per line
//   is-user-in-group <user> <group> -> Y | N
//
// EVERY invocation is logged with its exact argv (HEXA_USERSOURCE_LOG, default
// C:\ProgramData\Hexa\papercut-usersource.log). That log is the point: it shows
// what PaperCut really asks and in what order, so the response format is
// corrected from evidence rather than assumption. Read it after the first sync.
//
// SAFETY — NON-DESTRUCTIVE BY DEFAULT. `all-users` returns the UNION of the Hexa
// roster and everyone PaperCut already has. A user missing from a sync response
// is how PaperCut decides someone has left — the same mechanism as the OfficeRnD
// prune we disabled. The union makes the first sync incapable of removing the 304
// existing accounts. Once the roster is trusted, set HEXA_USERSOURCE_STRICT=1 to
// return the roster alone so genuine leavers do drop off.
//
// CONFIG: HEXA_AUTH_CONFIG -> the same hexa-config.json as the auth provider,
// plus two fields this one needs:
//   "hexaRosterUrl": "https://portal.hexaspace.com.au/api/papercut/members",
//   "hexaSyncToken": "<PAPERCUT_SYNC_TOKEN>"

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync } from 'fs'
import { dirname } from 'path'

const LOG_PATH = process.env.HEXA_USERSOURCE_LOG || 'C:\\ProgramData\\Hexa\\papercut-usersource.log'
const CACHE_PATH = process.env.HEXA_USERSOURCE_CACHE || 'C:\\ProgramData\\Hexa\\usersource-cache.json'
// Long enough that one PaperCut sync run (all-users, then a get-user-details per
// user) is served from a single build — assembling it costs ~600 XML-RPC calls.
const CACHE_TTL_MS = 300_000
const STRICT = process.env.HEXA_USERSOURCE_STRICT === '1'

const log = (msg) => {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true })
    appendFileSync(LOG_PATH, `${new Date().toISOString()}\t${msg}\n`)
  } catch { /* logging must never break a sync */ }
}

// stdout must be flushed before exit, and process.exit() after an HTTPS request
// trips a libuv assertion on Node 24/Windows (see auth-provider.mjs). Same rules.
const out = (text) => { try { writeFileSync(1, text) } catch { /* pipe gone */ } }

function loadConfig() {
  const cfg = JSON.parse(readFileSync(process.env.HEXA_AUTH_CONFIG, 'utf8'))
  if (!cfg.hexaRosterUrl || !cfg.hexaSyncToken) {
    throw new Error('hexa-config.json is missing hexaRosterUrl / hexaSyncToken')
  }
  return cfg
}

// PaperCut fires many queries per sync (a get-user-details per user is common),
// so hitting the portal every time would make a 467-member sync crawl. Cache the
// assembled directory briefly on disk; a sync run reuses one fetch.
function readCache() {
  try {
    if (Date.now() - statSync(CACHE_PATH).mtimeMs > CACHE_TTL_MS) return null
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
  } catch { return null }
}

function writeCache(data) {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify(data))
  } catch { /* cache is an optimisation, not a requirement */ }
}

// Minimal XML-RPC (no deps), same approach as auth-provider.mjs.
const escXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))

// Values come back XML-ESCAPED and must be decoded before reuse. Without this,
// "J & H Legal Pty Ltd" is read as "J &amp; H Legal Pty Ltd", re-escaped to
// "&amp;amp;" on the next call, and PaperCut is asked about a group that does
// not exist. 5 of 84 groups faulted this way on 5 Aug 2026 — and the same bug
// would have written mangled full names into every synced record.
// &amp; MUST be decoded LAST, or "&amp;lt;" would wrongly become "<".
const unescXml = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&amp;/g, '&')

// TYPES MATTER. api.listUserAccounts(offset, limit) takes INTEGERS, and if you
// send them as <string> PaperCut does not fault — it returns an EMPTY LIST. Read
// as "PaperCut has no users", that would make a sync look like every account had
// departed. Numbers therefore go out as <int>. (Cost us the first dry run.)
const xmlParam = (p) => (typeof p === 'number'
  ? `<param><value><int>${p}</int></value></param>`
  : `<param><value><string>${escXml(p)}</string></value></param>`)

async function pc(cfg, method, params) {
  const body = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${
    [cfg.papercutAuthToken, ...params].map(xmlParam).join('')
  }</params></methodCall>`
  const r = await fetch(`${(cfg.papercutServer || 'http://localhost:9191').replace(/\/$/, '')}/rpc/api/xmlrpc`, {
    method: 'POST', headers: { 'Content-Type': 'text/xml' }, body, signal: AbortSignal.timeout(10_000),
  })
  const text = await r.text()
  if (!r.ok || text.includes('<fault>')) throw new Error(`${method} fault`)
  return [...text.matchAll(/<value>\s*(?:<(?:string|boolean|int|i4)>)?([^<]*)/g)]
    .map((m) => unescXml(m[1].trim())).filter((s) => s !== '')
}

// Build the directory: Hexa roster, plus (unless strict) everyone PaperCut
// already knows, so a sync can never conclude an existing user has vanished.
async function buildDirectory() {
  const cached = readCache()
  if (cached) return cached

  const cfg = loadConfig()
  const res = await fetch(cfg.hexaRosterUrl, { headers: { Authorization: `Bearer ${cfg.hexaSyncToken}` } })
  if (!res.ok) throw new Error(`roster fetch failed: HTTP ${res.status}`)
  const roster = await res.json()

  const users = new Map()   // username -> record
  const groups = new Map()  // group -> Set(username)

  const add = (username, fullName, email, group, card) => {
    if (!username) return
    const key = username.toLowerCase()
    const prev = users.get(key)
    users.set(key, {
      username, fullName: fullName || prev?.fullName || username,
      email: email || prev?.email || '', dept: group || prev?.dept || '',
      card: card || prev?.card || '',
    })
    if (group) {
      if (!groups.has(group)) groups.set(group, new Set())
      groups.get(group).add(username)
    }
  }

  // 1. Index what PaperCut already has, BY EMAIL. This has to come first: a
  // member the roster calls "eric@hexaspace.com.au" may already exist as
  // "eric_hexaspace.com.au" (the OfficeRnD form — 286 of the 304 look like
  // this). Emitting both would give one person two accounts, two balances and
  // two PINs. Their existing username stays canonical; auth-provider.mjs
  // already resolves email -> legacy username, so they still type their email.
  const existingByEmail = new Map()   // email -> username
  const existingDetails = new Map()   // username -> { fullName, email }
  let keptCount = 0
  if (!STRICT) {
    try {
      const existing = []
      for (let off = 0; ; off += 1000) {
        const batch = (await pc(cfg, 'api.listUserAccounts', [off, 1000]))
          .filter((s) => s && !s.includes('<'))
        existing.push(...batch)
        if (batch.length < 1000) break
      }
      // Defence in depth: this server has hundreds of accounts, so an empty or
      // implausibly small enumeration means the query failed, not that everyone
      // left. Refuse rather than hand PaperCut a directory that omits them.
      if (existing.length < 10) {
        throw new Error(`enumeration returned only ${existing.length} users — refusing to build a directory that would look like a mass departure`)
      }
      for (const u of existing) {
        const [fullName] = await pc(cfg, 'api.getUserProperty', [u, 'full-name']).catch(() => [''])
        const [email] = await pc(cfg, 'api.getUserProperty', [u, 'email']).catch(() => [''])
        // Their CURRENT card number, echoed back verbatim in every record. The
        // record format carries a card field, and 286 of these users have a PIN
        // in it — the number they type at the copier and see in the Hexa app.
        // Emitting a blank invites the sync to wipe it. Never send empty for a
        // user who has one.
        const [card] = await pc(cfg, 'api.getUserProperty', [u, 'primary-card-number']).catch(() => [''])
        existingDetails.set(u, { fullName: fullName || u, email: email || '', card: card || '' })
        if (email) existingByEmail.set(String(email).toLowerCase(), u)
      }
    } catch (e) {
      // If PaperCut can't be reached we must NOT fall back to a roster-only
      // list — that would look like a mass departure. Fail the query instead.
      throw new Error(`could not enumerate existing PaperCut users (refusing to answer with a partial directory): ${e.message}`)
    }
  }

  // 2. The Hexa roster — the source of truth for who is a member and their
  // details. Reuse their existing PaperCut username where they have one;
  // otherwise the username IS their email, matching what provision-members.mjs
  // does for new users.
  let matchedExisting = 0, brandNew = 0
  for (const m of roster.members ?? []) {
    const already = existingByEmail.get(m.email)
    if (already) matchedExisting += 1; else brandNew += 1
    // Card: keep whatever PaperCut already holds for an existing account; fall
    // back to the PIN Hexa has on record (available once the portal serves
    // per-member `pin`) for someone being created for the first time.
    const card = (already && existingDetails.get(already)?.card) || m.pin || ''
    add(already || pcUsernameFor(m.email), m.fullName, m.email, m.companyName || '', card)
  }
  const rosterCount = users.size

  // 3. Everyone else PaperCut holds who is NOT on the roster — ex-members,
  // service accounts, OfficeRnD leftovers. Carried through untouched so this
  // sync cannot be what removes them. Tighten with HEXA_USERSOURCE_STRICT=1
  // once the roster is trusted to be complete.
  if (!STRICT) {
    for (const [u, d] of existingDetails) {
      if (users.has(u.toLowerCase())) continue
      add(u, d.fullName, d.email, '', d.card)
      keptCount += 1
    }
  }

  // 4. Groups PaperCut already has that the roster does not describe —
  // "[Individual Members]", "[Users not linked to OfficeRnD]", old company
  // names. A sync asks group-members for EVERY group it knows, and an empty
  // answer empties the group. Group membership drives the restricted/quota
  // rules, so carry these through exactly as they are.
  let keptGroups = 0
  if (!STRICT) {
    try {
      const names = []
      for (let off = 0; ; off += 1000) {
        const batch = (await pc(cfg, 'api.listUserGroups', [off, 1000])).filter((s) => s && !s.includes('<'))
        names.push(...batch)
        if (batch.length < 1000) break
      }
      for (const name of names) {
        const members = []
        for (let off = 0; ; off += 1000) {
          const batch = (await pc(cfg, 'api.getGroupMembers', [name, off, 1000])).filter((s) => s && !s.includes('<'))
          members.push(...batch)
          if (batch.length < 1000) break
        }
        if (groups.has(name)) {
          // A company the roster also describes: UNION rather than replace. The
          // roster lists current members; PaperCut may hold ex-members whose
          // group membership still drives their restricted/quota status.
          // Returning roster-only would quietly evict them.
          for (const m of members) groups.get(name).add(m)
        } else {
          groups.set(name, new Set(members))
          keptGroups += 1
        }
      }
    } catch (e) {
      // Same rule as the user enumeration: never answer with a partial picture.
      throw new Error(`could not enumerate existing PaperCut groups (refusing to answer and risk emptying them): ${e.message}`)
    }
  }
  log(`groups: ${groups.size} total (${keptGroups} carried over from PaperCut)`)
  log(`roster members matched to an existing account: ${matchedExisting}, brand new: ${brandNew}`)

  // EMAIL ALIASES. A member whose account predates Hexa is canonically
  // "eric_hexaspace.com.au", but they type "eric@hexaspace.com.au" to log in --
  // and that works today. If a lookup for the email answered "no such user",
  // switching the source could break sign-in for the 222 members in that
  // position. So lookups accept either form, while all-users still emits ONE
  // canonical record per person (aliases are never their own record, or we would
  // be back to duplicate accounts).
  const aliases = {}
  for (const u of users.values()) {
    const em = String(u.email || '').toLowerCase()
    if (em && em !== u.username.toLowerCase()) aliases[em] = u.username
  }

  const data = {
    users: [...users.values()],
    aliases,
    groups: [...groups.entries()].map(([name, members]) => ({ name, members: [...members] })),
    stats: { rosterCount, keptCount, total: users.size, aliases: Object.keys(aliases).length, strict: STRICT },
  }
  log(`directory built: roster=${rosterCount} kept-from-papercut=${keptCount} total=${users.size} strict=${STRICT}`)
  writeCache(data)
  return data
}

// A PaperCut username MUST NOT CONTAIN "@". PaperCut treats an @ as a domain
// separator and truncates: hand it "scarlett@hexaspace.com.au" and it looks up
// "scarlett", finds nothing, and reports "your account is not registered with
// this system" — even though the account exists and the password was accepted.
// (Diagnosed 5 Aug 2026; it is also why OfficeRnD named every account
// user_domain.com. That convention was load-bearing, not cosmetic.)
// The member still SIGNS IN with their email — auth-provider.mjs and the alias
// map both resolve it to this username.
const pcUsernameFor = (email) => String(email).replace('@', '_')

const rec = (u) => [u.username, u.fullName, u.email, u.dept, '', u.card].join('\t')

// The command names PaperCut MF 22 actually uses, learned from the invocation
// log on 5 Aug 2026 rather than from the docs. Two surprises:
//   1. Every call is prefixed with an option argument: ["-", "all-users"].
//      The "-" is the field delimiter ("-" = default tab, which confirms the
//      tab-delimited record format below).
//   2. Commands have NO "get-" prefix: "group-members", not "get-group-members".
// Both spellings are accepted so a different MF build cannot silently break it —
// silence here means "this user does not exist", which is how accounts get
// removed.
const COMMANDS = new Set([
  'all-users', 'all-groups', 'group-members', 'user-details', 'is-valid-user',
  'user-groups', 'is-user-in-group',
  'get-group-members', 'get-user-details', 'get-user-groups',
])

async function main() {
  const argv = process.argv.slice(2)
  log(`INVOKED argv=${JSON.stringify(argv)}`)

  // Skip any leading option tokens (the delimiter arg) to find the command.
  let i = 0
  while (i < argv.length && !COMMANDS.has(argv[i])) i += 1
  const cmd = argv[i]
  const args = argv.slice(i + 1)

  const dir = await buildDirectory()
  // Resolve by canonical username first, then by email alias — so a member can
  // be looked up as either, and always resolves to the ONE account that owns
  // their card number, balance and history.
  const find = (name) => {
    const key = String(name || '').toLowerCase()
    return dir.users.find((u) => u.username.toLowerCase() === key)
        ?? dir.users.find((u) => u.username === (dir.aliases ?? {})[key])
  }

  switch (cmd) {
    case 'is-valid-user':
      out(find(args[0]) ? 'Y\n' : 'N\n'); break

    case 'user-details':
    case 'get-user-details': {
      const u = find(args[0])
      if (u) out(rec(u) + '\n')
      break
    }

    case 'all-users':
      out(dir.users.map(rec).join('\n') + '\n'); break

    case 'all-groups':
      out(dir.groups.map((g) => g.name).join('\n') + '\n'); break

    case 'group-members':
    case 'get-group-members': {
      const g = dir.groups.find((x) => x.name === args[0])
      out((g ? g.members.join('\n') : '') + '\n'); break
    }

    case 'user-groups':
    case 'get-user-groups': {
      const u = find(args[0])
      const mine = u ? dir.groups.filter((g) => g.members.some((m) => m.toLowerCase() === u.username.toLowerCase())) : []
      out(mine.map((g) => g.name).join('\n') + '\n'); break
    }

    case 'is-user-in-group': {
      const g = dir.groups.find((x) => x.name === args[1])
      out(g && g.members.some((m) => m.toLowerCase() === String(args[0]).toLowerCase()) ? 'Y\n' : 'N\n'); break
    }

    default:
      // An unrecognised command is the interesting case — it means the real
      // protocol differs from what is implemented above. Log it loudly; the
      // fix is to read this log, not to guess again.
      log(`UNKNOWN COMMAND "${cmd}" - implement it. Full argv logged above.`)
      break
  }
  process.exitCode = 0
}

main().catch((err) => {
  // Fail LOUDLY in the log but QUIETLY on stdout: an error must never be
  // mistaken for "this user does not exist", which is what triggers deletions.
  log(`ERROR during "${process.argv.slice(2).join(' ')}": ${err.message}`)
  process.exitCode = 1
})
