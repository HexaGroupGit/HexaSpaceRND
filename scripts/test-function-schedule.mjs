// Schedule editing on a function booking: normalisation, and the pricing
// consequences that are the reason it lives in the Adjust panel at all.
// Self-contained — `node scripts/test-function-schedule.mjs`.
import {
  normaliseSessions, sameSessions, computeQuote, bookingSessions,
  hoursBetween, bufferedWindow, isWeekendDate, balanceDueDate, RATES, CLEANING_FEE,
} from '../src/lib/functionBooking.js'

let failed = 0
const check = (label, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`); if (!ok) failed++ }

// ── normaliseSessions ───────────────────────────────────────────────────────
const n1 = normaliseSessions([
  { date: '2026-10-10', startTime: '18:00', endTime: '22:00' },
  { date: '2026-10-03', startTime: '09:00', endTime: '12:00' },
])
check('sorts sessions chronologically', n1.sessions[0].date === '2026-10-03' && n1.sessions[1].date === '2026-10-10')
check('no bad window reported for valid rows', n1.bad === null && n1.dropped === 0)

const n2 = normaliseSessions([
  { date: '2026-10-03', startTime: '09:00', endTime: '12:00' },
  { date: '', startTime: '09:00', endTime: '12:00' },
  { date: '2026-10-04', startTime: '', endTime: '12:00' },
])
check('drops incomplete rows and counts them', n2.sessions.length === 1 && n2.dropped === 2)

const n3 = normaliseSessions([{ date: '2026-10-03', startTime: '18:00', endTime: '16:00' }])
check('flags a backwards window', n3.bad?.date === '2026-10-03')
const n4 = normaliseSessions([{ date: '2026-10-03', startTime: '18:00', endTime: '18:00' }])
check('flags a zero-length window', n4.bad?.date === '2026-10-03')

check('sameSessions matches identical lists', sameSessions(n1.sessions, [...n1.sessions]))
check('sameSessions spots a time change',
  !sameSessions(n1.sessions, n1.sessions.map((s, i) => (i ? s : { ...s, endTime: '13:00' }))))
check('sameSessions spots a length change', !sameSessions(n1.sessions, n1.sessions.slice(1)))

// ── a backwards window prices SILENTLY at zero ──────────────────────────────
// hoursBetween clamps at 0, so an unguarded save doesn't error — it just bills
// nothing for the venue. That silence is why normaliseSessions rejects it.
check('backwards window prices at zero, not an error', hoursBetween('18:00', '16:00') === 0)

// A session running to midnight is ordinary and must price as real hours.
check('18:00-00:00 is six hours, not zero', hoursBetween('18:00', '00:00') === 6)
check('a midnight end is a valid window', normaliseSessions([{ date: '2026-10-08', startTime: '18:00', endTime: '00:00' }]).bad === null)
const wMid = bufferedWindow('18:00', '00:00')
check('a midnight hold stops at 23:59, never 24:00', wMid.blockEnd === '23:59', `${wMid.blockStart}-${wMid.blockEnd}`)

// ── duration change moves the price ─────────────────────────────────────────
// 2026-10-08 is a Thursday (weekday), 2026-10-10 a Saturday (weekend).
check('weekday/weekend detection', !isWeekendDate('2026-10-08') && isWeekendDate('2026-10-10'))

const base = { guests: 40, bookedOn: '2026-09-01' }
const q4h = computeQuote({ ...base, sessions: [{ date: '2026-10-08', startTime: '18:00', endTime: '22:00' }] })
const q6h = computeQuote({ ...base, sessions: [{ date: '2026-10-08', startTime: '18:00', endTime: '00:00' }] })
check('a midnight session is billed, not free', q6h.rental > 0, `$${q6h.rental}`)
check('4h weekday hire priced at the weekday rate', q4h.rental === 4 * RATES.weekday, `$${q4h.rental}`)
check('extending 4h -> 6h raises the hire', q6h.hours === 6 && q6h.rental === 6 * RATES.weekday, `${q6h.hours}h $${q6h.rental}`)
check('longer session costs more in total', q6h.total > q4h.total, `${q4h.total} -> ${q6h.total}`)

// ── moving the DATE changes the rate even at identical hours ────────────────
const qSat = computeQuote({ ...base, sessions: [{ date: '2026-10-10', startTime: '18:00', endTime: '22:00' }] })
check('same hours on a weekend cost more', qSat.hours === q4h.hours && qSat.rental === 4 * RATES.weekend,
  `weekday $${q4h.rental} vs weekend $${qSat.rental}`)

// ── adding a session adds a cleaning fee (charged per session) ──────────────
const qTwo = computeQuote({ ...base, sessions: [
  { date: '2026-10-08', startTime: '18:00', endTime: '22:00' },
  { date: '2026-10-15', startTime: '18:00', endTime: '22:00' },
] })
check('cleaning is charged per session', qTwo.cleaning === 2 * CLEANING_FEE, `$${qTwo.cleaning}`)
check('security deposit is held once per booking', qTwo.securityDeposit === q4h.securityDeposit)
check('two sessions report sessionCount 2', qTwo.sessionCount === 2)

// ── negotiated overrides survive a reschedule ──────────────────────────────
const withOverride = { ...base, priceOverrides: { rate: 180, discountPct: 10, discountReason: 'Repeat client' } }
const oWeekday = computeQuote({ ...withOverride, sessions: [{ date: '2026-10-08', startTime: '18:00', endTime: '22:00' }] })
const oWeekend = computeQuote({ ...withOverride, sessions: [{ date: '2026-10-10', startTime: '18:00', endTime: '22:00' }] })
check('custom rate replaces BOTH weekday and weekend rates',
  oWeekday.rental === 4 * 180 && oWeekend.rental === 4 * 180,
  `weekday $${oWeekday.rental}, weekend $${oWeekend.rental}`)
check('a moved booking keeps its negotiated discount', oWeekend.total < 4 * 180 * 1.1 + qTwo.securityDeposit + CLEANING_FEE * 1.1)

// ── the first session is what downstream reads ─────────────────────────────
const b = { sessions: normaliseSessions([
  { date: '2026-11-20', startTime: '10:00', endTime: '14:00' },
  { date: '2026-11-06', startTime: '18:00', endTime: '23:00' },
]).sessions }
const first = bookingSessions(b)[0]
check('bookingSessions returns the earliest first', first.date === '2026-11-06')
check('balance falls due 14 days before the FIRST session',
  balanceDueDate(first.date, '2026-09-01') === '2026-10-23', balanceDueDate(first.date, '2026-09-01'))

// ── calendar hold keeps its 30-min buffer each side ────────────────────────
const w = bufferedWindow('18:00', '22:00')
check('hold brackets the session by 30 min', w.blockStart === '17:30' && w.blockEnd === '22:30', `${w.blockStart}-${w.blockEnd}`)

console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`)
process.exit(failed === 0 ? 0 : 1)
