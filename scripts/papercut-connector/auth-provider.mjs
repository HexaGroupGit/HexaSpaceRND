// PaperCut MF custom authentication program — Hexa portal credentials.
//
// Replaces OfficeRnD's papercutauth.exe at cutover: when a member signs in to
// print (Mobility Print first-run, the :9191 user web portal, popup auth), the
// username + password they type are validated against their HEXA PORTAL login
// (portal.hexaspace.com.au / Supabase) — the same email + password they set up
// when they accepted their portal invite. On success we return the member's
// PaperCut username, so the job lands on the SAME PaperCut account that
// provision-members.mjs created/linked (card number, balance, company group).
//
// PaperCut protocol (docs: "Synchronize and authenticate user and group details
// with custom programs"; examples: github.com/PaperCutSoftware/CustomSynAndAuthentication):
//   stdin :  username\n password\n            (two lines, UTF-8)
//   stdout:  "OK\n<username>\n"  on success   (username normalises email → PC account)
//            "ERROR\n"           on failure
//   exit  :  always 0 — auth outcome is the stdout text, not the exit code.
//
// USERNAME FORMS ACCEPTED:
//   - portal email (new provisioned users: PaperCut username == email)
//   - legacy PaperCut username (OfficeRnD-era, non-email) → its email property
//     is looked up over localhost XML-RPC, then validated against the portal.
//
// CONFIG: HEXA_AUTH_CONFIG env var → JSON file path (set it via PaperCut's
// auth.source.env-vars, e.g. HEXA_AUTH_CONFIG=C:\Program Files\PaperCut MF\providers\hexa\hexa-config.json):
//   {
//     "supabaseUrl":      "https://<ref>.supabase.co",
//     "supabaseAnonKey":  "<anon public key — NOT the service role key>",
//     "papercutServer":   "http://localhost:9191",
//     "papercutAuthToken":"<Web Services API auth token>"
//   }
//
// SECURITY: fails closed (any error → ERROR). Never logs, echoes or stores the
// password. Banned portal logins (removed teammates) fail here automatically,
// so revoking portal access also revokes password-based printing.
// Requires Node 18+ (built-in fetch). No npm dependencies.

