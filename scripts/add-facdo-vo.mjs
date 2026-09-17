// FACDO moved out of their desk in May 2026 but had paid through June on
// INV-2729 ($1,485 incl. GST). That June month is converted into a Virtual
// Office: $1,485 = 9 × $165, so 1 Jul 2026 – 31 Mar 2027, billed at $0.
//
// Mirrors the app's own exit-enrol VO (useStore.js, "3-month exit Virtual
// Office"): a real suite, no signatureStatus or deposit (no access gate, so no
// onboarding emails), autoRenew:false (the nightly reconcile expires it on
// 1 Apr 2027 and offboards it) and paidInFull/paidUntil (the bill runs skip it).
// List price $150 with 100% off, so the contract shows what the $0 is worth.
//
// Also brings the company's members back (status, portal access, and the login
// ban set when they moved out) and notes the conversion on INV-2729.
// Door access is NOT handled here — add them in Salto KS by hand.
//
//   node scripts/add-facdo-vo.mjs                      # dry run
//   node scripts/add-facdo-vo.mjs --apply
//   node scripts/add-facdo-vo.mjs --tenant <id>        # if the name matches more than one company
//   node scripts/add-facdo-vo.mjs --members <id,id>    # only these members (default: all of the company's)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { allocateVirtualSuite } from '../src/lib/virtualSuites.js'

const APPLY = process.argv.includes('--apply')
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null }

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const g = async (t) => {
  const { data, error } = await sb.from(t).select('id,data')
  if (error) throw new Error(`${t}: ${error.message}`)
  return (data ?? []).map((r) => ({ ...r.data, id: r.id }))
}

const NAME = /facdo/i
const INVOICE_DIGITS = '2729'
const START = '2026-07-01', END = '2027-03-31'
const LIST_PRICE = 150
const SOURCE = 'june-credit-vo'
const NOTE = 'June 2026 payment on INV-2729 ($1,485 incl. GST) converted to Virtual Office credit: 9 months × $165 = $1,485. ' +
  'Billed at $0 from 1 Jul 2026 to 31 Mar 2027. Not renewing, so it expires automatically on 1 Apr 2027.'
const COMMENT = 'June 2026 ($1,485 incl. GST) converted to 9 months of Virtual Office credit (1 Jul 2026 – 31 Mar 2027, billed at $0). See the Virtual Office contract.'

const [tenants, members, leases, spaces, invoices] = await Promise.all(
  ['tenants', 'members', 'leases', 'spaces', 'invoices'].map(g))

// ── Company ──────────────────────────────────────────────────────────────────
const forced = arg('--tenant')
const matches = forced
  ? tenants.filter((t) => t.id === forced)
  : tenants.filter((t) => NAME.test(`${t.businessName ?? ''} ${t.tradingName ?? ''} ${t.contactName ?? ''}`))
if (matches.length !== 1) {
  console.error(matches.length ? 'More than one company matches — re-run with --tenant <id>:' : 'No company matches — aborting.')
  for (const t of matches) console.error(`  ${t.id}  ${t.businessName}  <${t.email ?? ''}>  ${t.status ?? ''}`)
  process.exit(1)
}
const tenant = matches[0]
const today = new Date().toISOString().split('T')[0]

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'}\n`)
console.log(`Company   ${tenant.businessName}  (${tenant.id})  <${tenant.email ?? ''}>  status: ${tenant.status ?? '—'}`)

const coLeases = leases.filter((l) => l.tenantId === tenant.id)
console.log(`\nContracts`)
for (const l of coLeases) {
  console.log(`  ${l.contractNumber ?? l.id}  ${l.status}  ${l.membershipType ?? l.documentType ?? ''}  ${l.resource ?? l.spaceId ?? ''}  ` +
    `${l.startDate} → ${l.endDate}  $${l.monthlyRent ?? 0}/mo` +
    `${l.offboardedAt ? `  offboarded ${String(l.offboardedAt).slice(0, 10)}` : ''}${l.needsOffboard ? '  NEEDS OFFBOARD' : ''}`)
}

