import { supabase } from '../../lib/supabase.js'
import { bookingFeeName, isPerkRoom, perkHoursUsed, companyPerk, round2, companyCanAfterHours, resourceBookingWindow } from '../../lib/credits.js'
import { blockingResourceIds } from '../../lib/roomConflicts.js'
import { apiUrl } from './native.js'

// Booking writes for the app — mirrors the portal's PortalCalendar confirm()
// exactly (same bookings/fees/tenants writes, same credit model) so the two
// surfaces stay in lock-step. 1 credit = A$40; overage becomes a Booking Fee
// on the month-end bill. Keep in sync with PortalCalendar.jsx.

export const CREDIT_VALUE = 40

export const toDec = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h + m / 60 }
export const fromDec = (d) => `${String(Math.floor(d)).padStart(2, '0')}:${String(Math.round((d % 1) * 60)).padStart(2, '0')}`
export const overlaps = (aS, aE, bS, bE) => toDec(aS) < toDec(bE) && toDec(bS) < toDec(aE)

// `spaces` (optional) enables physical-conflict awareness: a booking on a
// resource that shares floor space (e.g. the Function Space vs North/South/West)
// counts as occupying this slot too. Omit spaces for plain same-resource checks.
export function isFree(allBookings, resourceId, date, startTime, endTime, spaces) {
  const ids = new Set(blockingResourceIds(resourceId, spaces))
  return !(allBookings ?? []).some((b) =>
    ids.has(b.resourceId) && b.date === date && b.status !== 'Cancelled' &&
    overlaps(startTime, endTime, b.startTime, b.endTime))
}

const monthKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const ROOM_LEAD_MIN = 15 // door/key goes live this many minutes before start

// Booking window in device-local ms (members are in Melbourne, same tz as the
// stored HH:mm times). `openFrom` is when the key goes live (15 min early).
export function bookingWindowMs(b) {
  const from = new Date(`${b.date}T${b.startTime}:00`).getTime()
  const until = new Date(`${b.date}T${b.endTime}:00`).getTime()
  return { from, until, openFrom: from - ROOM_LEAD_MIN * 60000 }
}

// 'past' | 'active' (key live: 15 min before → end) | 'upcoming'.
export function bookingPhase(b) {
  if (!b?.date || !b?.startTime || !b?.endTime) return 'upcoming'
  const { from, until, openFrom } = bookingWindowMs(b)
  const now = Date.now()
  if (now >= until) return 'past'
  if (now >= openFrom) return 'active'
  return 'upcoming'
}

// Amend/cancel are allowed only BEFORE the actual start time — so a live booking
// can't be cancelled for a credit refund once it's under way.
export function canModifyBooking(b) {
  if (!b || b.status === 'Cancelled') return false
  return Date.now() < bookingWindowMs(b).from
}

/** Cancel an upcoming booking: refunds its credits to the company pool. */
export async function cancelBooking({ booking, company }) {
  if (!canModifyBooking(booking)) {
    throw new Error('This booking has already started — it can no longer be cancelled.')
  }
  const nowIso = new Date().toISOString()
  const refund = Number(booking.creditsUsed ?? 0)
  const updated = { ...booking, status: 'Cancelled', cancelledAt: nowIso, creditsUsed: 0 }
  const newBal = Math.round((creditBalance(company) + refund) * 100) / 100
  const updatedCompany = company?.id ? { ...company, creditsRemaining: newBal, creditsPeriod: monthKey() } : company

  const writes = [supabase.from('bookings').upsert({ id: booking.id, data: updated, updated_at: nowIso })]
  if (company?.id && refund > 0) {
    writes.push(supabase.from('tenants').update({ data: updatedCompany, updated_at: nowIso }).eq('id', company.id))
  }
  const results = await Promise.all(writes)
  const dbErr = results.find((r) => r.error)?.error
  if (dbErr) throw new Error(dbErr.message)

  // Fire-and-forget: tell ops + re-sweep Salto so the room-access grant is removed.
  ;(async () => {
    try {
      const { authHeaders } = await import('../../lib/apiFetch.js')
      const headers = await authHeaders()
      await fetch(apiUrl('/api/portal/notify-booking'), { method: 'POST', headers, body: JSON.stringify({ bookingId: booking.id, kind: 'cancelled' }) })
      await fetch(apiUrl('/api/salto/room-access'), { method: 'POST', headers })
    } catch { /* best-effort */ }
  })()

  return { booking: updated, company: updatedCompany, refund }
}

