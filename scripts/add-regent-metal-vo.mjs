// REGENT METAL GROUP has been a paying virtual-office member all along, but
// their only contract (CON-25, Office 9) expired in Jan 2024. Xero kept billing
// them — $82.50/mo through July 2026 — while the platform had no lease to bill
// from, so when billing moved here it simply stopped.
//
// Creates the contract that should exist: VO14, $75 + GST, and the August
// invoice that was missed. Mirrors CON-246 (Bricklane), the shape every other
// active virtual office uses — including its synthetic hx_vo_<contract> space
// id, which has no spaces row of its own.
//
// Dry-run by default; pass --apply.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TENANT = 'tc66'
const MEMBER = 'm_6386cb025bc9056d2751798c'   // Vivian HSU — matches the company email
const RESOURCE = 'VO14'
const RENT = 75
const START = '2026-08-01', END = '2027-07-31'

const [{ data: lsR }, { data: invR }, { data: tnR }, { data: memR }] = await Promise.all([
  sb.from('leases').select('id,data'), sb.from('invoices').select('id,data'),
  sb.from('tenants').select('id,data'), sb.from('members').select('id,data'),
])
const tenant = tnR.find((t) => t.id === TENANT)?.data
const member = memR.find((m) => m.id === MEMBER)?.data
if (!tenant || !member) { console.error('Tenant or member missing — aborting.'); process.exit(1) }

// Guard: don't create a second live contract or a duplicate August invoice.
const live = lsR.filter((l) => l.data.tenantId === TENANT && l.data.status === 'active')
if (live.length) { console.error(`${TENANT} already has an active lease (${live.map((l) => l.data.contractNumber).join(', ')}) — aborting.`); process.exit(1) }
const augClash = invR.find((r) => r.data.tenantId === TENANT && r.data.status !== 'voided' &&
  (r.data.periodStart ?? '') >= '2026-07-25' && (r.data.periodStart ?? '') <= '2026-08-31')
if (augClash) { console.error(`${augClash.data.number} already covers August — aborting.`); process.exit(1) }

const conNo = Math.max(...lsR.map((l) => Number(/^CON-(\d+)$/.exec(l.data.contractNumber || '')?.[1] ?? 0))) + 1
const CON = `CON-${conNo}`
const invNo = `INV-${Math.max(...invR.map((r) => Number(String(r.data.number).replace(/\D/g, '')) || 0)) + 1}`
const today = new Date().toISOString().split('T')[0]
const token = () => Array.from({ length: 24 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[Math.floor(Math.random() * 64)]).join('')

const lease = {
  id: CON, contractNumber: CON,
  tenantId: TENANT, companyName: tenant.businessName,
  memberId: MEMBER, memberName: member.name,
  membershipType: 'Virtual Office', contractType: 'License Agreement',
  documentType: 'Membership Agreement',
  level: 'Level 4', location: 'Hexa Space',
  planName: RESOURCE, resource: RESOURCE, spaceId: `hx_vo_${CON}`,
  status: 'active', startDate: START, endDate: END,
  monthlyRent: RENT, total: RENT,
  rentFreeMonths: 0, rentFreePeriods: [],
  noticePeriodMonths: 1, proratedFirstMonth: false,
  signatureStatus: 'not_signed', hasLicenseAgreement: false,
  source: 'admin', createdAt: today,
  note: 'Recreated Aug 2026: billed as a VO since before the migration, but the only contract (CON-25, Office 9) expired Jan 2024, so billing stopped.',
}

const invoice = {
  id: `inv_fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  number: invNo, source: 'auto-bill', status: 'pending',
  issueDate: '2026-08-01', dueDate: '2026-08-15', createdAt: '2026-08-01',
  periodStart: '2026-08-01', periodEnd: '2026-08-31',
  tenantId: TENANT, leaseId: CON,
  comments: [], payments: [], payToken: token(),
  reference: '', isProrated: false, sentStatus: 'not_sent',
  vatEnabled: true, discountPct: 0, paymentMethod: '', creditNoteForId: null,
  lineItems: [{ id: `li_${CON}_2026-08_m`, qty: 1, unitPrice: RENT, description: `${RESOURCE} · 1 Aug – 31 Aug 2026`, discountPct: 0, revenueAccount: 'Membership Fees' }],
  raisedBy: 'missing-august-backfill',
}

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'}\n`)
console.log(`  contract ${CON}   ${tenant.businessName}`)
console.log(`     ${RESOURCE} · Virtual Office · $${RENT} + GST = $${(RENT * 1.1).toFixed(2)}/mo`)
console.log(`     ${START} → ${END}   member ${member.name} <${member.email}>`)
console.log(`  invoice  ${invNo}   $${(RENT * 1.1).toFixed(2)}   1 Aug – 31 Aug 2026   pending / not_sent`)
console.log(`\n  (CON-25, expired Jan 2024, is left untouched as history)`)
if (!APPLY) { console.log('\nNo writes. Re-run with --apply.'); process.exit(0) }

const stamp = new Date().toISOString()
const { error: lErr } = await sb.from('leases').upsert({ id: CON, data: lease, updated_at: stamp })
if (lErr) { console.error(`Lease failed: ${lErr.message}`); process.exit(1) }
console.log(`\nCreated ${CON}.`)
const { error: iErr } = await sb.from('invoices').upsert({ id: invoice.id, data: invoice, updated_at: stamp })
if (iErr) { console.error(`Invoice failed: ${iErr.message} — the lease was created, re-run to add the invoice.`); process.exit(1) }
console.log(`Raised ${invNo} (pending, not sent).`)
