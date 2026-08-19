// Read-only: is the Xero pull running, and which platform-voided invoices are
// still live (owing) in Xero? A stale AUTHORISED twin inflates the contact's
// Xero AR above the portal's open total, which permanently trips the
// `contactOwesMore` bail-out in api/xero/sync.js and disables balance settling
// for that contact. Writes nothing to Xero or Supabase.
import { readFileSync } from 'fs'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()
const SUPABASE_URL = get('SUPABASE_URL')
const SERVICE_KEY = get('SUPABASE_SERVICE_ROLE_KEY')
const XERO_ID = get('XERO_CLIENT_ID')
const XERO_SECRET = get('XERO_CLIENT_SECRET')

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

const rows = await sbGet('integrations?id=eq.xero&select=data')
const conn = rows[0]?.data ?? {}
console.log('\n═══ Xero connection state ═══')
console.log('  tenantId      :', conn.tenantId ?? '-')
console.log('  lastPull      :', conn.lastPull ?? 'NEVER')
console.log('  lastPush      :', conn.lastPush ?? 'NEVER')
console.log('  lastPullError :', conn.lastPullError ?? '-')
console.log('  lastPushError :', conn.lastPushError ?? '-')
console.log('  owesMore alert:', String(conn.lastOwesMoreAlert ?? '-').slice(0, 400))

const settings = (await sbGet('settings?id=eq.global&select=data'))[0]?.data ?? {}
console.log('  syncEnabled   :', settings.xero?.syncEnabled)
console.log('  pullEnabled   :', settings.xero?.pullEnabled)
console.log('  syncFrom      :', settings.xero?.syncFrom)

async function xeroToken() {
  if (conn.expiresAt && Date.now() < conn.expiresAt - 60_000 && conn.accessToken) {
    return { token: conn.accessToken, tenantId: conn.tenantId }
  }
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
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`https://api.xero.com/api.xro/2.0${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'Xero-Tenant-Id': tenantId, Accept: 'application/json' },
    })
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 1000 * (Number(r.headers.get('retry-after')) || 20))); continue }
    if (!r.ok) throw new Error(`Xero ${path}: ${r.status} ${await r.text()}`)
    return r.json()
  }
  throw new Error(`Xero ${path}: rate limited after retries`)
}

const aud = (n) => '$' + Number(n ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

const [tenants, invoices] = await Promise.all([sbGetAll('tenants'), sbGetAll('invoices')])

// ── A. platform-voided invoices that are still owing in Xero ────────────────
const voided = invoices.filter((i) => i.status === 'voided' && i.number && (i.issueDate ?? '') >= '2026-01-01')
console.log(`\n═══ A. Platform-VOIDED invoices since Jan 2026: ${voided.length} — checking Xero ═══`)
const zombies = []
for (const batch of chunk(voided, 40)) {
  const nums = batch.map((i) => encodeURIComponent(i.number)).join(',')
  const { Invoices = [] } = await xero(`/Invoices?InvoiceNumbers=${nums}`)
  for (const xi of Invoices) {
    if (xi.Type !== 'ACCREC') continue
    if (['VOIDED', 'DELETED', 'PAID'].includes(xi.Status)) continue
    if (Number(xi.AmountDue) <= 0.005) continue
    const inv = batch.find((i) => String(i.number).trim() === String(xi.InvoiceNumber).trim())
    const t = tenants.find((x) => x.id === inv?.tenantId)
    zombies.push({ number: xi.InvoiceNumber, tenant: t?.businessName ?? '?', status: xi.Status, due: Number(xi.AmountDue), linked: !!inv?.xeroInvoiceId })
  }
}
zombies.sort((a, b) => b.due - a.due)
for (const z of zombies) console.log(`   ${String(z.number).padEnd(10)} ${String(z.tenant).slice(0, 34).padEnd(35)} ${z.status.padEnd(11)} owing ${aud(z.due).padStart(11)}  platformLink=${z.linked}`)
console.log(`   TOTAL phantom AR still open in Xero: ${aud(zombies.reduce((s, z) => s + z.due, 0))} across ${zombies.length} invoice(s), ${new Set(zombies.map((z) => z.tenant)).size} contact(s)`)

// ── B. contacts where Xero AR > portal open (balance sync disabled) ─────────
const openInv = invoices.filter((i) => ['pending', 'overdue'].includes(i.status) && i.xeroInvoiceId)
const invoiceTotal = (inv) => (inv.lineItems ?? []).reduce((s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0)
const gross = (i) => Math.round(invoiceTotal(i) * (i.vatEnabled !== false ? 1.1 : 1) * 100) / 100

const byTenant = new Map()
for (const i of openInv) {
  if (!byTenant.has(i.tenantId)) byTenant.set(i.tenantId, [])
  byTenant.get(i.tenantId).push(i)
}
const contactIds = [...byTenant.keys()].map((tid) => tenants.find((t) => t.id === tid)).filter((t) => t?.xeroContactId)
console.log(`\n═══ B. Contacts where Xero AR EXCEEDS portal open (balance sync bails out) ═══`)
const owesMore = []
for (const batch of chunk(contactIds, 40)) {
  const { Contacts = [] } = await xero(`/Contacts?IDs=${batch.map((t) => t.xeroContactId).join(',')}&page=1`)
  for (const c of Contacts) {
    const t = batch.find((x) => x.xeroContactId === c.ContactID)
    const xeroOut = Number(c.Balances?.AccountsReceivable?.Outstanding)
    if (!Number.isFinite(xeroOut)) continue
    const portalOut = Math.round((byTenant.get(t.id) ?? []).reduce((s, i) => s + gross(i), 0) * 100) / 100
    if (xeroOut > portalOut + 0.05) owesMore.push({ name: c.Name, xeroOut, portalOut, gap: xeroOut - portalOut })
  }
}
owesMore.sort((a, b) => b.gap - a.gap)
for (const o of owesMore) console.log(`   ${String(o.name).slice(0, 38).padEnd(39)} Xero ${aud(o.xeroOut).padStart(12)}  portal ${aud(o.portalOut).padStart(12)}  gap ${aud(o.gap).padStart(12)}`)
console.log(`   ${owesMore.length} of ${contactIds.length} contacts with open invoices are in this state.`)
console.log('')
