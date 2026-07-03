// POST /api/auto-billing  — manual trigger from admin
// GET  /api/auto-billing  — Vercel cron (runs 1st of each month)
//
// Creates invoices for all active leases that don't have one for the current month,
// then emails each tenant their invoice.

import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from './_email.js'

const SUPABASE_URL = process.env.SUPABASE_URL

function pad(n) { return String(n).padStart(4, '0') }
function fmtAud(n) { return `A$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` }

function monthBounds(date) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const start = new Date(y, m, 1)
  const end   = new Date(y, m + 1, 0)
  const fmt = (d) => d.toISOString().split('T')[0]
  return { periodStart: fmt(start), periodEnd: fmt(end) }
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function monthLabel(periodStart) {
  return new Date(periodStart + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

function invoiceEmail(invoice, tenant, settings, subtotal, gst, total) {
  const b = settings.billing ?? {}
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:#000000;padding:28px 40px;">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;">HEXAHUB</div>
    <div style="color:#888888;font-size:11px;margin-top:3px;">HexaHub Pty Ltd</div>
  </div>
  <div style="padding:36px 40px;">
    <p style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Invoice</p>
    <h2 style="font-size:22px;color:#111111;margin:0 0 4px;">${invoice.number}</h2>
    <p style="color:#888888;font-size:13px;margin:0 0 28px;">Due ${invoice.dueDate}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#000;">
          <th style="text-align:left;padding:10px 14px;color:#fff;font-size:12px;">Description</th>
          <th style="text-align:right;padding:10px 14px;color:#fff;font-size:12px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.lineItems.map(li => {
          const net = li.unitPrice * (li.qty ?? 1) * (1 - (li.discountPct ?? 0) / 100)
          return `<tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:12px 14px;font-size:13px;color:#333;">${li.description}</td>
            <td style="padding:12px 14px;font-size:13px;color:#333;text-align:right;">${fmtAud(net)}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <tr><td style="padding:5px 14px;font-size:13px;color:#666;">Subtotal</td><td style="padding:5px 14px;font-size:13px;color:#666;text-align:right;">${fmtAud(subtotal)}</td></tr>
      <tr><td style="padding:5px 14px;font-size:13px;color:#666;">GST (10%)</td><td style="padding:5px 14px;font-size:13px;color:#666;text-align:right;">${fmtAud(gst)}</td></tr>
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-size:14px;font-weight:bold;color:#111;">Total Due</td>
        <td style="padding:10px 14px;font-size:14px;font-weight:bold;color:#111;text-align:right;">${fmtAud(total)}</td>
      </tr>
    </table>

    ${b.bankName ? `
    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:16px 20px;margin-bottom:28px;">
      <p style="font-size:12px;font-weight:bold;color:#111;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">Payment Details</p>
      <p style="font-size:13px;color:#444;margin:3px 0;">Bank: ${b.bankName}</p>
      <p style="font-size:13px;color:#444;margin:3px 0;">BSB: ${b.bsb}</p>
      <p style="font-size:13px;color:#444;margin:3px 0;">Account: ${b.acc}</p>
      <p style="font-size:13px;color:#444;margin:3px 0;">Reference: <strong>${invoice.number}</strong></p>
    </div>` : ''}

    <a href="https://members.hexahub.com.au/billing"
       style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;font-size:13px;font-weight:600;border-radius:6px;">
      View in Member Portal
    </a>
  </div>
  <div style="background:#f5f5f5;padding:20px 40px;border-top:1px solid #eee;">
    <p style="color:#999;font-size:11px;margin:0;text-align:center;line-height:1.6;">
      HexaHub Pty Ltd &nbsp;·&nbsp; ABN ${b.abn ?? ''}<br>
      ${b.address ?? '402/830 Whitehorse Road, Box Hill VIC 3128'} &nbsp;·&nbsp;
      <a href="https://hexahub.com.au" style="color:#999;">hexahub.com.au</a>
    </p>
  </div>
</div>`
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey  = process.env.RESEND_API_KEY
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set.' })

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Load everything in parallel
  const [lRes, tRes, iRes, sRes] = await Promise.all([
    supabase.from('leases').select('data'),
    supabase.from('tenants').select('data'),
    supabase.from('invoices').select('data'),
    supabase.from('settings').select('data').eq('id', 'global').single(),
  ])

  const leases   = (lRes.data ?? []).map(r => r.data).filter(l => l.status === 'active')
  const tenants  = (tRes.data ?? []).map(r => r.data)
  const invoices = (iRes.data ?? []).map(r => r.data)
  const settings = sRes.data?.data ?? {}

  const now = new Date()
  const { periodStart, periodEnd } = monthBounds(now)
  const issueDate    = now.toISOString().split('T')[0]
  const dueDateDays  = settings.invoicing?.dueDateDays ?? 14
  const dueDate      = addDays(now, dueDateDays)
  const taxRate      = settings.billingRules?.taxEnabled !== false ? (settings.billingRules?.taxRate ?? 10) / 100 : 0
  const numTemplate  = settings.invoicing?.invoiceNumberTemplate ?? 'INV-{{number}}'

  // Find highest existing invoice number
  let nextNum = invoices
    .map(i => parseInt((i.number ?? '').replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n) && n > 0)
    .reduce((max, n) => Math.max(max, n), 0) + 1

  const created = [], skipped = [], errors = []

  for (const lease of leases) {
    const tenant = tenants.find(t => t.id === lease.tenantId)
    if (!tenant) { errors.push({ leaseId: lease.id, reason: 'No tenant found' }); continue }

    // Skip if invoice already exists for this period
    const exists = invoices.some(i =>
      i.leaseId === lease.id &&
      i.periodStart === periodStart &&
      i.status !== 'voided'
    )
    if (exists) { skipped.push(tenant.businessName); continue }

    const rent       = Number(lease.monthlyRent ?? 0)
    const discPct    = parseFloat(lease.discount ?? lease.items?.[0]?.steps?.[0]?.discount ?? '') || 0
    const invoiceNum = numTemplate.replace('{{number}}', pad(nextNum++))

    const lineItems = [{
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      description: `${lease.contractNumber ?? 'Licence'} — ${monthLabel(periodStart)}`,
      revenueAccount: 'Membership Fees',
      unitPrice: rent,
      qty: 1,
      discountPct: discPct,
    }]

    const invoice = {
      id: `inv_auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      number: invoiceNum,
      tenantId: tenant.id,
      leaseId: lease.id,
      status: 'pending',
      sentStatus: 'sent',
      source: 'auto-bill',
      issueDate, dueDate, periodStart, periodEnd,
      vatEnabled: true,
      xeroSync: false,
      lineItems,
      payments: [],
      comments: [],
      creditNoteForId: null,
      createdAt: issueDate,
      isProrated: false,
    }

    const { error: saveErr } = await supabase.from('invoices').insert({
      id: invoice.id,
      data: invoice,
      updated_at: new Date().toISOString(),
    })
    if (saveErr) { errors.push({ tenant: tenant.businessName, reason: saveErr.message }); continue }

    // Send invoice email
    if (tenant.email && resendKey) {
      const subtotal = rent * (1 - discPct / 100)
      const gst      = subtotal * taxRate
      const total    = subtotal + gst
      const html     = invoiceEmail(invoice, tenant, settings, subtotal, gst, total)

      await sendResendEmail({
        from: 'HexaHub <info@hexahub.com.au>',
        to: [tenant.email],
        subject: `Invoice ${invoiceNum} — ${monthLabel(periodStart)}`,
        html,
      }).catch(() => {})
    }

    created.push({ number: invoiceNum, tenant: tenant.businessName })
  }

  // Send admin summary email
  if (resendKey) {
    const rows = (items) => items.map(i =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">${typeof i === 'string' ? i : `${i.number} — ${i.tenant}`}</td></tr>`
    ).join('')

    await sendResendEmail({
        from: 'HexaHub <info@hexahub.com.au>',
        to: ['info@hexahub.com.au'],
        subject: `Auto Bill Run — ${periodStart} → ${periodEnd}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;">
  <div style="background:#000;padding:24px 32px;">
    <div style="color:#fff;font-size:18px;font-weight:900;letter-spacing:3px;">HEXAHUB</div>
    <div style="color:#888;font-size:11px;margin-top:2px;">Auto Bill Run Report</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Billing Period</p>
    <h2 style="font-size:18px;color:#111;margin:0 0 24px;">${periodStart} → ${periodEnd}</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr style="background:#000;">
        <td style="padding:8px 12px;color:#fff;font-size:12px;font-weight:bold;">
          ✓ ${created.length} Invoice${created.length !== 1 ? 's' : ''} Created &amp; Emailed
        </td>
      </tr>
      ${created.length ? rows(created) : '<tr><td style="padding:6px 12px;color:#888;font-style:italic;">None</td></tr>'}
    </table>

    ${skipped.length ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr style="background:#f5f5f5;">
        <td style="padding:8px 12px;color:#555;font-size:12px;font-weight:bold;">
          — ${skipped.length} Skipped (already invoiced)
        </td>
      </tr>
      ${rows(skipped)}
    </table>` : ''}

    ${errors.length ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr style="background:#fef2f2;">
        <td style="padding:8px 12px;color:#dc2626;font-size:12px;font-weight:bold;">
          ✗ ${errors.length} Error${errors.length !== 1 ? 's' : ''}
        </td>
      </tr>
      ${errors.map(e => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#dc2626;">${e.tenant ?? e.leaseId}: ${e.reason}</td></tr>`).join('')}
    </table>` : ''}

    <a href="https://app.hexahub.com.au/billing"
       style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:10px 24px;font-size:13px;font-weight:600;border-radius:6px;">
      View Billing
    </a>
  </div>
  <div style="background:#f5f5f5;padding:16px 32px;border-top:1px solid #eee;">
    <p style="color:#999;font-size:11px;margin:0;text-align:center;">HexaHub Pty Ltd · hexahub.com.au</p>
  </div>
</div>`,
    }).catch(() => {})
  }

  return res.status(200).json({
    period: `${periodStart} → ${periodEnd}`,
    created,
    skipped,
    errors,
  })
}
