// POST /api/portal/notify-message
// Sends an email to the admin when a portal member sends a message.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured.' })

  const { tenantName, tenantEmail, message } = req.body ?? {}
  if (!tenantName || !message) return res.status(400).json({ error: 'Missing fields.' })

  const adminUrl = 'https://app.hexahub.com.au/messages'

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:#000000;padding:28px 40px;">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;">HEXAHUB</div>
    <div style="color:#888888;font-size:11px;margin-top:3px;">Management System</div>
  </div>

  <div style="padding:36px 40px;">
    <p style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">New message from member</p>
    <h2 style="font-size:20px;color:#111111;margin:0 0 4px;">${tenantName}</h2>
    ${tenantEmail ? `<p style="color:#888888;font-size:13px;margin:0 0 24px;">${tenantEmail}</p>` : '<div style="margin-bottom:24px;"></div>'}

    <div style="background:#f5f5f5;border-left:3px solid #000000;padding:16px 20px;margin-bottom:28px;border-radius:0 6px 6px 0;">
      <p style="color:#111111;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${message}</p>
    </div>

    <a href="${adminUrl}"
       style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;
              padding:12px 28px;font-size:13px;font-weight:600;border-radius:6px;">
      View &amp; Reply in HexaHub
    </a>
  </div>

  <div style="background:#f5f5f5;padding:20px 40px;border-top:1px solid #eeeeee;">
    <p style="color:#999999;font-size:11px;margin:0;text-align:center;line-height:1.6;">
      HexaHub Pty Ltd &nbsp;·&nbsp; 7 Distribution Circuit, Huntingdale VIC 3166<br>
      <a href="https://hexahub.com.au" style="color:#999999;">hexahub.com.au</a>
    </p>
  </div>
</div>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'HexaHub Portal <info@hexahub.com.au>',
      to: ['info@hexahub.com.au'],
      reply_to: tenantEmail || undefined,
      subject: `New message from ${tenantName} — HexaHub Portal`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const body = await emailRes.text()
    return res.status(500).json({ error: body })
  }

  return res.status(200).json({ success: true })
}
