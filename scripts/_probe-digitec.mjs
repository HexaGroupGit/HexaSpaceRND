// Read-only probe: how a combined payment (office + parking paid in one go)
// looks on the platform vs in Xero. Writes nothing to either system.
//   node scripts/_probe-digitec.mjs [search-term]      (default: digitec)
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()
const SUPABASE_URL = get('SUPABASE_URL')
const SERVICE_KEY = get('SUPABASE_SERVICE_ROLE_KEY')
const XERO_ID = get('XERO_CLIENT_ID')
const XERO_SECRET = get('XERO_CLIENT_SECRET')

const TERM = (process.argv[2] ?? 'digitec').toLowerCase()

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders })
  if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`)
  return r.json()
}
async function sbGetAll(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=data&order=id.asc`, {
      headers: { ...sbHeaders, Range: `${from}-${from + 999}` },
    })
    if (!r.ok) throw new Error(`Supabase ${table}: ${r.status} ${await r.text()}`)
    const batch = await r.json()
    out.push(...batch.map((x) => x.data))
    if (batch.length < 1000) break
  }
  return out
}

async function xeroToken() {
  const rows = await sbGet('integrations?id=eq.xero&select=data')
  const conn = rows[0]?.data
  if (!conn?.refreshToken) throw new Error('Xero not connected')
  if (conn.expiresAt && Date.now() < conn.expiresAt - 60_000 && conn.accessToken) {
    return { token: conn.accessToken, tenantId: conn.tenantId }
  }
  if (!XERO_ID || !XERO_SECRET) throw new Error('token expired and XERO_CLIENT_ID/SECRET missing')
  const r = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${XERO_ID}:${XERO_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refreshToken }),
  })
  const tok = await r.json()
  if (!r.ok || !tok.access_token) throw new Error(`Xero refresh failed: ${JSON.stringify(tok)}`)
  const next = { ...conn, accessToken: tok.access_token, refreshToken: tok.refresh_token ?? conn.refreshToken, expiresAt: Date.now() + (tok.expires_in ?? 1800) * 1000 }
  await fetch(`${SUPABASE_URL}/rest/v1/integrations?id=eq.xero`, {
    method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ data: next, updated_at: new Date().toISOString() }),
  })
  return { token: next.accessToken, tenantId: next.tenantId }
}

const { token, tenantId } = await xeroToken()
const xero = async (path) => {
  const r = await fetch(`https://api.xero.com/api.xro/2.0${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Xero-Tenant-Id': tenantId, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`Xero ${path}: ${r.status} ${await r.text()}`)
  return r.json()
}

const aud = (n) => '$' + Number(n ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })
const invoiceTotal = (inv) => (inv.lineItems ?? []).reduce(
  (s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0)
const gross = (i) => Math.round(invoiceTotal(i) * (i.vatEnabled !== false ? 1.1 : 1) * 100) / 100

const [tenants, invoices] = await Promise.all([sbGetAll('tenants'), sbGetAll('invoices')])

const matchTenants = tenants.filter((t) => `${t.businessName ?? ''} ${t.contactName ?? ''}`.toLowerCase().includes(TERM))
console.log(`\n═══ PLATFORM — tenants matching "${TERM}": ${matchTenants.length} ═══`)
for (const t of matchTenants) {
  console.log(`\n${t.businessName}  (id ${t.id})  combineInvoices=${t.combineInvoices ?? false}`)
  const mine = invoices.filter((i) => i.tenantId === t.id)
    .sort((a, b) => String(a.issueDate ?? '').localeCompare(String(b.issueDate ?? '')))
  for (const i of mine) {
    const pays = (i.payments ?? []).map((p) => `${aud(p.amount)} ${p.method ?? '?'} ${p.date ?? ''}`).join(' | ')
    console.log(`  ${String(i.number).padEnd(10)} ${String(i.status).padEnd(8)} ${aud(gross(i)).padStart(12)}  issued ${i.issueDate ?? '-'}  period ${i.periodStart ?? '-'}`)
    console.log(`      xeroInvoiceId=${i.xeroInvoiceId ?? 'NONE'}  xeroSync=${i.xeroSync ?? false}  leaseId=${i.leaseId ?? '-'}`)
    if (pays) console.log(`      payments: ${pays}`)
    const desc = (i.lineItems ?? []).map((li) => li.description).filter(Boolean).join(' / ')
    if (desc) console.log(`      lines: ${desc.slice(0, 120)}`)
  }
}

console.log(`\n═══ XERO — contacts matching "${TERM}" ═══`)
const { Contacts = [] } = await xero(`/Contacts?searchTerm=${encodeURIComponent(TERM)}&page=1`)
for (const c of Contacts) {
  console.log(`\n${c.Name}  (ContactID ${c.ContactID})`)
  console.log(`  AR outstanding: ${aud(c.Balances?.AccountsReceivable?.Outstanding)}  overdue: ${aud(c.Balances?.AccountsReceivable?.Overdue)}`)
  const { Invoices = [] } = await xero(`/Invoices?ContactIDs=${c.ContactID}&page=1`)
  const xDate = (d) => new Date(Number(String(d ?? '').match(/\d+/)?.[0] ?? 0)).toISOString().slice(0, 10)
  // Only what matters here: anything still owing, plus everything from Jun 2026 on.
  const interesting = Invoices
    .filter((xi) => Number(xi.AmountDue) > 0.005 || xDate(xi.Date) >= '2026-06-01')
    .sort((a, b) => String(xDate(a.Date)).localeCompare(String(xDate(b.Date))))
  console.log(`  (${Invoices.length} invoices total; showing ${interesting.length} open or since Jun 2026)`)
  for (const xi of interesting) {
    console.log(`  ${String(xi.InvoiceNumber).padEnd(12)} ${String(xi.Status).padEnd(10)} ${xDate(xi.Date)}  total ${aud(xi.Total).padStart(11)}  paid ${aud(xi.AmountPaid).padStart(11)}  due ${aud(xi.AmountDue).padStart(11)}`)
    console.log(`      InvoiceID=${xi.InvoiceID}  ref="${xi.Reference ?? ''}"`)
    const d = (await xero(`/Invoices/${xi.InvoiceID}`)).Invoices?.[0] ?? {}
    for (const p of d.Payments ?? []) console.log(`      payment ${aud(p.Amount)} on ${xDate(p.Date)} (PaymentID ${p.PaymentID})`)
    for (const cn of d.CreditNotes ?? []) console.log(`      credit  ${aud(cn.AppliedAmount)} from ${cn.CreditNoteNumber}`)
    for (const o of d.Overpayments ?? []) console.log(`      overpay ${aud(o.AppliedAmount)} from overpayment ${o.OverpaymentID}`)
    for (const o of d.Prepayments ?? []) console.log(`      prepay  ${aud(o.AppliedAmount)} from prepayment ${o.PrepaymentID}`)
    for (const li of d.LineItems ?? []) console.log(`      line: ${String(li.Description ?? '').slice(0, 90)}  ${aud(li.LineAmount)}`)
  }
}
console.log('')