// Guards: never a second live contract, never this contract twice.
const live = coLeases.filter((l) => ['active', 'pending'].includes(l.status) && !l.offboardedAt)
if (live.length) { console.error(`\nAlready has a live contract (${live.map((l) => l.contractNumber ?? l.id).join(', ')}) — aborting.`); process.exit(1) }
if (coLeases.some((l) => l.source === SOURCE)) { console.error('\nThe June-credit Virtual Office already exists — aborting.'); process.exit(1) }

// ── INV-2729 ─────────────────────────────────────────────────────────────────
const invMatches = invoices.filter((i) => String(i.number ?? '').replace(/\D/g, '') === INVOICE_DIGITS)
const inv = invMatches.find((i) => i.tenantId === tenant.id) ?? null
console.log(`\nInvoice`)
if (!inv) {
  console.log(`  No invoice ${INVOICE_DIGITS} on this company${invMatches.length ? ` (found on: ${invMatches.map((i) => tenants.find((t) => t.id === i.tenantId)?.businessName ?? i.tenantId).join(', ')})` : ''} — no comment will be added.`)
} else {
  const net = (inv.lineItems ?? []).reduce((s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0)
  console.log(`  ${inv.number}  ${inv.status}  ${inv.periodStart ?? ''} → ${inv.periodEnd ?? ''}  $${net.toFixed(2)} + GST = $${(net * (inv.vatEnabled === false ? 1 : 1.1)).toFixed(2)}`)
  for (const li of inv.lineItems ?? []) console.log(`     · ${li.description}  ${li.qty ?? 1} × $${li.unitPrice}`)
  if ((inv.comments ?? []).some((c) => /virtual office credit/i.test(c.text ?? ''))) console.log('  (comment already there — will not add another)')
}

// ── Members ──────────────────────────────────────────────────────────────────
const only = arg('--members')?.split(',').map((s) => s.trim()).filter(Boolean)
const coMembers = members.filter((m) => m.companyId === tenant.id)
const targets = only ? coMembers.filter((m) => only.includes(m.id)) : coMembers
if (only && targets.length !== only.length) { console.error('\nSome --members ids are not members of this company — aborting.'); process.exit(1) }

// Auth users for those members (the move-out banned their logins).
const authByEmail = new Map()
for (let page = 1; page <= 20; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw new Error(`auth users: ${error.message}`)
  for (const u of data?.users ?? []) if (u.email) authByEmail.set(u.email.toLowerCase(), u)
  if ((data?.users ?? []).length < 200) break
}
const isBanned = (u) => !!u?.banned_until && new Date(u.banned_until) > new Date()

const memberPlans = targets.map((m) => {
  const patch = {}
  if (['Former', 'Inactive'].includes(m.status)) patch.status = 'Auto'
  if (!m.portalAccess) patch.portalAccess = true
  const auth = m.email ? authByEmail.get(m.email.toLowerCase()) : null
  return { m, patch, auth, unban: isBanned(auth) }
})

console.log(`\nMembers${only ? ' (selected)' : ''}`)
for (const m of coMembers) {
  const plan = memberPlans.find((p) => p.m.id === m.id)
  const auth = m.email ? authByEmail.get(m.email.toLowerCase()) : null
  const changes = plan ? [
    plan.patch.status ? `status ${m.status} → Auto` : null,
    plan.patch.portalAccess ? 'portal access → on' : null,
    plan.unban ? 'lift login ban' : null,
  ].filter(Boolean) : ['(not selected)']
  console.log(`  ${m.id}  ${m.name}  <${m.email ?? ''}>  status: ${m.status ?? '—'}  portal: ${m.portalAccess ? 'on' : 'off'}  ` +
    `login: ${auth ? (isBanned(auth) ? 'BANNED' : 'ok') : 'none'}${changes.length ? `  ⇒ ${changes.join(', ')}` : '  ⇒ no change'}`)
}
if (!coMembers.length) console.log('  (none linked to this company)')

// ── The contract ─────────────────────────────────────────────────────────────
// Primary member: the one on their last contract, else the first linked member.
const lastLease = [...coLeases].sort((a, b) => String(b.endDate ?? '').localeCompare(String(a.endDate ?? '')))[0]
const primary = coMembers.find((m) => m.id === lastLease?.memberId) ?? coMembers[0] ?? null

// Same numbering as the contract form (clean sequential numbers only).
const nums = leases.map((l) => parseInt(String(l.contractNumber ?? '').match(/^[A-Za-z]*-?(\d+)$/)?.[1], 10))
  .filter((n) => !isNaN(n) && n > 0 && n < 100000)
const contractNumber = `CON-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`

const alloc = allocateVirtualSuite({ spaces, leases, rate: LIST_PRICE, tenantId: tenant.id })
const voSpace = {
  ...alloc.space, type: 'virtual', floor: 'l4', source: SOURCE,
  status: 'occupied', address: '830 Whitehorse Rd, Box Hill', location: 'whitehorse',
  rate: LIST_PRICE, monthlyRate: LIST_PRICE,
  membershipType: 'Virtual Office', assignedCompanyId: tenant.id, occupantTenantId: tenant.id,
}

const leaseId = `l${Date.now()}`
const lease = {
  id: leaseId, contractNumber,
  tenantId: tenant.id, companyName: tenant.businessName,
  memberId: primary?.id ?? null, memberName: primary?.name ?? '',
  spaceId: voSpace.id, resource: voSpace.unitNumber,
  membershipType: 'Virtual Office', documentType: 'Virtual Office Membership Agreement',
  contractType: 'New', source: SOURCE,
  level: 'Level 4', location: 'Hexa Space',
  startDate: START, endDate: END,
  monthlyRent: 0, listPrice: LIST_PRICE, discount: '100%', bondAmount: 0,
  status: 'active', autoRenew: false, paidInFull: true, paidUntil: END,
  requireCardOnFile: false, noticePeriodMonths: 1,
  notes: NOTE, createdAt: today,
}

console.log(`\nWill create`)
console.log(`  contract ${contractNumber}  Virtual Office · ${voSpace.unitNumber}${alloc.created ? ' (new suite record)' : ''}`)
console.log(`     ${START} → ${END}   $0/mo (list $${LIST_PRICE}, 100% off)   member: ${primary ? `${primary.name} <${primary.email ?? ''}>` : '—'}`)
console.log(`     not renewing · prepaid to ${END} · no deposit · no card required · no invoices, no emails`)
if (inv && !(inv.comments ?? []).some((c) => /virtual office credit/i.test(c.text ?? ''))) console.log(`  comment on ${inv.number}`)
console.log(`\n  Not done here: door access in Salto KS.`)
if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

// ── Writes ───────────────────────────────────────────────────────────────────
const stamp = () => new Date().toISOString()
const save = async (table, id, data) => {
  const { error } = await sb.from(table).upsert({ id, data, updated_at: stamp() })
  if (error) throw new Error(`${table}/${id}: ${error.message}`)
}
const audit = async (action, entityType, entityId, entityName, details) => {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  await sb.from('audit_log').insert({ id, data: { id, action, entityType, entityId, entityName, details, userEmail: 'script:add-facdo-vo', timestamp: stamp() } })
}

await save('spaces', voSpace.id, voSpace)
console.log(`\n${alloc.created ? 'Created' : 'Assigned'} ${voSpace.unitNumber}.`)
await save('leases', leaseId, lease)
await audit('create', 'lease', leaseId, contractNumber, `Virtual Office ${START} – ${END} at $0 — June 2026 (INV-2729) converted to credit`)
console.log(`Created ${contractNumber}.`)

for (const { m, patch, auth, unban } of memberPlans) {
  if (Object.keys(patch).length) {
    await save('members', m.id, { ...m, ...patch })
    await audit('update', 'member', m.id, m.name, `Reactivated for ${contractNumber}: ${Object.keys(patch).join(', ')}`)
  }
  if (unban) {
    const { error } = await sb.auth.admin.updateUserById(auth.id, { ban_duration: 'none' })
    if (error) console.error(`  Could not lift the login ban for ${m.email}: ${error.message}`)
  }
  if (Object.keys(patch).length || unban) console.log(`Updated ${m.name}.`)
}

if (inv && !(inv.comments ?? []).some((c) => /virtual office credit/i.test(c.text ?? ''))) {
  await save('invoices', inv.id, { ...inv, comments: [...(inv.comments ?? []), { id: `cmt${Date.now()}`, text: COMMENT, createdAt: today }] })
  console.log(`Noted on ${inv.number}.`)
}
console.log('\nDone. Remaining: door access in Salto KS.')
