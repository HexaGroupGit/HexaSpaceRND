// POST /api/xero/disconnect — revokes the Xero connection and deletes the
// stored tokens. Safe to call even if the remote revoke fails (tokens are
// removed locally either way).

import { XERO_CONNECTIONS_URL, getSupabase, loadConnection, getAccessToken } from './_client.js'
import { requireAdmin } from '../_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Admin-only: tearing down the Xero integration.
  const auth = await requireAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  try {
    const supabase = getSupabase()
    const conn = await loadConnection(supabase)
    if (!conn) return res.status(200).json({ disconnected: true })

    // Best-effort remote revoke of the org connection.
    if (conn.connectionId) {
      try {
        const { accessToken } = await getAccessToken(supabase)
        await fetch(`${XERO_CONNECTIONS_URL}/${conn.connectionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      } catch (err) {
        console.error('Xero remote revoke failed (continuing):', err.message)
      }
    }

    const { error } = await supabase.from('integrations').delete().eq('id', 'xero')
    if (error) throw new Error(error.message)
    return res.status(200).json({ disconnected: true })
  } catch (err) {
    console.error('Xero disconnect error:', err)
    return res.status(500).json({ error: err.message })
  }
}
