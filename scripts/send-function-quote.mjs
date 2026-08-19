// Re-send the function-space quote to a client via the DEPLOYED notify endpoint
// (mode: 'agreement'), so it uses the same template + branding as the admin UI.
// The endpoint reads the STORED quote (`b.quote`) — it never recomputes — so a
// multi-session series is emailed at its real price.
//
//   node scripts/send-function-quote.mjs FN-433595            # dry run
//   node scripts/send-function-quote.mjs FN-433595 --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const REF = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!REF) { console.error('usage: send-function-quote.mjs <FN-ref> [--apply]'); process.exit(1) }

const PORTAL = 'https://portal.hexaspace.com.au'
const SIGN_URL = `${PORTAL}/function-space`
const ADMIN_COPY = 'eric@hexaspace.com.au'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: rows } = await sb.from('function_bookings').select('id,data')
const row = rows.find(r => r.data.ref === REF)
if (!row) { console.error(`${REF} not found`); process.exit(1) }
const b = row.data
const q = b.quote || {}
const money = (v) => `$${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`

console.log(`${b.ref} — ${b.organisation || b.name}`)
console.log(`  to:        ${b.email}`)
console.log(`  sessions:  ${(b.sessions || []).length || 1}`)
for (const s of q.sessions ?? []) console.log(`               ${s.date} ${s.startTime}–${s.endTime}  ${s.isWeekend ? 'weekend' : 'weekday'} @ ${money(s.rate)}/hr  ${money(s.rental)}`)
console.log(`  total:     ${money(q.total)} inc GST`)
console.log(`  due now:   ${money(q.dueNow)}  (50% deposit + ${money(q.securityDeposit ?? 300)} security)`)
console.log(`  balance:   ${money(q.balanceDue)}  (14 days before the first session)`)
console.log(`  sign link: ${SIGN_URL}`)

if (!APPLY) { console.log('\nDRY RUN — nothing sent. Re-run with --apply.'); process.exit(0) }

async function send(booking, label) {
  const r = await fetch(`${PORTAL}/api/function-bookings/notify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking, signUrl: SIGN_URL, mode: 'agreement' }),
  })
  const j = await r.json().catch(() => ({}))
  console.log(`  ${label}: ${r.status} ${JSON.stringify(j)}`)
  return r.ok && j.sent
}

console.log('\nSending…')
const okClient = await send(b, `client (${b.email})`)
const okCopy = await send({ ...b, email: ADMIN_COPY }, `admin copy (${ADMIN_COPY})`)

if (okClient) {
  // Audit trail on the booking so it's visible in admin that the corrected quote went out.
  const data = { ...b, quoteResentAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  const { error } = await sb.from('function_bookings').upsert({ id: row.id, data, updated_at: new Date().toISOString() })
  console.log(error ? `  stamp failed: ${error.message}` : '  stamped quoteResentAt on the booking')
}
console.log(`\nclient: ${okClient ? 'SENT' : 'FAILED'} · admin copy: ${okCopy ? 'SENT' : 'FAILED'}`)