/**
 * Change the time (same room) of an upcoming booking. Refunds the old credits,
 * re-prices the new window, adjusts the pool and raises a Booking Fee for any
 * overage — the amend mirror of createBooking (keep in sync).
 */
export async function amendBooking({ booking, room, date, startTime, endTime, member, company, allBookings, leases, spaces, settings }) {
  if (!canModifyBooking(booking)) {
    throw new Error('This booking has already started — its time can no longer be changed.')
  }
  // Clash check (conflict-aware), excluding this booking itself.
  const ids = new Set(blockingResourceIds(room.id, spaces))
  const clash = (allBookings ?? []).some((b) =>
    b.id !== booking.id && ids.has(b.resourceId) && b.date === date && b.status !== 'Cancelled' &&
    overlaps(startTime, endTime, b.startTime, b.endTime))
  if (clash) throw new Error('That time was just taken — please choose another slot.')

  const hrs = Math.max(0, toDec(endTime) - toDec(startTime))
  if (hrs <= 0) throw new Error('The end time must be after the start time.')

  const canAfterHours = companyCanAfterHours(company?.id, leases, spaces, settings)
  const win = resourceBookingWindow(room, canAfterHours, settings)
  const hLabel = (h) => `${(h % 12) || 12}${h >= 12 ? 'pm' : 'am'}`
  if (toDec(startTime) < win.start || toDec(endTime) > win.end) {
    throw new Error(win.studioGated
      ? `Studios can be booked between ${hLabel(win.start)} and ${hLabel(win.end)}.`
      : canAfterHours
        ? `Bookings are available from ${hLabel(win.start)} to ${hLabel(win.end)}.`
        : `That's outside business hours (${hLabel(win.start)}–${hLabel(win.end)}).`)
  }

  const perk = companyPerk(company?.id, leases, spaces, settings)
  const isPerk = isPerkRoom(room, perk)
  if (isPerk) {
    if (hrs > perk.maxHoursPerBooking) throw new Error(`${room.unitNumber} is included with your membership — up to ${perk.maxHoursPerBooking}h per booking.`)
    const usedToday = perkHoursUsed({ companyId: company?.id, date, bookings: allBookings, perk, spaces, excludeIds: [booking.id] })
    if (usedToday + hrs > perk.maxHoursPerDay) {
      throw new Error(`Your membership includes up to ${perk.maxHoursPerDay}h/day in these rooms — you have ${round2(Math.max(0, perk.maxHoursPerDay - usedToday))}h left today.`)
    }
  }

  const rate = room.hourlyRate ?? room.rate ?? 0
  const cost = isPerk ? 0 : hrs * rate
  const perCredits = Math.round((cost / CREDIT_VALUE) * 100) / 100
  // Refund the old credits first, then re-charge the new window from that pool.
  const oldUsed = Number(booking.creditsUsed ?? 0)
  const basePool = Math.round((creditBalance(company) + oldUsed) * 100) / 100
  const used = isPerk ? 0 : Math.max(0, Math.min(basePool, perCredits))
  const newBal = isPerk ? basePool : Math.round((basePool - used) * 100) / 100
  const shortfall = isPerk ? 0 : Math.round((perCredits - used) * 100) / 100

  const nowIso = new Date().toISOString()
  const updated = {
    ...booking, date, startTime, endTime,
    creditsUsed: used,
    paidBy: isPerk ? 'included' : (shortfall > 0 ? (used > 0 ? 'part_credits' : 'fee') : 'credits'),
    status: 'Confirmed', amendedAt: nowIso,
    // Time changed → re-queue the door-access grant for the new window.
    roomAccessSentAt: null, roomAccessRemovedAt: null,
  }
  const updatedCompany = (!isPerk && company?.id)
    ? { ...company, creditsRemaining: newBal, creditsPeriod: monthKey() }
    : company

  const writes = [supabase.from('bookings').upsert({ id: booking.id, data: updated, updated_at: nowIso })]
  if (!isPerk && company?.id) {
    writes.push(supabase.from('tenants').update({ data: updatedCompany, updated_at: nowIso }).eq('id', company.id))
  }
  let fee = null
  if (!isPerk && shortfall > 0 && company?.id) {
    const feeId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    fee = {
      id: feeId,
      name: bookingFeeName({ roomName: room.unitNumber, rate, date, startTime, endTime, usedCredits: used }),
      type: 'Booking Fee', memberId: member?.id ?? null, companyId: company.id,
      date: new Date().toISOString().split('T')[0],
      price: Math.round(shortfall * CREDIT_VALUE * 100) / 100,
      status: 'Not Paid', notes: `Amended booking · ${shortfall} credits over allowance`,
      createdAt: new Date().toISOString().split('T')[0],
    }
    writes.push(supabase.from('fees').upsert({ id: feeId, data: fee, updated_at: nowIso }))
  }

  const results = await Promise.all(writes)
  const dbErr = results.find((r) => r.error)?.error
  if (dbErr) throw new Error(dbErr.message)

  ;(async () => {
    try {
      const { authHeaders } = await import('../../lib/apiFetch.js')
      const headers = await authHeaders()
      await fetch(apiUrl('/api/portal/notify-booking'), { method: 'POST', headers, body: JSON.stringify({ bookingId: booking.id, kind: 'amended' }) })
      await new Promise((r) => setTimeout(r, 1200))
      await fetch(apiUrl('/api/salto/room-access'), { method: 'POST', headers })
    } catch { /* best-effort */ }
  })()

  return { booking: updated, company: updatedCompany, fee }
}

