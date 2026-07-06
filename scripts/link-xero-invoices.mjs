// One-off migration linker: stamps xeroInvoiceId on platform July-2026
// invoices by matching them to the OfficeRND-created invoices in Xero, so
// "Pull payments from Xero" can mark them paid. Invoices pushed by the
// platform (from Sept) self-link — this is only needed for migrated months.
//
//   node scripts/link-xero-invoices.mjs [YYYY-MM]            → dry run
//   node scripts/link-xero-invoices.mjs [YYYY-MM] --apply    → write links
//
// Matching: per company (normalised name), first 1:1 on ex-GST amount
// (±$0.05), then group-sum (several platform invoices = one combined Xero
// invoice → all get that Xero id). Unmatched are reported, never guessed.
import { readFileSync, writeFileSync } from 'fs'

const APPLY = process.argv.includes('--apply')
const month = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a)) ?? '2026-07'
const [y, m] = month.split('-').map(Number)
const nextY = m === 12 ? y + 1 : y
const nextM = m === 12 ? 1 : m + 1

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const url = env.match(/^SUPABASE_URL=(.+)$/m)[1].trim()
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim()
const XID = env.match(/^XERO_CLIENT_ID=(.+)$/m)?.[1]?.trim()
const XSEC = env.match(/^XERO_CLIENT_SECRET=(.+)$/m)?.[1]?.trim()
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }

async function getAll(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/${table}?select=data&order=id.asc`, { headers: { ...h, Range: `${from}-${from + 999}` } })
    const batch = await r.json()
    out.push(...batch.map((x) => x.data))
    if (batch.length < 1000) break
  }
  return out
}

async function xeroToken() {
  const conn = (await fetch(`${url}/rest/v1/integrations?id=eq.xero&select=data`, { headers: h }).then((r) => r.json()))[0]?.data
  if (!conn?.refreshToken) throw new Error('Xero not connected.')
  if (conn.expiresAt && Date.now() < conn.expiresAt - 60_000 && conn.accessToken) return { token: conn.accessToken, tenantId: conn.tenantId }
  const r = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${XID}:${XSEC}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refreshToken }),
  })
  const tok = await r.json()
  if (!tok.access_token) throw new Error('Xero refresh failed: ' + JSON.stringify(tok))
  const next = { ...conn, accessToken: tok.access_token, refreshToken: tok.refresh_token ?? conn.refreshToken, expiresAt: Date.now() + (tok.expires_in ?? 1800) * 1000 }
  await fetch(`${url}/rest/v1/integrations?id=eq.xero`, { method: 'PATCH', headers: h, body: JSON.stringify({ data: next, updated_at: new Date().toISOString() }) })
  return { token: next.accessToken, tenantId: next.tenantId }
}

async function fetchXeroInvoices() {
  const { token, tenantId } = await xeroToken()
  const where = encodeURIComponent(`Type=="ACCREC" AND Date >= DateTime(${y},${m},1) AND Date < DateTime(${nextY},${nextM},1)`)
  const all = []
  for (let page = 1; page <= 20; page++) {
    const r = await fetch(`https://api.xero.com/api.xro/2.0/Invoices?where=${where}&Statuses=DRAFT,SUBMITTED,AUTHORISED,PAID&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, 'Xero-Tenant-Id': tenantId, Accept: 'application/json' },
    })
    const batch = (await r.json()).Invoices ?? []
    all.push(...batch)
    if (batch.length < 100) break
  }
  return all
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/p\/l/g, '').replace(/\b(pty|ltd|limited)\b/g, '').replace(/[^a-z0-9]/g, '')
const exGst = (inv) => Math.round((inv.lineItems ?? []).reduce((s, li) =>
  s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0) * 100) / 100

const [invoices, tenants, xeroInvs] = await Promise.all([getAll('invoices'), getAll('tenants'), fetchXeroInvoices()])

const platform = invoices.filter((i) => i.status !== 'voided' && !i.xeroInvoiceId &&
  ((i.periodStart ?? i.issueDate ?? '') + '').startsWith(month))

// group both sides by normalised company
const platByCo = {}
for (const inv of platform) {
  const t = tenants.find((x) => x.id === inv.tenantId)
  ;(platByCo[norm(t?.businessName)] ??= []).push(inv)
}
// Known Xero-name aliases (Xero contact → platform company)
const ALIAS = { hexapacifichp: 'hexapacific' }
const xeroByCo = {}
for (const xi of xeroInvs) {
  const co = norm(xi.Contact?.Name)
  ;(xeroByCo[ALIAS[co] ?? co] ??= []).push(xi)
}

const links = [], unmatched = []
for (const [co, pInvs] of Object.entries(platByCo)) {
  const xInvs = [...(xeroByCo[co] ?? [])]
  const pLeft = [...pInvs]

  // pass 1: exact 1:1 amount matches
  for (const p of [...pLeft]) {
    const idx = xInvs.findIndex((x) => Math.abs(Number(x.SubTotal) - exGst(p)) <= 0.05)
    if (idx >= 0) {
      links.push({ p, xi: xInvs[idx] })
      xInvs.splice(idx, 1)
      pLeft.splice(pLeft.indexOf(p), 1)
    }
  }
  // pass 2: remaining platform invoices sum to one combined Xero invoice
  if (pLeft.length > 1 && xInvs.length >= 1) {
    const sum = Math.round(pLeft.reduce((s, p) => s + exGst(p), 0) * 100) / 100
    const idx = xInvs.findIndex((x) => Math.abs(Number(x.SubTotal) - sum) <= 0.05)
    if (idx >= 0) {
      for (const p of pLeft) links.push({ p, xi: xInvs[idx], grouped: true })
      pLeft.length = 0
    }
  }
  for (const p of pLeft) unmatched.push({ co, number: p.number, amount: exGst(p) })
}

console.log(`Platform ${month} invoices needing links: ${platform.length} | Xero invoices: ${xeroInvs.length}`)
console.log(`Matched: ${links.length} (${links.filter((l) => l.grouped).length} via combined-invoice groups)\n`)
for (const { p, xi, grouped } of links) {
  console.log(`${APPLY ? 'LINK ' : 'would'} ${p.number} $${exGst(p).toFixed(2)} -> Xero ${xi.InvoiceNumber} (${xi.Status})${grouped ? ' [group]' : ''}`)
}
if (unmatched.length) {
  console.log(`\nUNMATCHED (${unmatched.length}) — left untouched:`)
  unmatched.forEach((u) => console.log(`  ${u.number} $${u.amount.toFixed(2)} (${u.co})`))
}

if (APPLY) {
  const backup = links.map(({ p }) => ({ id: p.id, number: p.number }))
  for (const { p, xi } of links) {
    p.xeroInvoiceId = xi.InvoiceID
    p.xeroSync = true
    p.xeroSyncedAt = new Date().toISOString()
    await fetch(`${url}/rest/v1/invoices`, { method: 'POST', headers: h, body: JSON.stringify({ id: p.id, data: p, updated_at: new Date().toISOString() }) })
  }
  writeFileSync('C:/Users/EricKuang/Downloads/invocies/AUDIT-xero-link-backup.json', JSON.stringify(backup, null, 2))
  console.log(`\n${links.length} invoices linked. Backup list: AUDIT-xero-link-backup.json`)
} else {
  console.log('\nDRY RUN — nothing written. Re-run with --apply.')
}
