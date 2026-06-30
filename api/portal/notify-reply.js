// POST /api/portal/notify-reply
// Sends an email to the tenant when admin replies to their portal message.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured.' })

  const { tenantEmail, tenantName, message } = req.body ?? {}
  if (!tenantEmail || !message) return res.status(400).json({ error: 'Missing fields.' })

  const portalUrl = 'https://members.hexahub.com.au/messages'

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:#000000;padding:28px 40px;">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;">HEXAHUB</div>
    <div style="color:#888888;font-size:11px;margin-top:3px;">Member Portal</div>
  </div>

  <div style="padding:36px 40px;">
    <p style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">New reply from HexaHub</p>
    <h2 style="font-size:20px;color:#111111;margin:0 0 24px;">Hi ${tenantName},</h2>

    <p style="color:#444444;font-size:14px;line-height:1.6;margin:0 0 16px;">
      The HexaHub team has replied to your message:
    </p>

    <div style="background:#f5f5f5;border-left:3px solid #000000;padding:16px 20px;margin-bottom:28px;border-radius:0 6px 6px 0;">
      <p style="color:#111111;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${message}</p>
    </div>

    <a href="${portalUrl}"
       style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;
              padding:12px 28px;font-size:13px;font-weight:600;border-radius:6px;">
      View Conversation
    </a>
  </div>

  <div style="background:#f5f5f5;padding:20px 40px;border-top:1px solid #eeeeee;">
    <p style="color:#999999;font-size:11px;margin:0;text-align:center;line-height:1.6;">
      HexaHub Pty Ltd &nbsp;·&nbsp; 7 Distribution Circuit, Huntingdale VIC 3166<br>
      <em>build locally, scale sustainably</em> &nbsp;·&nbsp;
      <a href="https://hexahub.com.au" style="color:#999999;">hexahub.com.au</a>
    </p>
  </div>
</div>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'HexaHub <info@hexahub.com.au>',
      to: [tenantEmail],
      subject: `New message from HexaHub`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const body = await emailRes.text()
    return res.status(500).json({ error: body })
  }

  return res.status(200).json({ success: true })
}
