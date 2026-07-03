// POST /api/auth/invite
// Creates a Supabase auth user and sends a branded "set your password" email via Resend.
// Uses a recovery-type link so the portal shows the SetPassword screen on arrival.
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH2, bP, bBtn, bSmall, OLIVE } from '../_brand.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey  = process.env.RESEND_API_KEY
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' })
  if (!resendKey)  return res.status(500).json({ error: 'RESEND_API_KEY not configured.' })

  const { email, redirectTo, subject, heading, intro, ctaLabel } = req.body ?? {}
  if (!email) return res.status(400).json({ error: 'Email is required.' })

  const REDIRECT = redirectTo || 'https://portal.hexaspace.com.au'
  const SUBJECT = subject || "You've been invited to the Hexa Space Member Portal"
  const HEADING = heading || "You've been invited"
  const INTRO = intro || "You've been given access to the Hexa Space Member Portal — your home for bookings, invoices, membership, events and messaging our team."
  const CTA = ctaLabel || 'Set up your password'

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
    options: { redirectTo: REDIRECT },
  })
  if (linkErr) return res.status(400).json({ error: linkErr.message })

  const actionLink = linkData.properties.action_link

  // Send branded invite email via Resend
  const r = await sendResendEmail({
      from: 'Hexa Space <info@hexaspace.com.au>',
      to: [email],
      subject: SUBJECT,
      html: brandFrame(
        bKicker('Member Portal') +
        bH2(HEADING) +
        bP('Welcome to Hexa Space.') +
        bP(INTRO) +
        bBtn(CTA, actionLink) +
        bSmall(`This link expires in 24 hours.<br><br>Questions? Contact us at <a href="mailto:info@hexaspace.com.au" style="color:${OLIVE};text-decoration:none">info@hexaspace.com.au</a>`),
        { footerLabel: 'Team Access' }
      ),
  })

  if (!r.ok) {
    return res.status(500).json({ error: `Email send failed` })
  }

  return res.status(200).json({ success: true, email })
}
