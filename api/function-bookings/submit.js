// POST /api/function-bookings/submit  { id }
// Called when a client completes their function details in the portal (and by the
// admin "approve" action for member requests that already have details). Finalises
// their company/member, raises the deposit + $300 security invoices, emails the
// deposit, and moves the booking to 'awaiting_deposit'. Balance + calendar happen
// later when the deposit is marked paid.
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '../_email.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const money = (v) => `$${(Number(v) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  const { id } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'Missing id' })

  try {
    const now = new Date().toISOString()
    const [{ data: fbRows }, { data: invRows }, { data: settRows }, { data: tenantRows }, { data: memberRows }] = await Promise.all([
      supabase.from('function_bookings').select('id, data').eq('id', id),
      supabase.from('invoices').select('id, data'),
      supabase.from('settings').select('data').eq('id', 'global'),
      supabase.from('tenants').select('id, data'),
      supabase.from('members').select('id, data'),
    ])
    const b = fbRows?.[0]?.data
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    if (b.depositRaisedAt) return res.status(200).json({ success: true, already: true })

    const settings = settRows?.[0]?.data ?? {}
    const q = b.quote || {}

    // ── Finalise company + member from captured info ──
    const ci = b.companyInfo || {}
    const mi = b.memberInfo || {}
    let tenantId = b.companyId
    const tenants = (tenantRows ?? []).map((r) => r.data)
    if (tenantId && tenants.some((t) => t.id === tenantId)) {
      const t = tenants.find((x) => x.id === tenantId)
      const patch = { ...t, clientType: 'function' }
      if (ci.businessName) patch.businessName = ci.businessName
      if (ci.abn) patch.abn = ci.abn
      if (ci.phone) patch.phone = ci.phone
      if (ci.contactName) patch.contactName = ci.contactName
      await supabase.from('tenants').upsert({ id: tenantId, data: patch, updated_at: now })
    } else {
      tenantId = `t${Date.now()}`
      const t = { id: tenantId, businessName: ci.businessName || b.organisation || b.name || 'Function client', contactName: ci.contactName || b.name || '', email: b.email || '', phone: ci.phone || b.phone || '', abn: ci.abn || '', clientType: 'function', status: 'client', industry: 'Function client', createdAt: now.split('T')[0] }
      await supabase.from('tenants').upsert({ id: tenantId, data: t, updated_at: now })
    }
    const members = (memberRows ?? []).map((r) => r.data)
    let memberId = b.memberId
    if (!memberId && (mi.name || b.name)) {
      memberId = `m${Date.now()}`
      const m = { id: memberId, name: mi.name || b.name, email: mi.email || b.email, phone: mi.phone || b.phone || '', companyId: tenantId, clientType: 'function', role: 'Function contact', status: 'active', createdAt: now.split('T')[0] }
      await supabase.from('members').upsert({ id: memberId, data: m, updated_at: now })
    }

    // ── Raise deposit (50%, GST) + refundable $300 security (no GST) ──
    const invoices = (invRows ?? []).map((r) => r.data)
    const nums = invoices.map((i) => parseInt(String(i.number || '').replace(/\D/g, '') || '0', 10)).filter((n) => !isNaN(n))
    let next = nums.length ? Math.max(...nums) + 1 : 1
    const tmpl = settings?.invoicing?.invoiceNumberTemplate ?? 'INV-{{number}}'
    const numFor = () => tmpl.replace('{{number}}', String(next++).padStart(4, '0'))
    const clientName = b.organisation || ci.businessName || b.name || 'Function client'
    const base = { tenantId, source: 'function', status: 'pending', sentStatus: 'not_sent', functionRef: b.ref, clientName, clientEmail: b.email, issueDate: now.split('T')[0], payments: [], comments: [], createdAt: now.split('T')[0] }

    // One deposit invoice, two lines: 50% of the booking cost (GST applies) and
    // the $300 refundable security deposit (GST-exempt).
    const depId = `inv${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const depInv = { ...base, id: depId, number: numFor(), invoiceType: 'function_deposit', dueDate: now.split('T')[0], vatEnabled: true, lineItems: [
      { description: `50% deposit — function booking · ${b.eventName || 'Function'} (${b.eventDate})`, revenueAccount: 'Function Space Hire', unitPrice: q.depositHalf ?? 0, qty: 1, discountPct: 0 },
      { description: `Refundable security deposit · ${b.eventName || 'Function'}`, revenueAccount: 'Security Deposit', unitPrice: q.securityDeposit ?? 300, qty: 1, discountPct: 0, vatExempt: true },
    ] }
    await supabase.from('invoices').upsert([{ id: depId, data: depInv, updated_at: now }])

    // ── Update booking ──
    const updated = { ...b, stage: 'awaiting_deposit', depositRaisedAt: now, tenantId, companyId: tenantId, memberId, depositInvoiceId: depId, read: false, updatedAt: now }
    await supabase.from('function_bookings').upsert({ id: b.id, data: updated, updated_at: now })

    // ── Email the deposit-due notice ──
    emailDeposit(settings, updated, q).catch(() => {})
    return res.status(200).json({ success: true, dueNow: q.dueNow })
  } catch (err) {
    console.error('function submit error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function emailDeposit(settings, b, q) {
  if (!b.email) return
  const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
  const fromEmail = settings?.emails?.fromEmail || 'noreply@hexahub.com.au'
  const replyTo = settings?.emails?.replyTo || settings?.emails?.notificationEmail
  const bank = settings?.billing || {}
  const bankBlock = (bank.bankName || bank.bsb || bank.acc)
    ? `<div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;padding:16px 20px;margin:0 0 20px;font-size:13px;color:#555">
        <div style="font-weight:700;color:#111;margin-bottom:6px">Payment details</div>
        ${bank.bankName ? `<div>Bank: ${bank.bankName}</div>` : ''}
        ${bank.businessName ? `<div>Account name: ${bank.businessName}</div>` : ''}
        ${bank.bsb ? `<div>BSB: ${bank.bsb}</div>` : ''}
        ${bank.acc ? `<div>Account: ${bank.acc}</div>` : ''}
        <div style="margin-top:6px">Reference: ${b.ref}</div>
      </div>` : ''
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
  <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
    <div style="background:#000;padding:24px 32px"><span style="color:#fff;font-size:18px;font-weight:900;letter-spacing:3px">${(fromName).toUpperCase()}</span><span style="color:#888;font-size:12px;margin-left:12px">Function Space Hire</span></div>
    <div style="padding:32px">
      <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Deposit due to secure your date</p>
      <h2 style="font-size:20px;color:#111;margin:0 0 18px">Thanks ${b.name || 'there'} — one step to secure your booking</h2>
      <p style="font-size:14px;color:#555;margin:0 0 18px">Your details are in. To secure <strong>${b.eventDate || 'your date'}</strong> we just need your deposit. Your date isn't held until the deposit is received.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px">
        <tr><td style="padding:8px 0;color:#888">Total (inc GST)</td><td style="padding:8px 0;text-align:right;color:#111">${money(q.total)}</td></tr>
        <tr><td style="padding:8px 0;color:#111;font-weight:700">Deposit due now</td><td style="padding:8px 0;text-align:right;color:#111;font-weight:700">${money(q.dueNow)}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Balance (14 days before event)</td><td style="padding:8px 0;text-align:right;color:#888">${money(q.balanceDue)}</td></tr>
      </table>
      ${bankBlock}
      <p style="font-size:12px;color:#999;margin:0">Deposit includes your 50% venue hire and the $300 refundable security deposit. Once received, we'll confirm and lock in your booking.</p>
    </div>
  </div></body></html>`
  await sendResendEmail({ from: `${fromName} <${fromEmail}>`, to: b.email, replyTo, subject: `Deposit due to secure your function — ${b.ref}`, html })
}