import { readFileSync, writeSync, appendFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

// Audit trail — ALWAYS ON, unlike HEXA_AUTH_DEBUG below.
//
// PaperCut only logs an auth failure when the handler exits non-zero; a clean
// ERROR verdict is logged NOWHERE, so "member says it won't let them in" is
// otherwise undiagnosable, and you cannot even tell whether PaperCut invoked
// this program at all. One line per invocation fixes that. It also answers the
// question that matters operationally: who is signing in to print, and when.
//
// Records: time, outcome, username as typed, and the stage reached. NEVER the
// password, the token, or the Supabase response. Any failure to write is
// swallowed — logging must never be the reason someone cannot print.
let stage = 'start'
let sawUsername = '-'
const auditLog = (outcome) => {
  try {
    const path = process.env.HEXA_AUTH_LOG || 'C:\\ProgramData\\Hexa\\papercut-auth.log'
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${new Date().toISOString()}\t${outcome}\t${sawUsername}\t${stage}\n`)
  } catch { /* never break auth over a log line */ }
}

// Answer PaperCut and exit cleanly.
//
// Two things this has to get right. First, the verdict must actually reach
// PaperCut: process.stdout.write() is asynchronous on a pipe, so an immediate
// process.exit() can drop it — writeSync flushes before we go. Second, PaperCut
// keeps the stdin pipe open, and exiting while that handle is mid-close trips a
// libuv assertion on Windows (noisy stderr, exit 127); tearing stdin down first
// avoids it. Control flow is unchanged — process.exit() never returns, so the
// trailing fail() after a successful ok() still can't run.
const DONE = Symbol('answered')
let answered = false

// Opt-in diagnostics. Production returns one opaque "Invalid username or
// password" for EVERY failure on purpose — an unreadable config, an unknown
// user and a wrong password must be indistinguishable, or the provider becomes
// an account-enumeration oracle. That also makes a broken cutover impossible to
// debug, so: set HEXA_AUTH_DEBUG=1 to get the failing STAGE on stderr.
// Never prints the password, the token, or the Supabase response body.
// PaperCut's auth.source.env-vars does not set this, so it stays off in
// production unless someone deliberately turns it on for a single manual run.
const DEBUG = process.env.HEXA_AUTH_DEBUG === '1'
const dbg = (msg) => { if (DEBUG) { try { writeSync(2, `[debug] ${msg}\n`) } catch { /* stderr gone */ } } }

const finish = (out, err) => {
  if (!answered) {
    answered = true
    auditLog(out.startsWith('OK') ? 'OK' : 'ERROR')
    // writeSync, not process.stdout.write: the latter is async on a pipe, so the
    // verdict could be lost if the process goes away first.
    if (err) { try { writeSync(2, err) } catch { /* stderr gone */ } }
    try { writeSync(1, out) } catch { /* stdout gone — nothing we can do */ }
    // Exit NATURALLY. On Node 24 / Windows, process.exit() after any HTTPS
    // request trips a libuv teardown assertion — stderr noise and exit 127.
    // PaperCut ignores the exit code, but a clean exit is one less thing to
    // misread in an auth log. Verified: same fetch, natural exit, code 0.
    // Releasing stdin lets the loop drain; the unref'd timer is a backstop that
    // only fires if something else is holding it open, so it never adds latency.
    try { process.stdin.pause(); process.stdin.removeAllListeners(); process.stdin.unref?.() } catch { /* nothing to close */ }
    process.exitCode = 0
    setTimeout(() => process.exit(0), 2000).unref()
  }
  // Stop the caller dead. Without process.exit() the old code would run on past
  // its own decision — e.g. validating a password after already failing.
  throw DONE
}

const fail = () => finish('ERROR\n', 'Invalid username or password\n')
const ok = (username) => finish(`OK\n${username}\n`)

// Read exactly two newline-terminated lines from stdin (PaperCut may keep the
// pipe open, so don't wait for EOF). Hard 10s ceiling.
function readCredentials() {
  return new Promise((resolve) => {
    let buf = ''
    const timer = setTimeout(() => resolve(null), 10_000)
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      buf += chunk
      const lines = buf.split(/\r?\n/)
      if (lines.length >= 3 || (lines.length >= 2 && buf.endsWith('\n'))) {
        clearTimeout(timer)
        resolve([lines[0] ?? '', lines[1] ?? ''])
      }
    })
    process.stdin.on('end', () => { clearTimeout(timer); const l = buf.split(/\r?\n/); resolve([l[0] ?? '', l[1] ?? '']) })
  })
}

const escXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))

// Minimal XML-RPC call to the local PaperCut Web Services API (no deps).
async function pc(cfg, method, params) {
  const body = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${
    [cfg.papercutAuthToken, ...params].map((p) => `<param><value><string>${escXml(p)}</string></value></param>`).join('')
  }</params></methodCall>`
  const r = await fetch(`${cfg.papercutServer.replace(/\/$/, '')}/rpc/api/xmlrpc`, {
    method: 'POST', headers: { 'Content-Type': 'text/xml' }, body, signal: AbortSignal.timeout(5000),
  })
  const text = await r.text()
  if (!r.ok || text.includes('<fault>')) throw new Error(`${method} fault`)
  const m = text.match(/<value>\s*(?:<(?:string|boolean|int|i4)>)?([^<]*)/)
  // Decode XML entities — a value read back escaped and then re-sent escaped
  // again asks PaperCut about something that does not exist. &amp; must come
  // last so "&amp;lt;" does not collapse to "<".
  return m ? m[1].trim()
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&') : ''
}

async function main() {
  const creds = await readCredentials()
  if (!creds) fail()
  const username = String(creds[0]).trim()
  const password = String(creds[1])
  if (!username || !password) fail()

  sawUsername = username
  stage = 'read-config'
  dbg(`username as received: "${username}" (password ${password.length} chars, not shown)`)

  let cfg
  try {
    cfg = JSON.parse(readFileSync(process.env.HEXA_AUTH_CONFIG, 'utf8'))
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('incomplete')
  } catch (e) {
    dbg(`CONFIG read failed for HEXA_AUTH_CONFIG="${process.env.HEXA_AUTH_CONFIG ?? '(unset)'}": ${e.message}`)
    dbg('  (EACCES/EPERM here means the caller cannot read the ACL-locked config — run elevated, or point at the source copy.)')
    fail()
  }
  cfg.papercutServer = cfg.papercutServer || 'http://localhost:9191'

  // Resolve what they typed → { portal email to validate, PaperCut username to credit }.
  let email = username.toLowerCase()
  let pcUsername = username
  try {
    stage = 'resolve-username'
    dbg(`resolving "${username}" -> PaperCut account`)
    if (username.includes('@')) {
      // Email given. New provisioned users have username == email; legacy
      // OfficeRnD-era accounts have a non-email username — resolve it so the
      // job lands on the account that owns their card number + balance.
      const exists = cfg.papercutAuthToken ? await pc(cfg, 'api.isUserExists', [username]).catch(() => '') : 'skip'
      dbg(`  api.isUserExists("${username}") -> "${exists}"`)
      if (exists !== 'true' && exists !== '1' && exists !== 'skip') {
        const found = await pc(cfg, 'api.lookUpUserNameByEmail', [email]).catch((e) => { dbg(`  lookUpUserNameByEmail faulted: ${e.message}`); return '' })
        dbg(`  api.lookUpUserNameByEmail("${email}") -> "${found}"`)
        if (found) pcUsername = found
        // Unknown to PaperCut entirely → still validate the portal login and
        // return the email; PaperCut treats unknown users per its own policy.
      }
    } else if (cfg.papercutAuthToken) {
      // Legacy username given — find the email behind it for portal validation.
      const em = await pc(cfg, 'api.getUserProperty', [username, 'email']).catch(() => '')
      if (!em || !em.includes('@')) fail()
      email = em.toLowerCase()
    } else {
      fail() // non-email username and no way to resolve it
    }
  } catch (e) {
    // Username resolution is best-effort — a lookup failure falls through to the
    // password check below, which is the real gate. But a fail() in here is a
    // verdict, not a hiccup: let it unwind instead of validating a password we've
    // already refused.
    if (e === DONE) throw e
  }

  // NEVER hand PaperCut a username containing "@". It treats @ as a domain
  // separator and truncates, so returning "scarlett@hexaspace.com.au" makes it
  // look up "scarlett" and refuse with "your account is not registered with this
  // system" — password correct, account present, still refused. Prefer the
  // user_domain.com form when it exists (the convention OfficeRnD used, and the
  // reason logins with legacy usernames work).
  if (pcUsername.includes('@') && cfg.papercutAuthToken) {
    const underscored = pcUsername.replace('@', '_')
    const has = await pc(cfg, 'api.isUserExists', [underscored]).catch(() => '')
    if (has === 'true' || has === '1') {
      dbg(`  "${pcUsername}" contains @ which PaperCut truncates; using "${underscored}"`)
      pcUsername = underscored
    } else {
      dbg(`  WARNING: returning "${pcUsername}" which contains @ — PaperCut will truncate it and refuse. Rename that account to "${underscored}".`)
    }
  }

  // The actual gate: the member's portal (Supabase) email + password.
  stage = 'verify-portal-password'
  try {
    const r = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    })
    // Drain the body even though we only care about the status. An unconsumed
    // response leaves the socket open, and exiting on top of that trips a libuv
    // teardown assertion on Windows (stderr noise + exit 127). The token in this
    // body is deliberately never parsed, logged or stored.
    const body = await r.text().catch(() => '')
    if (r.ok) { dbg(`Supabase accepted the password; returning PaperCut username "${pcUsername}"`); ok(pcUsername) }
    // Only the error CODE, never the body's tokens. 400 invalid_grant = the
    // password is genuinely wrong for that email; 400 validation_failed = the
    // email was malformed by the time it got here; 429 = rate limited.
    let code = ''
    try { const j = JSON.parse(body); code = j.error_code || j.error || j.msg || '' } catch { /* not JSON */ }
    dbg(`Supabase REFUSED: HTTP ${r.status}${code ? ` (${code})` : ''} for email "${email}"`)
  } catch { /* network error → fail closed */ }
  fail()
}

// DONE just unwinds the stack after an answer is written. Anything else is an
// unexpected error — fail closed, but only if we haven't already answered.
main().catch(() => { if (!answered) { try { fail() } catch { /* answered now */ } } })
