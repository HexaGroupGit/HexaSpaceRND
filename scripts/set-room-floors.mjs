// One-off: assign each meeting room to its correct floor in Supabase.
//   Level 2 → Sun, Moon, Central
//   Level 4 → every other meeting room (function space + studios/podcast untouched)
//
// Reads/writes the `spaces` table ({ id, data, updated_at }); only mutates
// data.floor, leaving the rest of each room record intact. Idempotent.
//
// Preview first:   node scripts/set-room-floors.mjs --dry
// Apply:           node scripts/set-room-floors.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry')

// ── Load env from .env.local ──────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8')
    .split('\n')
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Level 2 rooms, matched on the leading word of the name ("Sun (Ri / …)" → "sun").
const LEVEL2 = new Set(['sun', 'moon', 'central'])
const leadWord = (name) => String(name || '').trim().toLowerCase().split(/[\s(/·—-]/)[0]
const isFunctionSpace = (s) => s.type === 'function' || s.id === 'hx_func' || /function/i.test(s.unitNumber || '')

const { data: rows, error } = await sb.from('spaces').select('id, data')
if (error) { console.error('Fetch failed:', error.message); process.exit(1) }

const rooms = (rows ?? [])
  .map((r) => ({ id: r.id, data: r.data }))
  .filter((r) => r.data?.type === 'meeting' && !isFunctionSpace(r.data))

const nowIso = new Date().toISOString()
let changed = 0

for (const r of rooms) {
  const target = LEVEL2.has(leadWord(r.data.unitNumber)) ? 'l2' : 'l4'
  const current = r.data.floor ?? '(unset)'
  if (current === target) {
    console.log(`  ok   ${r.data.unitNumber.padEnd(22)} ${target}`)
    continue
  }
  console.log(`${DRY ? 'would' : 'set  '} ${r.data.unitNumber.padEnd(22)} ${current} → ${target}`)
  changed++
  if (!DRY) {
    const { error: upErr } = await sb.from('spaces')
      .update({ data: { ...r.data, floor: target }, updated_at: nowIso })
      .eq('id', r.id)
    if (upErr) console.error(`  ERR ${r.id}: ${upErr.message}`)
  }
}

console.log(`\n${rooms.length} meeting rooms · ${changed} ${DRY ? 'would change' : 'updated'}${DRY ? ' (dry run — re-run without --dry to apply)' : ''}`)
