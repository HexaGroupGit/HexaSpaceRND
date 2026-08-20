// POST /api/auth/reset-password — PUBLIC self-service password reset.
//
// Mints a recovery token with the Admin API and sends it via Resend (the same
// reliable pipeline as invites/invoices), instead of Supabase's built-in Auth
// email — which is rate-limited and often undelivered. ALWAYS returns success
// (no user enumeration): if the email has no account, nothing is sent.
//
// The emailed link points at our own /set-password page with the one-time token
// in the URL fragment — see api/_recoveryLink.js for why that matters.
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH2, bP, bBtn, bSmall, OLIVE } from '../_brand.js'
import { applyCors } from '../_cors.js'
import { mintSetPasswordLink, DEFAULT_PORTAL } from '../_recoveryLink.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured.' })

  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Enter a valid email address.' })

  const admin = createClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  try {
    // A 404 here just means "no account" — swallowed so the response never
    // reveals who has one. Anything else is logged so a genuine outage shows up
    // in the function logs instead of looking like a delivered email.
    const { url, error } = await mintSetPasswordLink(admin, email, DEFAULT_PORTAL, { path: '/reset-password' })
    if (error) {
      if (error.status !== 404) console.error('reset-password generateLink failed:', error.status, error.message)
      return res.status(200).json({ success: true })
    }
    if (!process.env.RESEND_API_KEY) {
      console.error('reset-password: RESEND_API_KEY missing — no email sent')
      return res.status(200).json({ success: true })
    }

    const inner = bKicker('Member Portal') + bH2('Reset your password') +
      bP('We received a request to reset your Hexa Space portal password. Click below to choose a new one.') +
      bBtn('Reset your password', url) +
      bSmall(`This link expires in 24 hours and can be used once. If you've asked for more than one reset email, only the newest link works — older ones stop working the moment a new one is sent.<br><br>If you didn't request this, you can safely ignore this email.<br><br>Trouble with the button? Copy this link:<br><a href="${url}" style="color:${OLIVE};word-break:break-all">${url}</a>`)
    const sent = await sendResendEmail({
      from: 'Hexa Space <info@hexaspace.com.au>',
      to: [email],
      subject: 'Reset your Hexa Space portal password',
      html: brandFrame(inner, { footerLabel: 'Member Portal' }),
    })
    if (!sent?.ok) console.error('reset-password: Resend send failed', sent)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('reset-password error:', err)
    return res.status(200).json({ success: true }) // never leak existence
  }
}
