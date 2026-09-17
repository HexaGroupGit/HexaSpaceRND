// Portal-invite core: creates the Supabase auth user and sends the branded
// "set your password" email. Shared by POST /api/auth/invite and the daily
// reconcile cron so both paths grant portal access identically.
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from './_email.js'
import { brandFrame, bKicker, bH2, bP, bBtn, bSmall, bPanel, OLIVE } from './_brand.js'
import { mintSetPasswordLink } from './_recoveryLink.js'
import { isLiveMember } from '../src/lib/memberAccess.js'

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

// Admin API has no email lookup — page through users (bounded, as revoke does).
export async function findAuthUser(admin, email) {
  const target = String(email ?? '').trim().toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const users = data?.users ?? []
    const hit = users.find((u) => u.email?.toLowerCase() === target)
    if (hit) return hit
    if (users.length < 200) return null
  }
  return null
}

export const isBanned = (u) => !!u?.banned_until && new Date(u.banned_until) > new Date()

// Offboarding (and a teammate removal) bans the login for ten years and
// switches portalAccess off on the member record. Inviting that person again
// is an admin saying "let them back in" — without this the set-password link
// is dead and, once in, the portal shows "Your membership has ended".
async function liftBan(admin, email) {
  const user = await findAuthUser(admin, email)
  if (!isBanned(user)) return false
  const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: 'none' })
  if (error) throw new Error(`Could not lift the login ban: ${error.message}`)
  return true
}

// Switch the member record back on for `companyId` (the company the invite is
// for). One record per company: if a live one already exists, leave the old
// removed duplicates alone; otherwise restore the newest. Returns the patches
// written so the admin app can apply them to its in-memory copy — a stale copy
// saved later would switch access off again.
async function restoreMemberRecords(admin, email, companyId) {
  if (!companyId) return []
  const { data, error } = await admin.from('members').select('id, data').ilike('data->>email', email)
  if (error) throw new Error(`Could not read member records: ${error.message}`)
  const rows = (data ?? [])
    .map((r) => ({ ...r.data, id: r.id }))
    .filter((m) => String(m.email ?? '').trim().toLowerCase() === email && m.companyId === companyId)
  if (!rows.length || rows.some(isLiveMember)) return []
  const target = rows.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0]
  if (target.status === 'archived') return []
  const now = new Date().toISOString()
  const patch = {
    portalAccess: true, portalInviteFailed: false, portalAccessRestoredAt: now,
    ...(target.status === 'Former' ? { status: 'Auto' } : {}),
  }
  const { error: upErr } = await admin.from('members').update({ data: { ...target, ...patch }, updated_at: now }).eq('id', target.id)
  if (upErr) throw new Error(`Could not restore portal access: ${upErr.message}`)
  return [{ id: target.id, patch }]
}

// Returns { ok: true, email, restored } or { ok: false, error }.
// greeting/extraHtml/footerLabel are optional overrides used by the portal
// migration bulk-invite; defaults preserve the original invite exactly.
// restore: { companyId } — an explicit (re)invite: lift any login ban and, when
// companyId is given, switch that company's member record back on.
export async function invitePortalUser({ email: rawEmail, redirectTo, subject, heading, greeting, intro, extraHtml, ctaLabel, footerLabel, restore = null }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!serviceKey) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' }
  if (!resendKey) return { ok: false, error: 'RESEND_API_KEY not configured.' }
  // Typed-in addresses carry stray spaces and capitals; Supabase rejects those
  // outright ("Unable to validate email address: invalid format"). Normalise
  // the same way bulk-invite does, and say something useful if it's still junk.
  const email = String(rawEmail ?? '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'Email is required.', status: 400 }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: `"${rawEmail}" doesn't look like a valid email address.`, status: 400 }
  }

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

  // Before minting the link: a banned user's link can't be used.
  if (restore) {
    try { await liftBan(admin, email) } catch (e) { return { ok: false, error: e.message } }
  }

  // Points at our own /set-password page with the one-time token in the URL
  // fragment, so mail scanners can't spend the link before the invitee clicks.
  const { url: setPasswordLink, error: linkErr } = await mintSetPasswordLink(admin, email, REDIRECT)
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
      bBtn(CTA, setPasswordLink) +
      bSmall(`This link expires in 24 hours and can be used once — if you get more than one of these emails, only the newest link works.<br><br>Questions? Contact us at <a href="mailto:info@hexaspace.com.au" style="color:${OLIVE};text-decoration:none">info@hexaspace.com.au</a>`),
      { footerLabel: footerLabel || 'Team Access' }
    ),
  })
  if (!r.ok) return { ok: false, error: 'Email send failed' }

  let restored = []
  if (restore?.companyId) {
    try { restored = await restoreMemberRecords(admin, email, restore.companyId) }
    catch (e) { return { ok: false, error: `Invite sent, but ${e.message.charAt(0).toLowerCase()}${e.message.slice(1)}` } }
  }
  return { ok: true, email, restored }
}
