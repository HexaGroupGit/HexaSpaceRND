// GET /api/portal/status?email=xxx
// Returns the portal membership status for a given email.
import { createClient } from '@supabase/supabase-js'

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

  const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return res.status(500).json({ error: error.message })

  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (!user) return res.status(200).json({ status: 'not_invited' })
  if (user.last_sign_in_at) return res.status(200).json({ status: 'active', lastSignIn: user.last_sign_in_at })
  return res.status(200).json({ status: 'invited', invitedAt: user.created_at })
}
