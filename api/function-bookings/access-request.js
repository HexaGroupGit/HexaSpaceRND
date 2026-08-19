// POST /api/function-bookings/access-request  { id, force? }
// Building-unlock (front door + lift) request for after-hours function sessions.
// Fired on confirm and from the admin hub; the real work — including the
// "3 business days before the event" scheduling rule — lives in
// _accessRequest.js so the daily cron can release held requests too.
// force=true sends immediately (e.g. after a time change, or an admin who wants
// it out now).
import { createClient } from '@supabase/supabase-js'
import { sendAccessRequest } from './_accessRequest.js'
import { applyCors } from '../_cors.js'

const SUPABASE_URL = process.env.SUPABASE_URL

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })

  const { id, force } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'Missing id' })

  try {
    const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })
    const { data: rows } = await supabase.from('function_bookings').select('data').eq('id', id)
    const b = rows?.[0]?.data
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    if (!(b.stage === 'confirmed' || b.depositPaid)) {
      return res.status(400).json({ error: 'Deposit not confirmed yet — access is requested once the venue is secured.' })
    }

    const r = await sendAccessRequest({ supabase, booking: b, force: !!force })
    switch (r.status) {
      case 'not-needed': return res.status(200).json({ success: true, needed: false, note: r.note })
      case 'already': return res.status(200).json({ success: true, already: true, sentAt: r.sentAt })
      case 'scheduled': return res.status(200).json({ success: true, needed: true, scheduled: true, sendOn: r.sendOn, leadDays: r.leadDays, windows: r.windows })
      default: return res.status(200).json({ success: true, needed: true, sentAt: r.sentAt, windows: r.windows })
    }
  } catch (err) {
    if (err?.message === 'Email send failed.') return res.status(502).json({ error: 'Email send failed.' })
    console.error('access-request error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
