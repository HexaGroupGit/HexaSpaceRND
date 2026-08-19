// FN-433595 (I DO International) was confirmed on 6 Aug 2026, but every session's
// calendar hold was created in the same tick with id `bk${Date.now()}` — six
// identical ids that upserted onto one row, so only session 6/6 survived.
// The store's id generator is fixed; this repairs the row that was already lost.
// Usage: node scripts/fix-ido-function-holds.mjs [--apply]
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const FN_ID = 'fn1783646373676_iyyy'
const BUFFER_MIN = 30
const shift = (t, mins) => {
  const [h, m] = String(t).split(':').map(Number)
  const tot = Math.max(0, Math.min(24 * 60 - 1, h * 60 + m + mins))
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`
}
const ref7 = () => Array.from({ length: 7 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const overlaps = (a1, a2, b1, b2) => toMin(a1) < toMin(b2) && toMin(b1) < toMin(a2)

const { data: fbRows, error: fbErr } = await sb.from('function_bookings').select('data').eq('id', FN_ID)
if (fbErr) throw fbErr
const fb = fbRows[0].data
const sessions = [...fb.sessions].sort((a, z) => `${a.date}T${a.startTime}`.localeCompare(`${z.date}T${z.startTime}`))

const { data: allBk } = await sb.from('bookings').select('id,data')
const existing = allBk.filter((b) => b.data.functionRef === fb.ref && b.data.status !== 'Cancelled')
console.log(`FN ${fb.ref} · ${sessions.length} sessions · ${existing.length} calendar hold(s) present: ${existing.map((e) => `${e.id}@${e.data.date}`).join(', ') || '—'}`)

const onFunc = allBk.filter((b) => b.data.resourceId === 'hx_func' && b.data.status !== 'Cancelled' && b.data.functionRef !== fb.ref)
const rows = []
for (const [i, s] of sessions.entries()) {
  const startTime = shift(s.startTime, -BUFFER_MIN)
  const endTime = shift(s.endTime, BUFFER_MIN)
  const have = existing.find((e) => e.data.date === s.date)
  if (have) { console.log(`  ${s.date} ${startTime}-${endTime}  session ${i + 1}/${sessions.length}  → already held (${have.id})`); continue }
  const clash = onFunc.filter((b) => b.data.date === s.date && overlaps(startTime, endTime, b.data.startTime || '00:00', b.data.endTime || '23:59'))
  if (clash.length) { console.log(`  ${s.date} ${startTime}-${endTime}  session ${i + 1}/${sessions.length}  !! CLASH with ${clash.map((c) => c.id).join(', ')} — skipped`); continue }
  const id = `bk${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  rows.push({
    id,
    data: {
      id, type: 'function', resourceId: 'hx_func', date: s.date, startTime, endTime,
      title: `${fb.eventName || 'Function'} — session ${i + 1}/${sessions.length} (incl. buffer)`,
      eventType: fb.eventType, guests: Number(fb.guests) || null,
      status: 'Confirmed', approval: 'approved', source: 'Function Bookings',
      functionRef: fb.ref, repeat: 'none', createdBy: 'Admin',
      reference: ref7(), createdAt: fb.confirmedAt,
    },
    updated_at: new Date().toISOString(),
  })
  console.log(`  ${s.date} ${startTime}-${endTime}  session ${i + 1}/${sessions.length}  → CREATE ${id}`)
}

// Rebuild calendarBookingIds in session order from what actually exists.
const finalIds = sessions.map((s) => (existing.find((e) => e.data.date === s.date)?.id) ?? rows.find((r) => r.data.date === s.date)?.id ?? null).filter(Boolean)
console.log(`\ncalendarBookingIds: ${JSON.stringify(fb.calendarBookingIds)}\n              → ${JSON.stringify(finalIds)}`)

if (!APPLY) { console.log('\nDRY RUN — re-run with --apply to write.'); process.exit(0) }

if (rows.length) {
  const { error } = await sb.from('bookings').upsert(rows)
  if (error) throw error
  console.log(`\nInserted ${rows.length} booking row(s).`)
}
const updated = { ...fb, calendarBookingIds: finalIds, calendarBookingId: finalIds[0] ?? null, updatedAt: new Date().toISOString() }
const { error: uErr } = await sb.from('function_bookings').upsert({ id: FN_ID, data: updated, updated_at: updated.updatedAt })
if (uErr) throw uErr
console.log('Repaired calendarBookingIds on the function booking.')
