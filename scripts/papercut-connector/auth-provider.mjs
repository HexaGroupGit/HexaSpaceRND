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

import { readFileSync } from 'fs'

const fail = () => { process.stdout.write('ERROR\n'); process.stderr.write('Invalid username or password\n'); process.exit(0) }
const ok = (username) => { process.stdout.write(`OK\n${username}\n`); process.exit(0) }

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
  return m ? m[1].trim() : ''
}

async function main() {
  const creds = await readCredentials()
  if (!creds) fail()
  const username = String(creds[0]).trim()
  const password = String(creds[1])
  if (!username || !password) fail()

  let cfg
  try {
    cfg = JSON.parse(readFileSync(process.env.HEXA_AUTH_CONFIG, 'utf8'))
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('incomplete')
  } catch { fail() }
  cfg.papercutServer = cfg.papercutServer || 'http://localhost:9191'

  // Resolve what they typed → { portal email to validate, PaperCut username to credit }.
  let email = username.toLowerCase()
  let pcUsername = username
  try {
    if (username.includes('@')) {
      // Email given. New provisioned users have username == email; legacy
      // OfficeRnD-era accounts have a non-email username — resolve it so the
      // job lands on the account that owns their card number + balance.
      const exists = cfg.papercutAuthToken ? await pc(cfg, 'api.isUserExists', [username]).catch(() => '') : 'skip'
      if (exists !== 'true' && exists !== '1' && exists !== 'skip') {
        const found = await pc(cfg, 'api.lookUpUserNameByEmail', [email]).catch(() => '')
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
  } catch { /* resolution is best-effort; validation below still gates access */ }

  // The actual gate: the member's portal (Supabase) email + password.
  try {
    const r = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) ok(pcUsername)
  } catch { /* network error → fail closed */ }
  fail()
}

main().catch(() => fail())
