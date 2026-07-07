// POST /api/auth/revoke — disables portal login for an email (offboarding).
// Bans the Supabase auth user rather than deleting them, so history and the
// account can be restored if the tenant comes back.
import { requireAdmin } from '../_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Admin-only: banning an account is an offboarding action.
  const auth = await requireAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const admin = auth.sb

  const { email } = req.body ?? {}
  if (!email) return res.status(400).json({ error: 'Email is required.' })

  try {
    // Admin API has no direct email lookup — page through users (bounded).
    const target = String(email).toLowerCase()
    let user = null
    for (let page = 1; page <= 20 && !user; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) return res.status(500).json({ error: error.message })
      user = (data?.users ?? []).find((u) => u.email?.toLowerCase() === target) ?? null
      if ((data?.users ?? []).length < 200) break
    }
    // No auth user was ever created (invite never sent/claimed) — nothing to revoke.
    if (!user) return res.status(200).json({ success: true, email, note: 'No auth user found' })

    const { error: banErr } = await admin.auth.admin.updateUserById(user.id, { ban_duration: '87600h' }) // ~10 years
    if (banErr) return res.status(500).json({ error: banErr.message })

    return res.status(200).json({ success: true, email })
  } catch (err) {
    console.error('auth revoke error:', err)
    return res.status(500).json({ error: err.message })
  }
}
