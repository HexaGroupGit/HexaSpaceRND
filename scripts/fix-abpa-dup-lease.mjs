import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const APPLY = process.argv.includes('--apply')
const KEEP = 'CON-66'
const VOID = 'l_xa_constellali'
const INV = 'inv_auto_1782864045043_hiyld' // INV-3087, July 2026
const now = new Date().toISOString()

const get = async (table, id) => (await sb.from(table).select('id,data').eq('id', id).single()).data
const keep = await get('leases', KEEP)
const dup  = await get('leases', VOID)
const inv  = await get('invoices', INV)
if (!keep || !dup || !inv) { console.error('Missing a record:', { keep: !!keep, dup: !!dup, inv: !!inv }); process.exit(1) }

// 1) Void the duplicate Xero-alignment lease, leave a merge trail.
const dupNext = {
  ...dup.data,
  status: 'voided',
  voidedAt: now,
  mergedIntoLeaseId: KEEP,
  notes: `${dup.data.notes ? dup.data.notes + '\n' : ''}Voided ${now.slice(0, 10)} — duplicate of ${KEEP} (same $350 Flexible Desk membership for Stella Li / ABPA). Consolidated into ${KEEP} to stop double-billing.`,
}

// 2) Copy the space onto the surviving contract (CON-66 had none).
const keepNext = {
  ...keep.data,
  spaceId: keep.data.spaceId || dup.data.spaceId || '',
  notes: `${keep.data.notes ? keep.data.notes + '\n' : ''}Absorbed duplicate lease ${VOID} on ${now.slice(0, 10)} (Xero-alignment artifact); space ${dup.data.spaceId || '(none)'} carried over; INV-3087 relinked here.`,
}

// 3) Relink the July invoice to the surviving contract.
const invNext = { ...inv.data, leaseId: KEEP }

console.log('── PLAN ──')
console.log(`VOID  ${VOID}: status ${dup.data.status} -> voided, mergedIntoLeaseId=${KEEP}`)
console.log(`KEEP  ${KEEP}: spaceId "${keep.data.spaceId || ''}" -> "${keepNext.spaceId}"  (status stays ${keep.data.status})`)
console.log(`INV   ${INV} (${inv.data.number}): leaseId "${inv.data.leaseId}" -> "${KEEP}"`)

if (!APPLY) { console.log('\n(dry run — re-run with --apply to write)'); process.exit(0) }

const up = async (table, id, data) => { const { error } = await sb.from(table).update({ data, updated_at: now }).eq('id', id); if (error) throw new Error(`${table}/${id}: ${error.message}`) }
await up('leases', VOID, dupNext)
await up('leases', KEEP, keepNext)
await up('invoices', INV, invNext)
console.log('\n✔ Applied. ABPA now has one active $350 lease (CON-66).')
