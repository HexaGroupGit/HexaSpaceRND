// GET /api/google-ads/connect — starts the Google Ads OAuth consent flow.
// Requires env: GOOGLE_OAUTH_CLIENT_ID.

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) return res.status(500).send('GOOGLE_OAUTH_CLIENT_ID not configured')

  const redirectUri = `https://${req.headers.host}/api/google-ads/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/adwords',
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token every time
    include_granted_scopes: 'true',
  })
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  res.end()
}
