// Stamp onboardedAt on leases that have already had the welcome email, so the
// onboarding catch-up stops re-sending it.
//
// `shouldOnboard` (reconcile step 2) and the in-app onboardLease both gate on
// onboardedAt being absent. A lease that has demonstrably been onboarded — the
// client has had the welcome email, often several times — but whose stamp never
// persisted will be re-onboarded on every pass. Stamping it is the documented
// suppression path (reconcile does exactly this at line 203 for spaces that were
// already occupied).
//
//   node scripts/stop-onboarding-resend.mjs            # dry run
//   node scripts/stop-onboarding-resend.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const rows = (await sb.from('leases').select('id,data')).data ?? []
const tenants = ((await sb.from('tenants').select('id,data')).data ?? []).map(r => ({ ...r.data, id: r.id }))
const logs = ((await sb.from('email_log').select('data')).data ?? []).map(r => r.data)
const co = (l) => tenants.find(t => t.id === l.tenantId)?.businessName || l.tenantId

// Every recipient who has already had an onboarding email, and how many times.
const sentTo = {}
for (const e of logs) {
  if (e.emailType !== 'onboarding') continue
  const k = String(e.to || '').toLowerCase()
  sentTo[k] = (sentTo[k] ?? 0) + 1
}

const candidates = []
for (const row of rows) {
  const l = row.data
  if (l.status !== 'active' || l.onboardedAt) continue
  const t = tenants.find(x => x.id === l.tenantId)
  const email = String(t?.email ?? '').toLowerCase()
  const count = sentTo[email] ?? 0
  if (count > 0) candidates.push({ row, l, email, count })
}

console.log(`Active leases with NO onboardedAt that have already been emailed: ${candidates.length}\n`)
for (const c of candidates) {
  console.log(`  ${String(c.l.contractNumber ?? c.row.id).padEnd(14)} ${co(c.l).slice(0, 32).padEnd(33)} ${c.email.padEnd(34)} welcome sent ${c.count}×`)
}
if (!candidates.length) { console.log('Nothing to stamp.'); process.exit(0) }
if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); process.exit(0) }

let ok = 0
for (const c of candidates) {
  const stamp = c.l.activatedAt ?? new Date().toISOString()
  const data = { ...c.l, onboardedAt: stamp, onboardingSuppressedReason: `welcome already sent ${c.count}× — stamped to stop re-send` }
  const { error } = await sb.from('leases').upsert({ id: c.row.id, data, updated_at: new Date().toISOString() })
  if (error) console.error(`  FAILED ${c.row.id}: ${error.message}`)
  else ok++
}
console.log(`\nAPPLIED: ${ok}/${candidates.length} leases stamped — the welcome will not send again.`)
