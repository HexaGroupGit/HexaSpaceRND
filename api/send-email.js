// Vercel serverless function — POST /api/send-email
// Requires env var: RESEND_API_KEY
// Body: { to, subject, html, replyTo?, cc?, bcc?, from? }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Email service not configured' })
  }

  const {
    to,
    subject,
    html,
    replyTo,
    cc,
    bcc,
    from = 'HexaHub <noreply@hexahub.com.au>',
    attachments,
  } = req.body

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' })
  }

  const payload = { from, to, subject, html }
  if (replyTo) payload.reply_to = replyTo
  if (cc) payload.cc = Array.isArray(cc) ? cc : [cc]
  if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc]
  if (attachments?.length) payload.attachments = attachments

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend error:', data)
      return res.status(response.status).json({ error: data.message ?? 'Failed to send email' })
    }

    return res.status(200).json({ success: true, id: data.id })
  } catch (err) {
    console.error('Send email error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
