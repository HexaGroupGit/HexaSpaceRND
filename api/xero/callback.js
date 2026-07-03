// GET /api/xero/callback — exchanges the OAuth code for tokens, resolves the
// Xero organisation (tenant), and stores the connection server-side.
// Requires env: XERO_CLIENT_ID, XERO_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY.

import { XERO_TOKEN_URL, XERO_CONNECTIONS_URL, basicAuth, getSupabase, saveConnection } from './_client.js'

function back(res, status) {
  res.writeHead(302, { Location: `/settings?section=xero&xero=${status}` })
  res.end()
}

export default async function handler(req, res) {
  const { code, error } = req.query
  if (error) return back(res, 'error')
  if (!code) return res.status(400).send('Missing authorization code')

  if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) {
    return res.status(500).send('Xero OAuth not fully configured')
  }

  const redirectUri = `https://${req.headers.host}/api/xero/callback`

  try {
    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    })
    const tok = await tokenRes.json()
    if (!tokenRes.ok || !tok.access_token || !tok.refresh_token) {
      console.error('Xero token exchange failed:', tok)
      return back(res, 'error')
    }

    // Resolve which organisation this token can act on.
    const connRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    })
    const tenants = await connRes.json()
    const tenant = Array.isArray(tenants) ? tenants.find((t) => t.tenantType === 'ORGANISATION') ?? tenants[0] : null
    if (!tenant) {
      console.error('Xero connections lookup failed:', tenants)
      return back(res, 'error')
    }

    const supabase = getSupabase()
    await saveConnection(supabase, {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: Date.now() + (tok.expires_in ?? 1800) * 1000,
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      connectionId: tenant.id,
      connectedAt: new Date().toISOString(),
    })

    return back(res, 'connected')
  } catch (err) {
    console.error('Xero callback error:', err)
    return back(res, 'error')
  }
}
