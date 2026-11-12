// Marks L2 Suite 7 and Suite 24 (WEHOME, CON-120 / CON-WEHOME24) "potentially
// available" so new contracts can be prepared on them now, the same as the
// Mark available button in Spaces → Private Offices. Prepared contracts stay
// pending until WEHOME's contracts are ended. Nothing about WEHOME changes.
//
// Dry-run by default; pass --apply to write.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { officeHolderIds } from '../src/lib/officeAvailability.js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.trimStart().startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const get = async (t) => { const out = []; for (let o = 0; ; o += 1000) { const { data, error } = await sb.from(t).select('id,data').range(o, o + 999); if (error) throw error; out.push(...data.map((r) => ({ ...r.data, id: r.id }))); if (data.length < 1000) return out } }

const [spaces, leases] = await Promise.all([get('spaces'), get('leases')])
const now = new Date().toISOString()
for (const id of ['hx_l2_suite7', 'hx_l2_suite24']) {
  const s = spaces.find((x) => x.id === id)
  if (!s || s.type !== 'office') throw new Error(`GUARD: ${id} not an office`)
  const holders = officeHolderIds(s, leases)
  if (!holders.length) throw new Error(`GUARD: ${id} has no live contract — it is simply vacant`)
  console.log(`${s.unitNumber}: held by ${holders.map((h) => leases.find((l) => l.id === h)?.contractNumber ?? h).join(', ')} -> mark available`)
  if (!APPLY) continue
  const { id: _, ...data } = { ...s, availableAfterLeases: holders, markedAvailableAt: now }
  const { error } = await sb.from('spaces').update({ data: { ...data, id }, updated_at: now }).eq('id', id)
  if (error) throw error
}
console.log(APPLY ? 'Applied.' : 'DRY RUN - pass --apply to write.')
process.exit(0)
