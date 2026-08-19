import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const [{ data: bk }, { data: sp }] = await Promise.all([sb.from('bookings').select('data'), sb.from('spaces').select('data')])
const spaces = (sp ?? []).map(r => r.data), roomName = (id) => spaces.find(s => s.id === id)?.unitNumber ?? id
const OFF = '+10:00' // July = AEST
const now = Date.now()
const rows = (bk ?? []).map(r => r.data).filter(b => b.roomAccessSentAt && b.date && b.startTime && b.endTime)
  .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
console.log('Bookings with room-access GRANTED:\n')
let dueNow = 0
for (const b of rows) {
  const from = new Date(`${b.date}T${b.startTime}:00${OFF}`).getTime()
  const until = new Date(`${b.date}T${b.endTime}:00${OFF}`).getTime()
  const ended = until <= now, active = now >= from - 15 * 60000 && now < until
  const phase = ended ? 'ENDED' : active ? 'active' : 'upcoming'
  const removed = b.roomAccessRemovedAt ? ('removed ' + b.roomAccessRemovedAt.slice(0, 16)) : '—'
  const due = ended && !b.roomAccessRemovedAt
  if (due) dueNow++
  console.log(`${(b.reference ?? b.id).padEnd(12)} ${roomName(b.resourceId).padEnd(10)} ${b.date} ${b.startTime}-${b.endTime} [${phase.padEnd(8)}] mode=${(b.roomAccessMode ?? '?').toString().padEnd(4)} ${removed}${due ? '   <-- REMOVE DUE' : ''}`)
}
console.log(`\n${rows.length} granted · ${dueNow} ended-but-not-removed · now=${new Date(now).toISOString()}`)
