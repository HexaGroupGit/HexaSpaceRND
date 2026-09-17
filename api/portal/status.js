// GET /api/portal/status?email=xxx
// Returns the portal membership status for a given email:
//   not_invited | invited (never signed in) | active | revoked
// 'revoked' = the login is banned, or every member record for the email has
// portal access switched off (offboarded / removed). Signing in then lands on
// "Your membership has ended", so the admin UI must offer a re-invite, not
// report "Active Member".
import { createClient } from '@supabase/supabase-js'
import { findAuthUser, isBanned } from '../_invite.js'
import { isLiveMember } from '../../src/lib/memberAccess.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured.' })

  // Admin-only: this is a membership/enumeration oracle over all users.
  const { requireAdmin } = await import('../_auth.js')
  const _a = await requireAdmin(req)
  if (_a.error) return res.status(_a.status).json({ error: _a.error })

  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'Email required.' })

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const target = String(email).trim().toLowerCase()
  let user
  try { user = await findAuthUser(admin, target) } catch (e) { return res.status(500).json({ error: e.message }) }

  if (!user) return res.status(200).json({ status: 'not_invited' })

  const { data: rows } = await admin.from('members').select('data').ilike('data->>email', target)
  const records = (rows ?? []).map((r) => r.data).filter((m) => String(m?.email ?? '').trim().toLowerCase() === target)
  if (isBanned(user) || (records.length && !records.some(isLiveMember))) {
    return res.status(200).json({ status: 'revoked', lastSignIn: user.last_sign_in_at ?? null })
  }
  if (user.last_sign_in_at) return res.status(200).json({ status: 'active', lastSignIn: user.last_sign_in_at })
  return res.status(200).json({ status: 'invited', invitedAt: user.created_at })
}
