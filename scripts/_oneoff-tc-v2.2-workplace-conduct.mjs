// One-off: Terms and Conditions (templates.tmpl1) v2.1 → v2.2 — workplace abuse
// is not acceptable. Assistant board task "Add policy in the contract: Work
// place abuse is not acceptable." (Scarlett, 20 Oct 2026).
//
// Adds 5(c) Workplace Conduct + 5(d) removal/suspension, and a 12(d)
// termination ground for serious or repeated breach of 5(c). Exact-string edits
// only; refuses to run if any anchor has drifted. Writes a backup first.
//
//   node scripts/_oneoff-tc-v2.2-workplace-conduct.mjs          # dry run
//   node scripts/_oneoff-tc-v2.2-workplace-conduct.mjs --apply
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const APPLY = process.argv.includes('--apply')

export const CLAUSE_5C = '<p>(c) (Workplace Conduct) Hexa Space is committed to providing a safe and respectful workplace. Abuse of any kind is not acceptable, including verbal, written, physical, psychological or online abuse, threats, intimidation, bullying, harassment (including sexual harassment) and discrimination, whether directed at Hexa Space staff, contractors, other members or visitors. The Member must not engage in, and must ensure that its Permitted Occupiers and visitors do not engage in, any such conduct at the Premises or in any communication with Hexa Space staff.</p>'
export const CLAUSE_5D = '<p>(d) Where Hexa Space reasonably believes a person has breached clause 5(c), Hexa Space may require that person to leave the Premises immediately and may suspend that person\'s access to the Premises while the matter is investigated.</p>'

const EDITS = [
  // 5(c)/(d) go after 5(b), before clause 6.
  ['any breach by a Permitted Occupier shall be deemed a breach by the Member.</p><p><strong>6. Security Deposit</strong>',
   `any breach by a Permitted Occupier shall be deemed a breach by the Member.</p>${CLAUSE_5C}${CLAUSE_5D}<p><strong>6. Security Deposit</strong>`],
  // 12: (b) loses its "or", (c) gains it, new (d).
  ['is not remedied within a reasonable period of time; or</p>',
   'is not remedied within a reasonable period of time;</p>'],
  ['unable to pay its debts as they fall due.</p><p><strong>13.',
   'unable to pay its debts as they fall due; or</p><p>(d) if the Member or any of its Permitted Occupiers commits a serious or repeated breach of clause 5(c), without any requirement to first allow the breach to be remedied.</p><p><strong>13.'],
]

const { data: row, error } = await sb.from('templates').select('id,data').eq('id', 'tmpl1').single()
if (error) throw error
const t = row.data
if (t.version !== 'v2.1') { console.log(`tmpl1 is ${t.version}, expected v2.1 — nothing done.`); process.exit(1) }
let html = t.content
for (const [from, to] of EDITS) {
  const n = html.split(from).length - 1
  if (n !== 1) throw new Error(`anchor matched ${n}× (want 1): ${from.slice(0, 70)}`)
  html = html.replace(from, to)
}
console.log('All 3 anchors matched once. New clause 5(c):\n ', CLAUSE_5C.replace(/<[^>]+>/g, ''))
if (!APPLY) { console.log('\nDry run — pass --apply to write.'); process.exit(0) }

const backup = `C:/Hexa-Space-RND/tmpl1-v2.1-backup-${new Date().toISOString().slice(0, 10)}.json`
writeFileSync(backup, JSON.stringify(t, null, 1))
const nowIso = new Date().toISOString()
const next = { ...t, content: html, version: 'v2.2', updatedAt: nowIso }
const { error: e } = await sb.from('templates').update({ data: next, updated_at: nowIso }).eq('id', 'tmpl1')
if (e) throw e
console.log(`\nApplied: tmpl1 → v2.2. Backup at ${backup}`)
