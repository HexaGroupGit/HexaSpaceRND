// GET /api/google-ads/callback — exchanges the OAuth code for a refresh token
// and stores it server-side (Supabase `meta` table) via the service-role key.
// Requires env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL

function back(res, status) {
  res.writeHead(302, { Location: `/marketing?ads=${status}` })
  res.end()
}

export default async function handler(req, res) {
  const { code, error } = req.query
  if (error) return back(res, 'google_error')
  if (!code) return res.status(400).send('Missing authorization code')

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clientId || !clientSecret || !serviceKey) return res.status(500).send('Google Ads OAuth not fully configured')

  const redirectUri = `https://${req.headers.host}/api/google-ads/callback`

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    })
    const tok = await tokenRes.json()
    if (!tokenRes.ok || !tok.refresh_token) {
      console.error('Google token exchange failed:', tok)
      return back(res, 'google_error')
    }

    const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })
    await supabase.from('meta').upsert({ key: 'google_ads_refresh_token', value: tok.refresh_token })

    return back(res, 'google_connected')
  } catch (err) {
    console.error('Google callback error:', err)
    return back(res, 'google_error')
  }
}
