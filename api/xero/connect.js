// GET /api/xero/connect — starts the Xero OAuth consent flow.
// Requires env: XERO_CLIENT_ID (and XERO_CLIENT_SECRET for the callback).
//
// The redirect URI must be registered on the app at developer.xero.com:
//   https://<your-domain>/api/xero/callback

import { XERO_AUTH_URL, XERO_SCOPES } from './_client.js'

export default function handler(req, res) {
  const clientId = process.env.XERO_CLIENT_ID
  if (!clientId) return res.status(500).send('XERO_CLIENT_ID not configured')

  const redirectUri = `https://${req.headers.host}/api/xero/callback`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: XERO_SCOPES,
    state: Math.random().toString(36).slice(2),
  })
  res.writeHead(302, { Location: `${XERO_AUTH_URL}?${params.toString()}` })
  res.end()
}
