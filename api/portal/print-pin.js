// GET /api/portal/print-pin
// Returns the CALLER'S OWN PaperCut print PIN — and no one else's.
//
// Owner-only is enforced by verifying the caller's Supabase access token
// server-side: we resolve the token to a verified email via the Auth admin API and
// look up only that email's pin. Unlike the older ?email= endpoints, the caller
// cannot ask for someone else's pin — the email comes from their signed JWT, not a
// query param. The pin lives in `member_pins` (RLS blocks client reads), so this
// service-role endpoint is the only read path. Never logged.
//
// Call from the app/portal with the logged-in session:
//   fetch('/api/portal/print-pin', { headers: { Authorization: `Bearer ${session.access_token}` } })

import { createClient } from '@supabase/supabase-js'
import { applyCors } from '../_cors.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured.' })

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return res.status(401).json({ error: 'Sign in required.' })

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Resolve the token to a verified user. A forged/expired token fails here.
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
  if (authErr || !user?.email) return res.status(401).json({ error: 'Invalid session.' })

  const email = user.email.toLowerCase()

  // Look up ONLY this verified email's pin + printing balance.
  const { data, error } = await supabase
    .from('member_pins')
    .select('pin, balance, balance_updated_at')
    .eq('email', email)
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'Lookup failed.' })

  // 200 with pin: null when we don't have one yet (member not synced / no PIN set).
  return res.status(200).json({
    pin: data?.pin ?? null,
    balance: data?.balance ?? null,
    balanceUpdatedAt: data?.balance_updated_at ?? null,
  })
}
