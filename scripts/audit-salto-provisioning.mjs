// Who was silently suppressed by the "activated more than a day ago" guard?
// Signature: onboardedAt stamped, but no saltoProvisionedAt — and onboardedAt
// lands well after activatedAt (the suppression path stamps onboardedAt =
// activatedAt, the real path stamps them minutes apart and sets salto fields).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
const grab = async (t) => ((await sb.from(t).select('data')).data ?? []).map(r => r.data)
const [leases, tenants, members, spaces] = await Promise.all(['leases','tenants','members','spaces'].map(grab))

const live = leases.filter(l => l.status === 'active' && l.onboardedAt)
console.log(`Active leases with onboardedAt: ${live.length}`)
const noSalto = live.filter(l => !l.saltoProvisionedAt)
console.log(`  ...of those with NO saltoProvisionedAt: ${noSalto.length}`)

// Narrow to platform-era contracts (signed on the platform, not OfficeRND imports).
const platformEra = noSalto.filter(l => l.signatureStatus && l.signedAt)
console.log(`  ...of those that were SIGNED on the platform: ${platformEra.length}\n`)

const memberHasSalto = (tid) => members.some(m => m.companyId === tid && (m.saltoAccess || m.saltoUserId))
console.log('Platform-signed, onboarded, but never Salto-provisioned:')
for (const l of platformEra.sort((a,b) => String(a.signedAt).localeCompare(String(b.signedAt)))) {
  const t = tenants.find(x => x.id === l.tenantId)
  const sp = spaces.find(s => s.id === l.spaceId)
  const gapH = l.activatedAt ? ((new Date(l.onboardedAt) - new Date(l.activatedAt)) / 3600000) : null
  console.log(`  ${(l.contractNumber ?? l.id).padEnd(9)} ${String(t?.businessName ?? '?').slice(0,30).padEnd(31)} ${String(sp?.unitNumber ?? '—').padEnd(11)} signed=${String(l.signedAt).slice(0,10)} gap=${gapH==null?'—':gapH.toFixed(1)+'h'} memberSalto=${memberHasSalto(l.tenantId)?'yes':'NO'} ${l.onboardingSuppressedReason?'[bulk-stamped]':''}`)
}
