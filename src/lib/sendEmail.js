// Client-side helper — calls the /api/send-email serverless function.
// Pass settings from useStore to provide from/replyTo/cc/bcc values.

import { supabase } from './supabase.js'

export async function sendEmail({ to, subject, html, settings, attachments, tenantId, emailType }) {
  const emails = settings?.emails ?? {}
  const billing = settings?.billing ?? {}
  const company = settings?.company ?? {}

  const fromName = emails.fromName || company.name || 'HexaHub'
  const fromEmail = emails.fromEmail || 'noreply@hexahub.com.au'

  const body = {
    to,
    subject,
    html,
    from: `${fromName} <${fromEmail}>`,
    ...(emails.replyTo ? { replyTo: emails.replyTo } : {}),
    ...(emails.cc ? { cc: emails.cc } : {}),
    ...(emails.bcc ? { bcc: emails.bcc } : {}),
    ...(attachments?.length ? { attachments } : {}),
  }

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to send email')
  }

  const result = await res.json()

  // Log to Supabase (fire-and-forget — never block the email send)
  const logId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  supabase.from('email_log').insert({
    id: logId,
    data: {
      id: logId,
      tenantId: tenantId ?? null,
      emailType: emailType ?? 'general',
      to,
      subject,
      sentAt: new Date().toISOString(),
      hasAttachment: !!(attachments?.length),
    },
  }).then(() => {}).catch(() => {})

  return result
}

// ── Template helper ────────────────────────────────────────────────────────────
export function resolveEmailTemplate(type, vars, settings) {
  const tpl = settings?.emailTemplates?.[type]
  const sub = tpl?.subject ?? ''
  const intro = tpl?.intro ?? ''
  const replace = (str) => str
    .replace(/\{\{number\}\}/g, vars.number ?? '')
    .replace(/\{\{company\}\}/g, vars.company ?? '')
    .replace(/\{\{dueDate\}\}/g, vars.dueDate ?? '')
    .replace(/\{\{amount\}\}/g, vars.amount ?? '')
    .replace(/\{\{contract\}\}/g, vars.contract ?? '')
    .replace(/\{\{expiryDate\}\}/g, vars.expiryDate ?? '')
    .replace(/\{\{tenantName\}\}/g, vars.tenantName ?? '')
  return { subject: replace(sub), intro: replace(intro) }
}

// ── Email templates ────────────────────────────────────────────────────────────

export function invoiceEmailHtml({ invoice, tenant, settings }) {
  const company = settings?.company ?? {}
  const billing = settings?.billing ?? {}
  const name = billing.businessName || company.name || 'HexaHub'
  const address = billing.address || '7 Distribution Circuit, Huntingdale VIC 3166'
  const website = company.website || 'hexahub.com.au'
  const bsb = billing.bsb || '—'
  const acc = billing.acc || '—'

  const total = (invoice.lineItems ?? []).reduce((s, l) => {
    const lineTotal = Math.round(l.unitPrice * l.qty * (1 - (l.discountPct ?? 0) / 100) * 100) / 100
    return s + lineTotal
  }, 0)
  const gst = invoice.vatEnabled !== false ? Math.round(total * 0.1 * 100) / 100 : 0
  const grandTotal = total + gst

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
  <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
    <div style="background:#000;padding:24px 32px">
      <span style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:2px">${name.toUpperCase()}</span>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;color:#555;font-size:14px">Hi ${tenant?.contactName ?? tenant?.businessName ?? 'there'},</p>
      <p style="margin:0 0 24px;font-size:14px">${settings?.emailTemplates?.invoice?.intro?.replace(/\{\{number\}\}/g, invoice.number ?? '').replace(/\{\{dueDate\}\}/g, invoice.dueDate ?? '') ?? 'Please find your invoice details below.'}</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
        <tr style="background:#f5f5f5">
          <td style="padding:10px 14px;font-weight:bold">Invoice Number</td>
          <td style="padding:10px 14px">${invoice.number}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold">Period</td>
          <td style="padding:10px 14px">${invoice.periodStart ?? ''} – ${invoice.periodEnd ?? ''}</td>
        </tr>
        <tr style="background:#f5f5f5">
          <td style="padding:10px 14px;font-weight:bold">Due Date</td>
          <td style="padding:10px 14px">${invoice.dueDate ?? '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold">Amount Due</td>
          <td style="padding:10px 14px;font-size:18px;font-weight:bold">$${grandTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD</td>
        </tr>
      </table>

      <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:4px;padding:16px;margin-bottom:24px;font-size:13px">
        <p style="margin:0 0 4px;font-weight:bold">Payment Details</p>
        <p style="margin:0;color:#555">Account Name: ${name}<br>BSB: ${bsb}<br>ACC: ${acc}</p>
      </div>

      <p style="font-size:12px;color:#888;margin:0">
        ${name} &middot; ${address} &middot; <a href="https://${website}" style="color:#888">${website}</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export function eSignEmailHtml({ lease, tenant, settings }) {
  const company = settings?.company ?? {}
  const contracts = settings?.contracts ?? {}
  const name = company.name || 'HexaHub'
  const signerName = contracts.eSignName || name
  const memberLink = lease.eSignMemberLink ?? `https://esign.hexahub.com.au/member/${lease.id}`
  const contractNum = lease.contractNumber ?? lease.id

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
  <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
    <div style="background:#000;padding:24px 32px">
      <span style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:2px">${name.toUpperCase()}</span>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;font-size:14px">Hi ${tenant?.contactName ?? tenant?.businessName ?? 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px">
        <strong>${signerName}</strong> has sent you a licence agreement to review and sign.
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#555">Contract: ${contractNum}</p>
      <div style="margin:24px 0;text-align:center">
        <a href="${memberLink}"
           style="background:#000;color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block">
          Review &amp; Sign Document
        </a>
      </div>
      <p style="font-size:12px;color:#888;margin:0">
        If the button doesn't work, copy this link: <a href="${memberLink}" style="color:#888">${memberLink}</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