/** Company credit balance right now (monthly pool, resets on a new month). */
export function creditBalance(company) {
  return company?.creditsPeriod === monthKey()
    ? Number(company?.creditsRemaining ?? 0)
    : Number(company?.monthlyAllowance ?? company?.creditsRemaining ?? 0)
}

/**
 * Create a single booking request: writes the booking, deducts the company's
 * credit pool, raises a Booking Fee for any overage.
 * Returns { booking, company: updatedCompany, fee } — throws on clash/db error.
 */
export async function createBooking({ room, date, startTime, endTime, title, member, company, allBookings, leases, spaces, settings }) {
  if (!isFree(allBookings, room.id, date, startTime, endTime, spaces)) {
    throw new Error('That time was just taken — please choose another slot.')
  }

  const hrs = Math.max(0, toDec(endTime) - toDec(startTime))

  // Booking window: everyone gets core hours; only 24/7 memberships reach the
  // extended (after-hours) window — except studios, which gate to business
  // hours for all members, same as external bookings.
  const canAfterHours = companyCanAfterHours(company?.id, leases, spaces, settings)
  const win = resourceBookingWindow(room, canAfterHours, settings)
  const hLabel = (h) => `${(h % 12) || 12}${h >= 12 ? 'pm' : 'am'}`
  if (toDec(startTime) < win.start || toDec(endTime) > win.end) {
    throw new Error(win.studioGated
      ? `Studios can be booked between ${hLabel(win.start)} and ${hLabel(win.end)} — the same hours as external bookings.`
      : canAfterHours
        ? `Bookings are available from ${hLabel(win.start)} to ${hLabel(win.end)}.`
        : `That's outside business hours (${hLabel(win.start)}–${hLabel(win.end)}). After-hours booking is included with Private Office & Dedicated Desk memberships.`)
  }

  // Office perk: private-office (suite) companies book Sky/Earth/Sun/Moon free,
  // capped per booking + per company per day.
  const perk = companyPerk(company?.id, leases, spaces, settings)
  const isPerk = isPerkRoom(room, perk)
  if (isPerk) {
    if (hrs > perk.maxHoursPerBooking) throw new Error(`${room.unitNumber} is included with your membership — up to ${perk.maxHoursPerBooking}h per booking.`)
    const usedToday = perkHoursUsed({ companyId: company?.id, date, bookings: allBookings, perk, spaces })
    if (usedToday + hrs > perk.maxHoursPerDay) {
      throw new Error(`Your membership includes up to ${perk.maxHoursPerDay}h/day in these rooms — you have ${round2(Math.max(0, perk.maxHoursPerDay - usedToday))}h left today.`)
    }
  }

  const rate = room.hourlyRate ?? room.rate ?? 0
  const cost = isPerk ? 0 : hrs * rate
  const perCredits = Math.round((cost / CREDIT_VALUE) * 100) / 100

  const bal = creditBalance(company)
  const used = isPerk ? 0 : Math.max(0, Math.min(bal, perCredits))
  const newBal = isPerk ? bal : Math.round((bal - used) * 100) / 100
  const shortfall = isPerk ? 0 : Math.round((perCredits - used) * 100) / 100

  const booking = {
    id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    reference: `BKG-${Math.floor(100000 + Math.random() * 900000)}`,
    resourceId: room.id, memberId: member?.id ?? '', companyId: company?.id ?? '',
    date, startTime, endTime, title: title || '',
    status: 'Confirmed', source: 'Portal', repeat: 'none', createdBy: 'Member',
    createdAt: new Date().toISOString().split('T')[0],
    creditsUsed: used,
    paidBy: isPerk ? 'included' : (shortfall > 0 ? (used > 0 ? 'part_credits' : 'fee') : 'credits'),
  }

  const nowIso = new Date().toISOString()
  const updatedCompany = (!isPerk && company?.id)
    ? { ...company, creditsRemaining: newBal, creditsPeriod: monthKey() }
    : company

  const writes = [supabase.from('bookings').upsert({ id: booking.id, data: booking, updated_at: nowIso })]
  if (!isPerk && company?.id) {
    // update, not upsert: members have UPDATE-only RLS on tenants.
    writes.push(supabase.from('tenants').update({ data: updatedCompany, updated_at: nowIso }).eq('id', company.id))
  }

  let fee = null
  if (!isPerk && shortfall > 0 && company?.id) {
    const feeId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    fee = {
      id: feeId,
      name: bookingFeeName({
        roomName: room.unitNumber, rate, date, startTime, endTime, usedCredits: used,
      }),
      type: 'Booking Fee', memberId: member?.id ?? null, companyId: company.id,
      date: new Date().toISOString().split('T')[0],
      price: Math.round(shortfall * CREDIT_VALUE * 100) / 100,
      status: 'Not Paid', notes: `Portal booking · ${shortfall} credits over allowance`,
      createdAt: new Date().toISOString().split('T')[0],
    }
    writes.push(supabase.from('fees').upsert({ id: feeId, data: fee, updated_at: nowIso }))
  }

  const results = await Promise.all(writes)
  const dbErr = results.find((r) => r.error)?.error
  if (dbErr) throw new Error(dbErr.message)

  // Fire-and-forget: ops notification + queue the Salto room-access zap
  // (bookings are auto-confirmed, so access schedules immediately).
  ;(async () => {
    try {
      const { authHeaders } = await import('../../lib/apiFetch.js')
      const headers = await authHeaders()
      await fetch(apiUrl('/api/portal/notify-booking'), {
        method: 'POST', headers,
        body: JSON.stringify({ bookingId: booking.id, kind: 'new' }),
      })
      await new Promise((r) => setTimeout(r, 1500))
      await fetch(apiUrl('/api/salto/room-access'), { method: 'POST', headers })
    } catch { /* best-effort; hourly cron catches up */ }
  })()

  return { booking, company: updatedCompany, fee }
}
