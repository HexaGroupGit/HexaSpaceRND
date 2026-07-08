// POST /api/papercut/pins
// Ingests members' PaperCut login PINs (pushed by the on-prem connector's
// sync-pins script) into the ACCESS-CONTROLLED `member_pins` table. Members later
// read their OWN pin via GET /api/portal/print-pin (JWT-verified, owner-only).
//
// WHY A SEPARATE TABLE, NOT the members row: the app and portal both fetch the
// ENTIRE members table into the browser (src/app/lib/useMemberData.js,
// src/portal/PortalApp.jsx). Anything on a member row is readable by every logged-in
// member. A PIN is a credential, so it lives in `member_pins`, which has RLS that
// denies all anon/authenticated reads — only the service role (this endpoint and
// print-pin) can touch it. See docs/papercut-integration.md.
//
// SECURITY: never log/echo a pin. Auth is the shared PAPERCUT_SYNC_TOKEN (same as
// the billing sync). Mock/no-op when unconfigured.

import { createClient } from '@supabase/supabase-js'
import { applyCors } from '../_cors.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.PAPERCUT_SYNC_TOKEN
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const { pins } = req.body ?? {}
  // pins: [{ email, pin, balance? }] — balance is the member's PaperCut
  // personal-account balance in dollars, shown to them in the portal/app.
  if (!Array.isArray(pins)) {
    return res.status(400).json({ error: 'pins must be an array of { email, pin }.' })
  }

  if (token) {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (bearer !== token) return res.status(401).json({ error: 'Invalid PaperCut sync token.' })
  }

  // Normalise, drop empties. Count only — NEVER put a pin in the response or a log.
  const rows = pins
    .filter((p) => p?.email && p?.pin != null && String(p.pin).length > 0)
    .map((p) => ({
      email: String(p.email).toLowerCase(),
      pin: String(p.pin),
      balance: Number.isFinite(Number(p.balance)) && p.balance !== null && p.balance !== '' ? Number(p.balance) : undefined,
    }))

  if (!token || !serviceKey) {
    return res.status(200).json({
      mock: true,
      received: pins.length,
      wouldStore: rows.length,
      note: 'PaperCut not configured — mock only, nothing stored. Set PAPERCUT_SYNC_TOKEN + SUPABASE_SERVICE_ROLE_KEY.',
    })
  }

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const nowIso = new Date().toISOString()
  let stored = 0
  const failed = []
  for (const row of rows) {
    // Upsert on email (primary key of member_pins). Do not surface the pin on error.
    // Balance is only written when the push includes one, so a pins-only sync
    // never wipes a previously synced balance.
    const { error } = await supabase
      .from('member_pins')
      .upsert({
        email: row.email, pin: row.pin, updated_at: nowIso,
        ...(row.balance !== undefined ? { balance: row.balance, balance_updated_at: nowIso } : {}),
      }, { onConflict: 'email' })
    if (error) failed.push({ email: row.email, reason: error.message })
    else stored += 1
  }

  return res.status(200).json({ ok: true, stored, failed: failed.length, failedDetail: failed })
}
