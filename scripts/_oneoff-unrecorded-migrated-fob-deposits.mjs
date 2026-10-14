// One-off: the 7 Jul 2026 OfficeRND fob import (scripts/import-fobs.mjs) stamped
// every migrated assignment depositStatus:'paid', but the tracker export had no
// deposit data at all — so 79 devices claimed "Deposit held" with nothing behind
// it, and Delete/Return warned about deposits nobody paid. Flip every migrated
// assignment that has no deposit invoice of ours from 'paid' to 'unrecorded'.
// Admins can mark the genuinely-paid ones with the new "Deposit paid" button.
// Usage: node scripts/_oneoff-unrecorded-migrated-fob-deposits.mjs [--apply]
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const { data: aRows, error: ae } = await sb.from('fob_assignments').select('id,data')
if (ae) throw ae
const { data: iRows, error: ie } = await sb.from('invoices').select('data').filter('data->>invoiceType', 'eq', 'fob_deposit')
if (ie) throw ie
const invoiced = new Set(iRows.map((r) => r.data?.fobAssignmentId).filter(Boolean))

const targets = aRows.map((r) => r.data).filter((a) => a?.migratedAt && a.depositStatus === 'paid' && !invoiced.has(a.id) && !a.depositConfirmedAt)
console.log(`${targets.length} migrated assignments marked 'paid' with no deposit invoice (${targets.filter((a) => !a.returnedAt).length} still issued).`)
if (!APPLY) { console.log('Dry run. Pass --apply.'); process.exit(0) }

const now = new Date().toISOString()
const rows = targets.map((a) => ({ id: a.id, data: { ...a, depositStatus: 'unrecorded' }, updated_at: now }))
for (let i = 0; i < rows.length; i += 100) {
  const { error } = await sb.from('fob_assignments').upsert(rows.slice(i, i + 100))
  if (error) throw error
}
console.log(`Updated ${rows.length}.`)
