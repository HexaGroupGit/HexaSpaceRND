// Vercel cron job — runs daily at 9am AEST (11pm UTC)
// Marks overdue invoices and sends reminder emails
// Schedule set in vercel.json

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' })

  const supabase = createClient(SUPABASE_URL, serviceKey)
  const todayStr = new Date().toISOString().split('T')[0]

  try {
    // 1. Load all pending/overdue invoices and tenants
    const [{ data: invRows }, { data: tenantRows }, { data: settRows }] = await Promise.all([
      supabase.from('invoices').select('id, data'),
      supabase.from('tenants').select('id, data'),
      supabase.from('settings').select('data').eq('id', 'global'),
    ])

    const invoices = (invRows ?? []).map((r) => ({ id: r.id, ...r.data }))
    const tenants = (tenantRows ?? []).map((r) => ({ id: r.id, ...r.data }))
    const settings = settRows?.[0]?.data ?? {}

    const fromName = settings?.emails?.fromName || settings?.company?.name || 'HexaHub'
    const fromEmail = settings?.emails?.fromEmail || 'noreply@hexahub.com.au'

    // 2. Find invoices that should be overdue
    const nowOverdue = invoices.filter(
      (inv) => inv.status === 'pending' && inv.dueDate && inv.dueDate < todayStr
    )

    // Mark overdue in Supabase
    for (const inv of nowOverdue) {
      await supabase.from('invoices').update({ data: { ...inv, status: 'overdue' } }).eq('id', inv.id)
    }

    // 3. Find all overdue invoices (including freshly marked ones)
    const allOverdue = invoices
      .map((inv) => nowOverdue.find((o) => o.id === inv.id) ? { ...inv, status: 'overdue' } : inv)
      .filter((inv) => inv.status === 'overdue' && inv.dueDate)

    if (!resendKey || allOverdue.length === 0) {
      return res.status(200).json({ marked: nowOverdue.length, reminded: 0 })
    }

    // 4. Send reminder emails (one per tenant, listing all overdue invoices)
    const byTenant = {}
    for (const inv of allOverdue) {
      if (!byTenant[inv.tenantId]) byTenant[inv.tenantId] = []
      byTenant[inv.tenantId].push(inv)
    }

    let reminded = 0
    for (const [tenantId, invs] of Object.entries(byTenant)) {
      const tenant = tenants.find((t) => t.id === tenantId)
      if (!tenant?.email) continue

      const invoiceRows = invs.map((inv) => {
        const sub = (inv.lineItems ?? []).reduce((s, l) => {
          return s + Math.round(l.unitPrice * l.qty * (1 - (l.discountPct ?? 0) / 100) * 100) / 100
        }, 0)
        const gst = inv.vatEnabled !== false ? Math.round(sub * 0.1 * 100) / 100 : 0
        const total = sub + gst
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${inv.number}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${inv.dueDate}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">$${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD</td>
        </tr>`
      }).join('')

      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0">
<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
  <div style="background:#000;padding:20px 32px"><span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">${fromName.toUpperCase()}</span></div>
  <div style="padding:32px">
    <h2 style="margin:0 0 12px;font-size:16px;color:#c00">Payment Reminder</h2>
    <p style="color:#555;font-size:14px;margin:0 0 16px">Hi ${tenant.contactName ?? tenant.businessName},</p>
    <p style="color:#555;font-size:14px;margin:0 0 20px">The following invoice(s) are overdue. Please arrange payment at your earliest convenience.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <thead><tr style="background:#f9f9f9">
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #eee">Invoice</th>
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #eee">Due Date</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #eee">Amount</th>
      </tr></thead>
      <tbody>${invoiceRows}</tbody>
    </table>
    <p style="color:#555;font-size:13px;margin:0 0 8px">Please contact us if you have any questions regarding your account.</p>
    <p style="font-size:12px;color:#888;margin-top:24px">This is an automated reminder from ${fromName}.</p>
  </div>
</div></body></html>`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: tenant.email,
          subject: `Payment reminder — ${invs.length} overdue invoice${invs.length > 1 ? 's' : ''} from ${fromName}`,
          html,
        }),
      })
      reminded++
    }

    return res.status(200).json({ marked: nowOverdue.length, reminded })
  } catch (err) {
    console.error('Overdue reminders error:', err)
    return res.status(500).json({ error: err.message })
  }
}
