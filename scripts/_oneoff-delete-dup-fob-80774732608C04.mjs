// One-off: remove the duplicate fob row for serial 80774732608C04 (added twice on
// 6 Oct 2026). The real device (fob_…y0ve) is issued to Brad Voskresensky
// (Steadfast). The duplicate (fob_…r3st) was issued + returned, but its deposit
// invoice INV-3665 is the live one (in Xero, reminded) while the real device's
// INV-3666 was voided — so INV-3665 is repointed at the real assignment before the
// duplicate device + its returned assignment are deleted.
// Usage: node scripts/_oneoff-delete-dup-fob-80774732608C04.mjs [--apply]
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const KEEP_ASSIGNMENT = 'fa_1791261003589_khav'
const DUP_FOB = 'fob_1791261158766_r3st'
const DUP_ASSIGNMENT = 'fa_1791261203400_f90v'
const LIVE_INVOICE = 'inv1791261203887t0gu' // INV-3665

const { data: dup } = await sb.from('fobs').select('data').eq('id', DUP_FOB).maybeSingle()
if (!dup) { console.log('Duplicate already gone.'); process.exit(0) }
if (dup.data.status !== 'available') throw new Error(`Duplicate is ${dup.data.status}, expected available — aborting`)
const { data: inv } = await sb.from('invoices').select('data').eq('id', LIVE_INVOICE).single()
if (inv.data.fobAssignmentId !== DUP_ASSIGNMENT) throw new Error('INV-3665 no longer points at the duplicate — aborting')

console.log(`Repoint ${inv.data.number} (${inv.data.status}) → ${KEEP_ASSIGNMENT}; delete ${DUP_FOB} + ${DUP_ASSIGNMENT}`)
if (!APPLY) { console.log('Dry run. Pass --apply.'); process.exit(0) }

const now = new Date().toISOString()
let r = await sb.from('invoices').update({ data: { ...inv.data, fobAssignmentId: KEEP_ASSIGNMENT }, updated_at: now }).eq('id', LIVE_INVOICE)
if (r.error) throw r.error
r = await sb.from('fob_assignments').delete().eq('id', DUP_ASSIGNMENT); if (r.error) throw r.error
r = await sb.from('fobs').delete().eq('id', DUP_FOB); if (r.error) throw r.error
console.log('Done.')
