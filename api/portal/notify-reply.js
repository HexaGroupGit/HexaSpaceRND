// POST /api/portal/notify-reply
// Sends an email to the tenant when admin replies to their portal message.
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH2, bP, bBtn, bPanel, INK } from '../_brand.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Admin-only: sends a branded "reply from our team" to a member.
  const { requireAdmin } = await import('../_auth.js')
  const _a = await requireAdmin(req)
  if (_a.error) return res.status(_a.status).json({ error: _a.error })

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured.' })

  const { tenantEmail, tenantName, message } = req.body ?? {}
  if (!tenantEmail || !message) return res.status(400).json({ error: 'Missing fields.' })

  const portalUrl = 'https://portal.hexaspace.com.au/messages'

  const html = brandFrame(
    bKicker('New reply from our team') +
    bH2(`Hi ${tenantName},`) +
    bP('The Hexa Space team has replied to your message:') +
    bPanel(`<p style="font-family:'HexaGT','Helvetica Neue',Arial,sans-serif;color:${INK};font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap">${message}</p>`) +
    bBtn('View Conversation', portalUrl),
    { footerLabel: 'Member Portal' }
  )

  const r = await sendResendEmail({
    from: 'Hexa Space <info@hexaspace.com.au>',
    to: [tenantEmail],
    subject: `New message from Hexa Space`,
    html,
  })

  if (!r.ok) {
    return res.status(500).json({ error: 'Email send failed' })
  }

  return res.status(200).json({ success: true })
}
