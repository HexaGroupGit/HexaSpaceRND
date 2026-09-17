// Read-only: why did a member get the "signed and settled — get started from
// <start date>" welcome months after their contract began? Prints, for every
// contract on the given suite, what the onboarding gate looks at: signature,
// deposit + first recurring invoice (with payment and void dates), the card on
// file, the onboarding stamps, and the onboarding emails logged. Then lists
// every contract onboarded in the last 14 days whose start date was already
// over 30 days old, i.e. everyone else who got a late welcome. Writes nothing.
//
//   node scripts/_probe-late-welcome.mjs 405
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()
const SUPABASE_URL = get('SUPABASE_URL')
const SERVICE_KEY = get('SUPABASE_SERVICE_ROLE_KEY')
const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

async function getAll(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=data&order=id.asc`, { headers: { ...h, Range: `${from}-${from + 999}` } })
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`)
    const batch = await r.json()
    out.push(...batch.map((x) => x.data))
    if (batch.length < 1000) break
  }
  return out
}

const suite = String(process.argv[2] ?? '405')
const [leases, invoices, spaces, tenants, members, emailLog] = await Promise.all(
  ['leases', 'invoices', 'spaces', 'tenants', 'members', 'email_log'].map(getAll))

const covers = (inv, leaseId) => inv.leaseId === leaseId || (inv.leaseIds ?? []).includes(leaseId)
const day = (iso) => (iso ? String(iso).slice(0, 10) : '—')

const suiteSpaces = spaces.filter((s) => String(s.unitNumber ?? '').includes(suite))
console.log(`Spaces matching "${suite}": ${suiteSpaces.map((s) => `${s.unitNumber} [${s.type}, ${s.status}]`).join(', ') || 'none'}\n`)
const ids = new Set(suiteSpaces.map((s) => s.id))
const onSuite = leases.filter((l) => ids.has(l.spaceId) || (l.items ?? []).some((i) => ids.has(i.spaceId)))

for (const l of onSuite) {
  const t = tenants.find((x) => x.id === l.tenantId)
  const contacts = members.filter((m) => m.companyId === l.tenantId)
  console.log(`━━ ${l.contractNumber ?? l.id} · ${t?.businessName ?? l.tenantId} · ${l.status}`)
  console.log(`   term ${l.startDate} → ${l.endDate} · type ${l.contractType ?? '—'} · ${l.membershipType ?? l.documentType ?? ''}`)
  console.log(`   signature ${l.signatureStatus ?? '—'} · signed ${day(l.signedAt ?? l.tenantSignedAt)} · activated ${day(l.activatedAt)}`)
  console.log(`   onboardedAt ${l.onboardedAt ?? '—'} · portalWelcomeSentAt ${l.portalWelcomeSentAt ?? '—'} · saltoProvisionedAt ${l.saltoProvisionedAt ?? '—'}`)
  console.log(`   deposit ${l.bondAmount ?? 0} (carried ${l.bondCarriedForward ?? 0}) · card required ${l.requireCardOnFile ?? 'default'} · card on file ${t?.stripePaymentMethodId ? `yes, verified ${day(t.cardVerifiedAt)}` : 'no'}`)
  console.log(`   contacts: ${contacts.map((m) => `${m.email}${m.portalAccess ? ' (portal)' : ''}`).join(', ') || '—'}`)
  const mine = invoices.filter((i) => covers(i, l.id))
    .sort((a, b) => String(a.issueDate ?? '').localeCompare(String(b.issueDate ?? '')))
  for (const i of mine) {
    const paid = (i.payments ?? []).map((p) => `${p.date ?? '?'} ${p.method ?? ''} $${p.amount}`).join('; ')
    const voided = i.status === 'voided' ? ` · voided ${day(i.voidedAt)} ${i.voidedVia ?? ''} ${i.voidReason ?? ''}` : ''
    console.log(`     ${String(i.number).padEnd(10)} ${String(i.invoiceType ?? 'recurring').padEnd(10)} ${String(i.status).padEnd(8)} period ${i.periodStart ?? '—'} · issued ${i.issueDate}${paid ? ` · paid ${paid}` : ''}${i.settledVia ? ` · ${i.settledVia}` : ''}${voided}`)
  }
  const emails = new Set([t?.email, ...contacts.map((m) => m.email)].filter(Boolean).map((e) => e.toLowerCase()))
  const logged = emailLog.filter((e) => e.emailType === 'onboarding' && (e.tenantId === l.tenantId || emails.has(String(e.to ?? '').toLowerCase())))
  console.log(`   onboarding emails logged by the admin app: ${logged.map((e) => `${e.sentAt} → ${e.to}`).join(', ') || 'none (the daily cron only logs sends from 17/09/2026 on)'}\n`)
}

const now = Date.now()
const late = leases.filter((l) => l.onboardedAt && l.startDate
  && now - new Date(l.onboardedAt).getTime() < 14 * 86400000
  && new Date(l.onboardedAt) - new Date(`${l.startDate}T00:00:00`) > 30 * 86400000)
console.log(`Onboarded in the last 14 days, more than 30 days after their start date: ${late.length}`)
for (const l of late) {
  const t = tenants.find((x) => x.id === l.tenantId)
  console.log(`  ${String(l.contractNumber ?? l.id).padEnd(16)} ${String(t?.businessName ?? l.tenantId).slice(0, 32).padEnd(33)} started ${l.startDate} · onboarded ${day(l.onboardedAt)}`)
}
