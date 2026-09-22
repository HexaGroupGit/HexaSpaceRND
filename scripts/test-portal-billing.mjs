// Offline regression checks. Authentication, Stripe and the database are mocked;
// these tests cannot create a real customer, checkout session or card charge.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { registerHooks } from 'node:module'

process.env.STRIPE_SECRET_KEY = 'sk_test_offline_fixture'
registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith('/api/_auth.js')) return { format: 'module', shortCircuit: true, source: `
    export async function requireMember() { return globalThis.__billingTest.auth }
    export async function isAdminEmail() { return globalThis.__billingTest.admin }
  ` }
  if (url.endsWith('/api/_stripe.js')) return { format: 'module', shortCircuit: true, source: `
    export function stripeConfigured() { return true }
    export async function ensureStripeCustomer(sb, tenant) { globalThis.__billingTest.customerTenant = tenant.id; return 'cus_' + tenant.id }
    export async function stripeFetch(path, params) { globalThis.__billingTest.setupCalls.push(params); return { ok: true, json: { url: 'https://checkout.stripe.test/setup' } } }
    export async function chargeInvoiceOffSession(sb, invoice, tenant) { globalThis.__billingTest.chargeCalls.push({ invoice, tenant }); return { ok: true, amount: 100, invoice: { ...invoice, status: 'paid' } } }
  ` }
  return nextLoad(url, context)
} })
const { canManageCompanyBilling } = await import('../api/_billingAuth.js')
const { default: setup } = await import('../api/stripe/setup.js')
const { default: checkout } = await import('../api/stripe/checkout.js')
const { default: charge } = await import('../api/stripe/charge.js')

const email = 'billing@example.test'
const row = (id, data) => ({ id, data: { id, ...data } })
let state
function database(tables) {
  return { from(table) {
    const filters = []
    let one = false
    const query = {
      select() { return query },
      eq(key, value) { filters.push(record => (key.startsWith('data->>') ? record.data[key.slice(7)] : record[key]) === value); return query },
      ilike(key, value) {
        const pattern = new RegExp('^' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('%', '.*').replaceAll('_', '.') + '$', 'i')
        filters.push(record => pattern.test(String(key.startsWith('data->>') ? record.data[key.slice(7)] : record[key])))
        return query
      },
      limit() { return query },
      single() { one = true; return query },
      maybeSingle() { one = true; return query },
      async upsert(record) {
        const list = tables[table] ||= []
        const index = list.findIndex(item => item.id === record.id)
        if (index >= 0) list[index] = record; else list.push(record)
        return { error: null }
      },
      then(resolve, reject) {
        const matches = (tables[table] || []).filter(record => filters.every(filter => filter(record)))
        return Promise.resolve({ data: one ? matches[0] || null : matches, error: state.errors[table] || null }).then(resolve, reject)
      },
    }
    return query
  } }
}

