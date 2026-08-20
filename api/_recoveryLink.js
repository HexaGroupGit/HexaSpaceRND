// Shared "set your password" link minting for invites and password resets.
//
// WHY THIS EXISTS
// Supabase's own action_link (…/auth/v1/verify?token=…) is consumed by a single
// plain GET — no JavaScript required. Corporate mail security (Outlook/Defender
// SafeLinks, Mimecast, Proofpoint), link previewers and prefetching proxies all
// fetch links in the background, which burns the one-time token BEFORE the
// member clicks. Their click then lands on the portal with
// `#error=access_denied&error_code=otp_expired`, i.e. straight back at login.
//
// Instead we hand out the token_hash in the URL FRAGMENT of our own page.
// Fragments are never transmitted to any server, so scanners that fetch the URL
// get nothing to burn; the token is only redeemed when the member actually
// submits their new password (see src/components/SetPasswordPage.jsx).
export const DEFAULT_PORTAL = 'https://portal.hexaspace.com.au'

/**
 * Builds the public page URL that redeems a token_hash.
 *
 * `base` may carry a path (some invites want the member to land somewhere
 * specific, e.g. …/function-space). That path can't stay in front of our route,
 * so it travels as ?next= and the page forwards there once the password is set.
 */
export function setPasswordUrl(base, hashedToken, { path = '/set-password' } = {}) {
  const u = new URL(String(base || DEFAULT_PORTAL))
  const dest = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/+$/, '') + u.search : ''
  const next = dest ? `?next=${encodeURIComponent(dest)}` : ''
  return `${u.origin}${path}${next}#t=${encodeURIComponent(hashedToken)}`
}

/**
 * Mints a recovery token for `email` and returns a scanner-safe set-password URL.
 * Returns { url } or { error } — callers decide how much to reveal.
 *
 * NOTE: each call invalidates every earlier recovery token for that user, so
 * only the most recent email ever works. Say so in the email copy.
 */
export async function mintSetPasswordLink(admin, email, base = DEFAULT_PORTAL, opts = {}) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    // Only used by the legacy fallback below, but must stay a valid redirect.
    options: { redirectTo: String(base || DEFAULT_PORTAL) },
  })
  if (error) return { error }
  const props = data?.properties ?? {}
  // Fall back to the old verify link only if Auth didn't return a hashed token.
  const url = props.hashed_token ? setPasswordUrl(base, props.hashed_token, opts) : props.action_link
  if (!url) return { error: new Error('Auth returned no recovery link.') }
  return { url }
}
