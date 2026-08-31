// POST /api/bookings/access-request  { id }
// Building-unlock (front door + lift) request for a room booking that runs
// outside the building's staffed hours — in practice a Saturday or Sunday
// meeting-room booking, where the lift won't take anyone to Level 4 unless
// building management programs it.
//
// Unlike the function-booking equivalent this is a plain manual button: staff
// press it when they want the request to go, rather than it being scheduled off
// a lead time. Functions are booked weeks out; a room booking often isn't, so
// there is nothing useful to schedule against.
//
// Admin-gated. The function-booking endpoint next door is not, which is a hole
// worth closing separately — this one should not copy it.
import { createClient } from '@supabase/supabase-js'
import { applyCors } from '../_cors.js'
import { requireAdmin } from '../_auth.js'
import {
  OPEN, CLOSE, esc, shape, to12, melbourneToday, sendAccessRequestEmail,
} from '../_buildingAccess.js'
import { bufferedWindow, isWeekendDate } from '../../src/lib/functionBooking.js'

const SUPABASE_URL = process.env.SUPABASE_URL

// Same rule the function bookings use: any weekend, or a ±30-min buffered
// window that starts before the building opens or ends after it closes.
export function roomAccessWindow(booking) {
  if (!booking?.date || !booking?.startTime || !booking?.endTime) return null
  const { blockStart, blockEnd } = bufferedWindow(booking.startTime, booking.endTime)
  const weekend = isWeekendDate(booking.date)
  const afterHours = weekend || blockStart < OPEN || blockEnd > CLOSE
  if (!afterHours) return null
  return { date: booking.date, startTime: booking.startTime, endTime: booking.endTime, blockStart, blockEnd, weekend }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })

  const { id } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'Missing id' })

  try {
    const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })
    const { data: rows } = await supabase.from('bookings').select('data').eq('id', id)
    const b = rows?.[0]?.data
    if (!b) return res.status(404).json({ error: 'Booking not found' })
    if (b.status === 'Cancelled') {
      return res.status(400).json({ error: 'This booking is cancelled — nothing to unlock for.' })
    }
    if (b.date < melbourneToday()) {
      return res.status(400).json({ error: 'This booking has already been and gone.' })
    }

    const w = roomAccessWindow(b)
    if (!w) {
      return res.status(200).json({
        success: true, needed: false,
        note: `This booking sits inside staffed hours (${to12(OPEN)}–${to12(CLOSE)}, weekdays) — the lift is already running, so no request is needed.`,
      })
    }

    // Who and what, for the building manager's reference.
    const [{ data: spaceRows }, { data: tenantRows }, { data: memberRows }] = await Promise.all([
      supabase.from('spaces').select('data').eq('id', b.resourceId),
      b.companyId ? supabase.from('tenants').select('data').eq('id', b.companyId) : Promise.resolve({ data: [] }),
      b.memberId ? supabase.from('members').select('data').eq('id', b.memberId) : Promise.resolve({ data: [] }),
    ])
    const roomName = spaceRows?.[0]?.data?.unitNumber || 'Meeting room'
    const who = tenantRows?.[0]?.data?.businessName || memberRows?.[0]?.data?.name || ''

    await sendAccessRequestEmail({
      windows: [{ ...w, note: `${to12(w.startTime)} – ${to12(w.endTime)} booking · 30-min buffer each side` }],
      what: `a confirmed room booking`,
      detailsHtml: `Room: <strong>${esc(roomName)}</strong>${b.reference ? ` · ref ${esc(b.reference)}` : ''}${who ? ` · booked by ${esc(who)}` : ''}<br/>
        Hexa Space contact: info@hexaspace.com.au`,
    })

    const sentAt = new Date().toISOString()
    const sends = [...(b.accessRequestSends ?? []), { sentAt, date: w.date, by: auth.user?.email ?? '' }]
    await supabase.from('bookings').upsert({
      id,
      data: { ...b, accessRequestSentAt: sentAt, accessRequestSends: sends, accessRequestWindow: shape(w) },
      updated_at: sentAt,
    })

    return res.status(200).json({
      success: true, needed: true, sentAt, weekend: w.weekend,
      window: shape(w), resent: (b.accessRequestSends ?? []).length > 0,
    })
  } catch (err) {
    if (err?.message === 'Email send failed.') return res.status(502).json({ error: 'Email send failed.' })
    console.error('bookings/access-request error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
