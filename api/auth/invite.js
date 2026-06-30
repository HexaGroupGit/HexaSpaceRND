// POST /api/auth/invite
// Creates a Supabase auth user and sends a branded "set your password" email via Resend.
// Uses a recovery-type link so the portal shows the SetPassword screen on arrival.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey  = process.env.RESEND_API_KEY
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' })
  if (!resendKey)  return res.status(500).json({ error: 'RESEND_API_KEY not configured.' })

  const { email } = req.body ?? {}
  if (!email) return res.status(400).json({ error: 'Email is required.' })

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Create the user if they don't already exist
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createErr && !createErr.message.toLowerCase().includes('already been registered')) {
    return res.status(400).json({ error: createErr.message })
  }

  // Generate a recovery link — fires PASSWORD_RECOVERY event on the portal client
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://members.hexahub.com.au' },
  })
  if (linkErr) return res.status(400).json({ error: linkErr.message })

  const actionLink = linkData.properties.action_link

  // Send branded invite email via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'HexaHub <info@hexahub.com.au>',
      to: [email],
      subject: "You've been invited to the HexaHub Member Portal",
      html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:#000000;padding:32px 40px;">
    <div style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:4px;">HEXAHUB</div>
    <div style="color:#888888;font-size:12px;margin-top:4px;">Member Portal</div>
  </div>
  <div style="padding:40px;">
    <h2 style="font-size:20px;color:#111111;margin:0 0 16px 0;">You've been invited</h2>
    <p style="color:#444444;font-size:14px;line-height:1.7;margin:0 0 8px 0;">Welcome to HexaHub.</p>
    <p style="color:#444444;font-size:14px;line-height:1.7;margin:0 0 32px 0;">
      You've been given access to the HexaHub Member Portal — your central hub for
      viewing invoices, contracts, upcoming events, and messaging our team.
    </p>
    <a href="${actionLink}"
       style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;
              padding:14px 36px;font-size:14px;font-weight:600;border-radius:6px;margin-bottom:32px;">
      Set Up Your Password
    </a>
    <p style="color:#999999;font-size:12px;line-height:1.6;margin:0;">
      This link expires in 24 hours.<br><br>
      Questions? Contact us at
      <a href="mailto:info@hexahub.com.au" style="color:#000000;">info@hexahub.com.au</a>
    </p>
  </div>
  <div style="background:#f5f5f5;padding:24px 40px;border-top:1px solid #eeeeee;">
    <p style="color:#999999;font-size:11px;margin:0;text-align:center;line-height:1.6;">
      HexaHub Pty Ltd &nbsp;·&nbsp; 7 Distribution Circuit, Huntingdale VIC 3166<br>
      <em>build locally, scale sustainably</em> &nbsp;·&nbsp;
      <a href="https://hexahub.com.au" style="color:#999999;">hexahub.com.au</a>
    </p>
  </div>
</div>`,
    }),
  })

  if (!emailRes.ok) {
    const body = await emailRes.text()
    return res.status(500).json({ error: `Email send failed: ${body}` })
  }

  return res.status(200).json({ success: true, email })
}
