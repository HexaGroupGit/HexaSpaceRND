// Set a lease's monthlyRent (ex GST). Used for CON-171 (Canwealth): the 3-month
// rent-free period ended with July 2026, but the lease still carried $0, so the
// bill-run would have invoiced parking only from August — and the contract
// auto-renews 31 Jul 2026 for another 12 months.
//
//   node scripts/set-lease-rent.mjs CON-171 2100           # dry run
//   node scripts/set-lease-rent.mjs CON-171 2100 --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const [REF, RENT] = process.argv.slice(2)
const APPLY = process.argv.includes('--apply')
if (!REF || RENT == null) { console.error('usage: set-lease-rent.mjs <contractNumber|id> <monthlyRentExGst> [--apply]'); process.exit(1) }

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: rows } = await sb.from('leases').select('id,data')
const matches = rows.filter(r => (r.data.contractNumber === REF || r.id === REF) && r.data.status === 'active')
if (matches.length !== 1) { console.error(`Expected exactly 1 active lease for "${REF}", found ${matches.length}`); process.exit(1) }
const row = matches[0]
const lease = row.data

const { data: tRows } = await sb.from('tenants').select('id,data')
const co = tRows.find(t => t.id === lease.tenantId)?.data?.businessName || lease.tenantId

console.log(`${lease.contractNumber} — ${co}`)
console.log(`  term      : ${lease.startDate} → ${lease.endDate}`)
console.log(`  monthlyRent: $${lease.monthlyRent}  ->  $${Number(RENT)}  (ex GST; $${(Number(RENT) * 1.1).toFixed(2)} inc)`)
if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); process.exit(0) }

const data = { ...lease, monthlyRent: Number(RENT), rentUpdatedAt: new Date().toISOString() }
delete data.id
const { error } = await sb.from('leases').upsert({ id: row.id, data, updated_at: new Date().toISOString() })
console.log(error ? `FAILED: ${error.message}` : 'APPLIED')
