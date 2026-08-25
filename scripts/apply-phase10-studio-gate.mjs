// Applies migrations/phase10_studio_request_gate.sql and PROVES it works by
// impersonating a member's JWT claim and attempting the exact attack it exists
// to stop — writing a Confirmed podcast booking straight to the table.
//
//   node scripts/apply-phase10-studio-gate.mjs          # check only
//   node scripts/apply-phase10-studio-gate.mjs --apply  # apply, then verify
import { readFileSync } from 'node:fs'
import { sql } from './_sql.mjs'

const APPLY = process.argv.includes('--apply')
const TEST_ID = '__phase10_probe__'

const one = async (q) => (await sql(q))[0]

// Run a statement AS a member (RLS + triggers active), always rolled back.
async function asMember(email, statement) {
  const claims = JSON.stringify({ email, role: 'authenticated' }).replace(/'/g, "''")
  try {
    await sql(`
      begin;
      select set_config('request.jwt.claims', '${claims}', true);
      set local role authenticated;
      ${statement}
      rollback;`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e.message).split('\n')[0].slice(0, 220) }
  }
}

// A real member + their company, so current_company() resolves and RLS passes —
// otherwise a rejection could be RLS, not our trigger, and would prove nothing.
async function pickMember() {
  const r = await one(`
    select m.data->>'email' as email, m.data->>'companyId' as company_id
    from members m
    join tenants t on t.id = m.data->>'companyId'
    where m.data->>'email' is not null and m.data->>'email' <> ''
    limit 1;`)
  return r
}

const studio = await one(`select id from spaces where data->>'type' = 'podcast' limit 1;`)
if (!studio) { console.error('No podcast space found — nothing to gate.'); process.exit(1) }

const member = await pickMember()
if (!member) { console.error('No member+company pair found to test with.'); process.exit(1) }
console.log(`probe: studio=${studio.id}  member=${member.email}  company=${member.company_id}\n`)

const bookingJson = (status) => JSON.stringify({
  id: TEST_ID, reference: 'PROBE', resourceId: studio.id, companyId: member.company_id,
  date: '2099-01-05', startTime: '10:00', endTime: '11:00', status, source: 'Probe',
}).replace(/'/g, "''")

const insertAs = (status) =>
  `insert into bookings (id, data, updated_at) values ('${TEST_ID}', '${bookingJson(status)}'::jsonb, now());`

async function probe(label) {
  const confirmed = await asMember(member.email, insertAs('Confirmed'))
  const pending = await asMember(member.email, insertAs('Pending'))
  console.log(`── ${label} ──`)
  console.log(`  member writes Confirmed : ${confirmed.ok ? 'ACCEPTED  ⚠ HOLE OPEN' : 'REJECTED  ✓'}`)
  if (!confirmed.ok) console.log(`      ${confirmed.error}`)
  console.log(`  member writes Pending   : ${pending.ok ? 'ACCEPTED  ✓' : 'REJECTED  ⚠ TOO STRICT'}`)
  if (!pending.ok) console.log(`      ${pending.error}`)
  return { confirmedBlocked: !confirmed.ok, pendingAllowed: pending.ok }
}

const before = await probe('BEFORE')

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to apply the migration.')
  process.exit(0)
}

console.log('\napplying migrations/phase10_studio_request_gate.sql …')
await sql(readFileSync('migrations/phase10_studio_request_gate.sql', 'utf8'))
console.log('applied.\n')

const after = await probe('AFTER')

// A non-gated room must be completely unaffected.
const meeting = await one(`select id from spaces where data->>'type' = 'meeting' limit 1;`)
const meetingJson = JSON.stringify({
  id: TEST_ID, reference: 'PROBE', resourceId: meeting.id, companyId: member.company_id,
  date: '2099-01-05', startTime: '10:00', endTime: '11:00', status: 'Confirmed', source: 'Probe',
}).replace(/'/g, "''")
const mtg = await asMember(member.email,
  `insert into bookings (id, data, updated_at) values ('${TEST_ID}', '${meetingJson}'::jsonb, now());`)
console.log(`\n── regression: meeting room still instant-bookable ──`)
console.log(`  member writes Confirmed : ${mtg.ok ? 'ACCEPTED  ✓' : 'REJECTED  ⚠ BROKE MEETING ROOMS'}`)
if (!mtg.ok) console.log(`      ${mtg.error}`)

const pass = after.confirmedBlocked && after.pendingAllowed && mtg.ok
console.log(`\n${pass ? '✓ PHASE 10 ENFORCED' : '✗ SOMETHING IS WRONG — review above'}`)
console.log(`  (before: Confirmed was ${before.confirmedBlocked ? 'blocked' : 'ACCEPTED'})`)

// Nothing was committed — every probe ran inside a rolled-back transaction.
const leftovers = await one(`select count(*)::int as n from bookings where id = '${TEST_ID}';`)
console.log(`  probe rows left behind: ${leftovers.n} (must be 0)`)
process.exit(pass && leftovers.n === 0 ? 0 : 1)
