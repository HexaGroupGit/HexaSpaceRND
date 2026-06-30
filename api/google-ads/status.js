// GET /api/google-ads/status — reports whether a Google Ads refresh token is stored.
// Requires env: SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(200).json({ connected: false, configured: false })

  // Also report whether the server-side credentials are present (so the UI can
  // tell "not configured" from "configured but not connected").
  const configured = !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_ADS_DEVELOPER_TOKEN)

  try {
    const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })
    const { data } = await supabase.from('meta').select('key,value').eq('key', 'google_ads_refresh_token')
    const connected = !!data?.[0]?.value
    return res.status(200).json({ connected, configured })
  } catch (err) {
    console.error('Google status error:', err)
    return res.status(200).json({ connected: false, configured })
  }
}
