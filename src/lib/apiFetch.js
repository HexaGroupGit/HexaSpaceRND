import { supabase } from './supabase.js'

// Builds request headers including the caller's Supabase access token, so
// service-role endpoints can verify who is calling (see api/_auth.js). Use for
// every fetch to an authenticated admin/member endpoint.
export async function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  try {
    let { data: { session } } = await supabase.auth.getSession()
    // A manual fetch doesn't get the automatic pre-request token refresh that
    // supabase.from() queries enjoy, so after ~1h the stored access token is
    // expired and the server rejects it ("Sign in required"). Refresh it here
    // when it's missing or within 60s of expiry.
    const now = Math.floor(Date.now() / 1000)
    if (!session || (session.expires_at && session.expires_at - now < 60)) {
      const { data } = await supabase.auth.refreshSession()
      if (data?.session) session = data.session
    }
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  } catch { /* unauthenticated */ }
  return headers
}
