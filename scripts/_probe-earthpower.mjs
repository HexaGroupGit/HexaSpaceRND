// Read-only: why does Earth Power Co's Aug invoice show no payment?
// Compares the platform invoice with its Xero twin (total, tax, allocations)
// and lists every Xero payment/credit against the contact. Writes nothing.
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()
const SUPABASE_URL = get('SUPABASE_URL')
const SERVICE_KEY = get('SUPABASE_SERVICE_ROLE_KEY')

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
const sbGet = async (path) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders })
  if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`)
  return r.json()
}

const conn = (await sbGet('integrations?id=eq.xero&select=data'))[0]?.data ?? {}
async function xeroToken() {
  if (conn.expiresAt && Date.now() < conn.expiresAt - 60_000 && conn.accessToken) {
    return { token: conn.accessToken, tenantId: conn.tenantId }
  }
  const r = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${get('XERO_CLIENT_ID')}:${get('XERO_CLIENT_SECRET')}`).toString('base64'),
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

const aud = (n) => '$' + Number(n ?? 0).toFixed(2)
const d = (s) => String(s ?? '').match(/\/Date\((\d+)/)?.[1] ? new Date(Number(String(s).match(/\/Date\((\d+)/)[1])).toISOString().slice(0, 10) : String(s ?? '-')

const tenant = (await sbGet(`tenants?id=eq.tc18&select=data`))[0]?.data
console.log('\n═══ Platform tenant ═══')
console.log('  ', tenant.businessName, '| xeroContactId:', tenant.xeroContactId ?? 'NONE')

const invRows = await sbGet(`invoices?select=data`)
const mine = invRows.map((r) => r.data).filter((i) => i.tenantId === 'tc18')

const lineSub = (i) => (i.lineItems ?? []).reduce((s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0)

console.log('\n═══ Platform invoices (tc18) ═══')
for (const i of mine.sort((a, b) => String(a.issueDate).localeCompare(String(b.issueDate)))) {
  const sub = lineSub(i)
  const gstRounded = i.vatEnabled !== false ? Math.round(sub * 0.1 * 100) / 100 : 0
  const paid = (i.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0)
  console.log(`  ${String(i.number).padEnd(10)} ${i.issueDate}  ${String(i.status).padEnd(8)} sub ${aud(sub).padStart(10)}  gst ${aud(gstRounded).padStart(8)}  total ${aud(sub + gstRounded).padStart(10)}  rawTotal ${aud(sub * (i.vatEnabled !== false ? 1.1 : 1)).padStart(12)}  paid ${aud(paid).padStart(10)}  xero=${i.xeroInvoiceId ? i.xeroInvoiceId.slice(0, 8) : '-'}`)
}

// ── Xero side ───────────────────────────────────────────────────────────────
const cid = tenant.xeroContactId
if (cid) {
  const { Contacts = [] } = await xero(`/Contacts?IDs=${cid}&page=1`)
  const c = Contacts[0]
  console.log('\n═══ Xero contact ═══')
  console.log('  ', c?.Name, '| AR outstanding:', aud(c?.Balances?.AccountsReceivable?.Outstanding), '| overdue:', aud(c?.Balances?.AccountsReceivable?.Overdue))

  const { Invoices = [] } = await xero(`/Invoices?ContactIDs=${cid}&order=Date DESC`)
  console.log('\n═══ Xero ACCREC invoices ═══')
  for (const xi of Invoices.filter((x) => x.Type === 'ACCREC').slice(0, 12)) {
    console.log(`  ${String(xi.InvoiceNumber).padEnd(10)} ${d(xi.Date)}  ${String(xi.Status).padEnd(16)} sub ${aud(xi.SubTotal).padStart(10)}  tax ${aud(xi.TotalTax).padStart(8)}  total ${aud(xi.Total).padStart(10)}  paid ${aud(xi.AmountPaid).padStart(10)}  due ${aud(xi.AmountDue).padStart(10)}  credited ${aud(xi.AmountCredited)}`)
  }

  const { CreditNotes = [] } = await xero(`/CreditNotes?ContactIDs=${cid}`).catch(() => ({ CreditNotes: [] }))
  if (CreditNotes.length) {
    console.log('\n═══ Xero credit notes ═══')
    for (const cn of CreditNotes) console.log(`  ${String(cn.CreditNoteNumber).padEnd(12)} ${d(cn.Date)} ${cn.Status.padEnd(12)} total ${aud(cn.Total)} remaining ${aud(cn.RemainingCredit)}`)
  }
}

// Detail on the Aug invoice specifically (allocations only come back on a
// single-invoice GET).
for (const num of ['INV-3309']) {
  const { Invoices: [xi] = [] } = await xero(`/Invoices?InvoiceNumbers=${num}`)
  console.log(`\n═══ Xero ${num} detail ═══`)
  if (!xi) { console.log('   NOT FOUND in Xero'); continue }
  console.log('   status  :', xi.Status, '| LineAmountTypes:', xi.LineAmountTypes)
  console.log('   subtotal:', aud(xi.SubTotal), 'tax:', aud(xi.TotalTax), 'total:', aud(xi.Total), 'paid:', aud(xi.AmountPaid), 'due:', aud(xi.AmountDue))
  console.log('   lines   :', JSON.stringify((xi.LineItems ?? []).map((l) => ({ q: l.Quantity, u: l.UnitAmount, amt: l.LineAmount, tax: l.TaxAmount, taxType: l.TaxType, acct: l.AccountCode }))))
  console.log('   payments:', JSON.stringify((xi.Payments ?? []).map((p) => ({ date: d(p.Date), amount: p.Amount, id: p.PaymentID }))))
  console.log('   prepay  :', JSON.stringify(xi.Prepayments ?? []), 'overpay:', JSON.stringify(xi.Overpayments ?? []))
}
console.log('')