beforeEach(() => {
  const tables = {
    members: [
      row('m-first', { companyId: 'first', email, status: 'Active', portalAccess: true, billingPerson: true }),
      row('m-beda', { companyId: 'beda', email, status: 'Active', portalAccess: true, billingPerson: true }),
    ],
    tenants: [row('first', { email }), row('beda', { email }), row('foreign', { email: 'elsewhere@example.test' })],
    leases: [row('lease-beda', { tenantId: 'beda', status: 'active' })],
    settings: [row('global', { stripe: { paymentsEnabled: true } })],
    invoices: [row('inv-beda', { tenantId: 'beda', status: 'pending', number: 'INV-TEST', vatEnabled: true, lineItems: [{ qty: 1, unitPrice: 100 }] }), row('inv-foreign', { tenantId: 'foreign', status: 'pending', lineItems: [{ qty: 1, unitPrice: 100 }] })],
  }
  state = { tables, errors: {}, admin: false, setupCalls: [], checkoutCalls: [], chargeCalls: [] }
  state.sb = database(tables)
  state.auth = { sb: state.sb, user: { id: 'user', email }, companyId: 'first' }
  globalThis.__billingTest = state
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.stripe.com/v1/checkout/sessions', 'Unexpected network request blocked')
    state.checkoutCalls.push(Object.fromEntries(options.body))
    return new Response(JSON.stringify({ url: 'https://checkout.stripe.test/invoice' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
})

async function call(handler, body = {}) {
  const response = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this }, end() {} }
  await handler({ method: 'POST', headers: { host: 'portal.hexaspace.com.au', authorization: 'Bearer offline' }, body }, response)
  return response
}

test('multi-company card setup uses the selected company and reaches Stripe without ReferenceError', async () => {
  const response = await call(setup, { tenantId: 'beda', returnTo: '/billing' })
  assert.equal(response.statusCode, 200)
  assert.equal(state.customerTenant, 'beda')
  assert.equal(state.setupCalls[0].metadata.tenantId, 'beda')
  assert.equal(state.setupCalls[0].customer, 'cus_beda')
})

test('multi-company invoice checkout authorises the invoice company', async () => {
  const response = await call(checkout, { invoiceId: 'inv-beda' })
  assert.equal(response.statusCode, 200)
  assert.equal(state.checkoutCalls[0]['metadata[invoiceId]'], 'inv-beda')
  assert.equal(state.checkoutCalls[0]['line_items[0][price_data][unit_amount]'], '11000')
})

test('saved-card payment also uses the invoice company', async () => {
  assert.equal((await call(charge, { invoiceId: 'inv-beda' })).statusCode, 200)
  assert.equal(state.chargeCalls[0].tenant.id, 'beda')
})

test('billing authority at another company cannot manage the selected company', async () => {
  state.tables.members[1].data.billingPerson = false
  for (const handler of [setup, checkout, charge]) {
    const response = await call(handler, { tenantId: 'beda', invoiceId: 'inv-beda' })
    assert.equal(response.statusCode, 403)
  }
  assert.equal(state.setupCalls.length + state.checkoutCalls.length + state.chargeCalls.length, 0)
})

test('an unrelated company cannot be targeted, even if it has no active lease', async () => {
  for (const handler of [setup, checkout, charge]) {
    assert.equal((await call(handler, { tenantId: 'foreign', invoiceId: 'inv-foreign' })).statusCode, 403)
  }
  assert.equal(state.setupCalls.length + state.checkoutCalls.length + state.chargeCalls.length, 0)
})

test('company-owner login works for its own selected company without a member row', async () => {
  state.tables.members = state.tables.members.slice(0, 1)
  assert.equal(await canManageCompanyBilling(state.sb, email, 'beda'), true)
  assert.equal(await canManageCompanyBilling(state.sb, email, 'foreign'), false)
})

test('a restored live member wins over an old disabled duplicate', async () => {
  state.tables.members.unshift(row('m-old', { companyId: 'beda', email, billingPerson: true, portalAccess: false, status: 'Former' }))
  assert.equal((await call(checkout, { invoiceId: 'inv-beda' })).statusCode, 200)
  state.tables.members.find(item => item.id === 'm-beda').data.portalAccess = false
  assert.equal((await call(checkout, { invoiceId: 'inv-beda' })).statusCode, 403)
})

test('drop-in card setup remains available only for the caller’s own company', async () => {
  state.tables.leases = []
  state.tables.members[1].data.billingPerson = false
  assert.equal((await call(setup, { tenantId: 'beda' })).statusCode, 200)
  assert.equal((await call(setup, { tenantId: 'foreign' })).statusCode, 403)
})

test('a member without a company can set up their own new drop-in account', async () => {
  state.auth.companyId = null
  state.tables.members = [row('dropin', { email, name: 'Drop In', status: 'Active', portalAccess: true })]
  const response = await call(setup)
  assert.equal(response.statusCode, 200)
  assert.equal(state.tables.members[0].data.companyId, state.customerTenant)
})

test('a database error cannot grant drop-in authority', async () => {
  state.tables.members[1].data.billingPerson = false
  state.errors.leases = new Error('Database unavailable')
  await assert.rejects(canManageCompanyBilling(state.sb, email, 'beda', { allowDropIn: true }), /Database unavailable/)
  assert.equal(state.setupCalls.length, 0)
})

test('email wildcard characters cannot match a different member', async () => {
  state.tables.members = [row('other', { companyId: 'foreign', email: 'aXb@example.test', billingPerson: true, status: 'Active' })]
  assert.equal(await canManageCompanyBilling(state.sb, 'a_b@example.test', 'foreign'), false)
})

test('administrators retain access', async () => {
  state.admin = true
  assert.equal((await call(setup, { tenantId: 'foreign' })).statusCode, 200)
  assert.equal((await call(checkout, { invoiceId: 'inv-foreign' })).statusCode, 200)
  assert.equal((await call(charge, { invoiceId: 'inv-foreign' })).statusCode, 200)
})

test('signed-out requests never reach Stripe', async () => {
  state.auth = { error: 'Sign in required.', status: 401 }
  for (const handler of [setup, checkout, charge]) assert.equal((await call(handler, { tenantId: 'beda', invoiceId: 'inv-beda' })).statusCode, 401)
  assert.equal(state.setupCalls.length + state.checkoutCalls.length + state.chargeCalls.length, 0)
})

test('disabled online payments and non-payable invoices still block checkout', async () => {
  state.tables.settings[0].data.stripe.paymentsEnabled = false
  assert.equal((await call(checkout, { invoiceId: 'inv-beda' })).statusCode, 403)
  state.tables.settings[0].data.stripe.paymentsEnabled = true
  for (const status of ['paid', 'voided']) {
    state.tables.invoices[0].data.status = status
    assert.equal((await call(checkout, { invoiceId: 'inv-beda' })).statusCode, 400)
  }
  assert.equal(state.checkoutCalls.length, 0)
})
