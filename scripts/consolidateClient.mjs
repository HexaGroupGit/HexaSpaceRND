// One-off cleanup: consolidate the duplicate test tenants/members created for a
// single email into ONE canonical client, then remove the emptied duplicates.
//
// Reviewed targets below — edit if needed. Runs a DRY RUN by default (prints what
// it would change). Add --apply to actually write.
//
//   node scripts/consolidateClient.mjs           # dry run (safe)
//   node scripts/consolidateClient.mjs --apply    # perform the consolidation
//
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── Targets (review these) ───────────────────────────────────────────────────
const EMAIL = 'kuangeric1234@gmail.com'
const CANON = 't1783050492519'          // tenant to KEEP (holds FN-330513 / INV-3240)
const KEEP_MEMBER = 'm1783050497360'    // member to KEEP (points at CANON)
const DUP_TENANTS = ['t1782959283706', 't1783044897642wyvn', 't1783047142639', 't1783047713172']
// ─────────────────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const now = new Date().toISOString()
const tag = APPLY ? '[APPLY]' : '[dry-run]'

async function main() {
  // 1) leases → CANON
  const { data: leaseRows } = await sb.from('leases').select('id,data')
  const leases = (leaseRows || []).filter((r) => DUP_TENANTS.includes(r.data?.tenantId))
  console.log(`${tag} leases to reassign → ${CANON}:`, leases.map((r) => r.data.id || r.id))
  if (APPLY) for (const r of leases) await sb.from('leases').upsert({ id: r.id, data: { ...r.data, tenantId: CANON }, updated_at: now })

  // 2) invoices → CANON (scoped per dup tenant, JSONB filter avoids the 1000 cap)
  let invIds = []
  for (const tid of DUP_TENANTS) {
    const { data } = await sb.from('invoices').select('id,data').eq('data->>tenantId', tid)
    invIds.push(...(data || []).map((r) => r.data.number || r.id))
    if (APPLY) for (const r of (data || [])) await sb.from('invoices').upsert({ id: r.id, data: { ...r.data, tenantId: CANON }, updated_at: now })
  }
  console.log(`${tag} invoices to reassign → ${CANON}:`, invIds)

  // 3) function bookings for this email → CANON / KEEP_MEMBER
  const { data: fbRows } = await sb.from('function_bookings').select('id,data')
  const fbs = (fbRows || []).filter((r) => (r.data?.email || '').toLowerCase() === EMAIL)
  console.log(`${tag} function bookings to repoint → ${CANON}:`, fbs.map((r) => r.data.ref))
  if (APPLY) for (const r of fbs) await sb.from('function_bookings').upsert({ id: r.id, data: { ...r.data, companyId: CANON, tenantId: CANON, memberId: KEEP_MEMBER }, updated_at: now })

  // 4) members: keep one → CANON, delete the other dups for this email
  const { data: memRows } = await sb.from('members').select('id,data')
  const mine = (memRows || []).filter((r) => (r.data?.email || '').toLowerCase() === EMAIL)
  for (const r of mine) {
    if (r.id === KEEP_MEMBER) { console.log(`${tag} keep member ${r.id} → companyId ${CANON}`); if (APPLY) await sb.from('members').upsert({ id: r.id, data: { ...r.data, companyId: CANON }, updated_at: now }) }
    else { console.log(`${tag} DELETE member ${r.id}`); if (APPLY) await sb.from('members').delete().eq('id', r.id) }
  }

  // 5) delete emptied duplicate tenants
  for (const tid of DUP_TENANTS) { console.log(`${tag} DELETE tenant ${tid}`); if (APPLY) await sb.from('tenants').delete().eq('id', tid) }

  console.log(APPLY ? 'DONE — consolidation applied.' : 'Dry run complete. Re-run with --apply to perform it.')
}
main()
