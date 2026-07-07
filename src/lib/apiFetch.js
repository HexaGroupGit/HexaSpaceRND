import { supabase } from './supabase.js'

// Builds request headers including the caller's Supabase access token, so
// service-role endpoints can verify who is calling (see api/_auth.js). Use for
// every fetch to an authenticated admin/member endpoint.
export async function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  } catch { /* unauthenticated */ }
  return headers
}
