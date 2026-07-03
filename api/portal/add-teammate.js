// POST /api/portal/add-teammate  { companyId, name, email }
// A member invites a teammate from the portal: creates their member record under
// the same company and emails them a portal set-password link.
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '../_email.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { companyId, name, email } = req.body ?? {}
  if (!companyId || !name || !email) return res.status(400).json({ error: 'Company, name and email are required' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const [{ data: tRows }, { data: sRows }, { data: mRows }] = await Promise.all([
      supabase.from('tenants').select('id, data').eq('id', companyId),
      supabase.from('settings').select('data').eq('id', 'global'),
      supabase.from('members').select('id, data'),
    ])
    const tenant = tRows?.[0]?.data
    if (!tenant) return res.status(404).json({ error: 'Company not found' })
    const settings = sRows?.[0]?.data ?? {}
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const already = (mRows ?? []).map((r) => r.data).some((m) => m.companyId === companyId && (m.email || '').toLowerCase() === email.toLowerCase())
    if (!already) {
      const memberId = `m${Date.now()}${Math.random().toString(36).slice(2, 5)}`
      const member = { id: memberId, companyId, name, email, phone: '', contactPerson: false, billingPerson: false, portalAccess: true, status: 'Active', clientType: tenant.clientType, source: 'portal-invite', createdAt: today }
      await supabase.from('members').upsert({ id: memberId, data: member, updated_at: now })
    }

    // Create the auth user + a set-password link to the portal.
    await supabase.auth.admin.createUser({ email, email_confirm: true }).catch((e) => {
      if (!String(e?.message || '').toLowerCase().includes('already')) throw e
    })
    const redirectTo = settings?.portalUrl || `https://${req.headers.host}`
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } })
    if (linkErr) return res.status(400).json({ error: linkErr.message })
    const actionLink = linkData?.properties?.action_link

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && actionLink) {
      const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
      const fromEmail = settings?.emails?.fromEmail || 'noreply@hexahub.com.au'
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
        <div style="background:#161614;padding:32px 40px"><span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:4px">HEXA SPACE</span><div style="color:#888;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:6px">Member Portal</div></div>
        <div style="padding:40px">
          <h2 style="font-size:20px;color:#111;margin:0 0 16px;font-weight:600">You've been added to ${tenant.businessName || 'your company'}</h2>
          <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 24px">Hi ${name}, you've been given access to the Hexa Space member portal — book meeting rooms, view your company's details and message our team.</p>
          <a href="${actionLink}" style="display:inline-block;background:#161614;color:#fff;text-decoration:none;padding:14px 36px;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:28px">Set up your password</a>
          <p style="color:#999;font-size:12px;line-height:1.6;margin:0">This link expires in 24 hours. Questions? <a href="mailto:info@hexaspace.com.au" style="color:#7F8B2F">info@hexaspace.com.au</a></p>
        </div>
        <div style="background:#f6f5f1;padding:22px 40px;border-top:1px solid #eee"><p style="color:#999;font-size:11px;margin:0;text-align:center">Hexa Space Pty Ltd · 402/830 Whitehorse Road, Box Hill VIC 3128 · hexaspace.com.au</p></div>
      </div>`
      await sendResendEmail({ from: `${fromName} <${fromEmail}>`, to: email, subject: `You've been added to ${tenant.businessName || 'Hexa Space'} on the member portal`, html })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('add-teammate error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
