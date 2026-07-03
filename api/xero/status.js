// GET /api/xero/status — connection state for the Settings UI.
// Never returns tokens; only org name and sync bookkeeping.

import { getSupabase, loadConnection } from './_client.js'

export default async function handler(req, res) {
  const configured = !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(200).json({ configured, connected: false })

  try {
    const supabase = getSupabase()
    const conn = await loadConnection(supabase)
    return res.status(200).json({
      configured,
      connected: !!conn?.refreshToken,
      tenantName: conn?.tenantName ?? null,
      connectedAt: conn?.connectedAt ?? null,
      lastPush: conn?.lastPush ?? null,
      lastPull: conn?.lastPull ?? null,
    })
  } catch (err) {
    return res.status(200).json({ configured, connected: false, error: err.message })
  }
}
