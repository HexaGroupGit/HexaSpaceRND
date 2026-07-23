// Portal-invite core: creates the Supabase auth user and sends the branded
// "set your password" email. Shared by POST /api/auth/invite and the daily
// reconcile cron so both paths grant portal access identically.
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from './_email.js'
import { brandFrame, bKicker, bH2, bP, bBtn, bSmall, bPanel, OLIVE } from './_brand.js'

const SUPABASE_URL = process.env.SUPABASE_URL

// The essentials every NEW portal user needs regardless of how they were
// invited (teammate add, admin invite, cron catch-up, bulk migration):
// Wi-Fi details and the add-/app-to-homescreen steps. Callers that pass
// bespoke extraHtml (e.g. the countersign portal welcome) carry their own.
export function newUserEssentialsHtml(settings = {}) {
  const wifi = settings?.wifi ?? {}
  const appUrl = 'https://portal.hexaspace.com.au/app'
  const title = (t) => `<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${OLIVE};margin-bottom:8px;font-weight:600">${t}</div>`
  return (
    bPanel(
      title('Wi-Fi') +
      `<p style="margin:0;font-size:13px;line-height:1.7;color:#3a3a3a">Network <strong>${wifi.ssid || 'Hexa Spaces'}</strong>${wifi.password ? ` &nbsp;·&nbsp; password <strong>${wifi.password}</strong>` : ' — password available at reception'}</p>`
    ) +
    bPanel(
      title('On your phone') +
      `<p style="margin:0;font-size:13px;line-height:1.8;color:#3a3a3a">Once your password is set, open <a href="${appUrl}" style="color:${OLIVE};font-weight:600">portal.hexaspace.com.au/app</a> and add it to your home screen so it opens like an app:<br>` +
      `<strong>iPhone</strong> — open in Safari, tap Share, then &ldquo;Add to Home Screen&rdquo;.<br>` +
      `<strong>Android</strong> — open in Chrome, tap the &#8942; menu, then &ldquo;Add to Home screen&rdquo;.</p>`
    )
  )
}

// Returns { ok: true, email } or { ok: false, error }.
// greeting/extraHtml/footerLabel are optional overrides used by the portal
// migration bulk-invite; defaults preserve the original invite exactly.
export async function invitePortalUser({ email, redirectTo, subject, heading, greeting, intro, extraHtml, ctaLabel, footerLabel }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!serviceKey) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' }
  if (!resendKey) return { ok: false, error: 'RESEND_API_KEY not configured.' }
  if (!email) return { ok: false, error: 'Email is required.' }

  const REDIRECT = redirectTo || 'https://portal.hexaspace.com.au'
  const SUBJECT = subject || "You've been invited to the Hexa Space Member Portal"
  const HEADING = heading || "You've been invited"
  const INTRO = intro || "You've been given access to the Hexa Space Member Portal — your home for bookings, invoices, membership, events and messaging our team."
  const CTA = ctaLabel || 'Set up your password'

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Create the user if they don't already exist
  const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (createErr && !createErr.message.toLowerCase().includes('already been registered')) {
    return { ok: false, error: createErr.message }
  }

  // Recovery-type link — fires PASSWORD_RECOVERY on the portal client so it
  // shows the SetPassword screen on arrival.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: REDIRECT },
  })
  if (linkErr) return { ok: false, error: linkErr.message }

  // Default invites (no bespoke extraHtml) carry the new-user essentials.
  let extras = extraHtml
  if (!extras) {
    try {
      const { data: settRow } = await admin.from('settings').select('data').eq('id', 'global').single()
      extras = newUserEssentialsHtml(settRow?.data)
    } catch {
      extras = newUserEssentialsHtml()
    }
  }

  const r = await sendResendEmail({
    from: 'Hexa Space <info@hexaspace.com.au>',
    to: [email],
    subject: SUBJECT,
    html: brandFrame(
      bKicker('Member Portal') +
      bH2(HEADING) +
      bP(greeting || 'Welcome to Hexa Space.') +
      bP(INTRO) +
      (extras || '') +
      bBtn(CTA, linkData.properties.action_link) +
      bSmall(`This link expires in 24 hours.<br><br>Questions? Contact us at <a href="mailto:info@hexaspace.com.au" style="color:${OLIVE};text-decoration:none">info@hexaspace.com.au</a>`),
      { footerLabel: footerLabel || 'Team Access' }
    ),
  })
  if (!r.ok) return { ok: false, error: 'Email send failed' }

  return { ok: true, email }
}
