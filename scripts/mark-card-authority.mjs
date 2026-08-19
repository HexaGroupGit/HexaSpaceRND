// Stamp the card payment authority on named companies so stored-card collection
// applies to them (api/overdue-reminders.js gates on cardAuthorityAccepted).
//
// These are OfficeRND-era members whose card authority was given under the
// OfficeRND-era terms; the flag is being recorded administratively rather than
// ticked by the member in the portal, so we record that provenance honestly —
// if a charge is ever disputed, the record should show how consent was captured.
//
//   node scripts/mark-card-authority.mjs            # dry run
//   node scripts/mark-card-authority.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { CARD_AUTHORITY_VERSION } from '../src/lib/cardAuthority.js'

const APPLY = process.argv.includes('--apply')
const ADMIN = 'kuangeric1234@gmail.com'
const NAMES = ['Mynt.Media', 'X&Y Technology PTY LTD', 'AC Bridge International Group', 'JC Partners Lawyers']

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: tRows } = await sb.from('tenants').select('id,data')
const targets = tRows.map(r => ({ ...r.data, id: r.id })).filter(t => NAMES.includes(t.businessName))

const missing = NAMES.filter(n => !targets.some(t => t.businessName === n))
if (missing.length) console.warn('NOT FOUND:', missing.join(', '))

for (const t of targets) {
  const ok = !!t.stripePaymentMethodId
  console.log(`${ok ? 'SET ' : 'SKIP'} ${t.id.padEnd(8)} ${t.businessName.padEnd(32)} card=${t.cardBrand || '-'} ••${t.cardLast4 || '----'} was=${t.cardAuthorityAccepted === true}${ok ? '' : '  (no card on file)'}`)
  if (!ok || !APPLY) continue
  const data = {
    ...t,
    cardAuthorityAccepted: true,
    cardAuthorityAcceptedAt: new Date().toISOString(),
    cardAuthorityVersion: CARD_AUTHORITY_VERSION,
    cardAuthorityBy: ADMIN,
    cardAuthoritySource: 'admin-recorded (OfficeRND-era card authority)',
  }
  delete data.id
  const { error } = await sb.from('tenants').upsert({ id: t.id, data, updated_at: new Date().toISOString() })
  console.log(error ? `     FAILED: ${error.message}` : '     ok')
}
if (!APPLY) console.log('\nDRY RUN — nothing written. Re-run with --apply.')
