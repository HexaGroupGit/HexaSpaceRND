// Cancelling a podcast studio session — the server half, shared by
// api/studio/cancel.js (every current surface) and api/portal/notify-booking.js
// (older app builds that still flip the status themselves, then notify).
//
// WHY the server does it: a confirmed session carries a Booking Fee, raised by
// the admin's approval (StudioRequests.jsx → raiseCharge). Members can INSERT
// fees under RLS but never UPDATE them, so a member who cancelled from the
// portal or the app freed the slot and still found the fee on their month-end
// invoice. Cancelling before the session starts is free, so the fee has to be
// waived here, with the service role.
//
// A fee that has already gone out on an invoice (or been paid) is NOT touched:
// pulling a line off an issued invoice silently would leave Xero and the client's
// copy disagreeing. It is reported back instead, and the studio team is told to
// raise a credit note.
import { sendResendEmail } from './_email.js'
import { brandFrame, bKicker, bH1, bP, bTable, bSmall, bPanel, CAPS, SANS, OLIVE } from './_brand.js'
import {
  studioDmy, studioTo12, STUDIO_NOTIFY_EMAILS, melbourneToday, melbourneNowTime,
} from '../src/lib/studio.js'

const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
const money = (v) => `A$${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── What we can trust ─────────────────────────────────────────────────────────
// Members have full read/write on their own company's booking rows (RLS only
// pins companyId), so date, startTime, feeId, memberId, doorOpenedAt and the
// studio.contact block can all be hand-edited through PostgREST. Fee rows they
// can only insert, never update — so wherever money is decided, the FEE is the
// record that counts, not the booking.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

/**
 * Has this session started, or has its door been opened? Booking times are
 * Melbourne-local; the server clock is UTC, so a plain `new Date(date+time)`
 * here would be out by 10–11 hours (see melbourneToday in lib/studio.js).
 * A malformed date/time counts as started — fail closed.
 */
export function studioSessionStarted(b) {
  if (b?.doorOpenedAt) return true
  if (!DATE_RE.test(String(b?.date ?? '')) || !TIME_RE.test(String(b?.startTime ?? ''))) return true
  const today = melbourneToday()
  return b.date < today || (b.date === today && b.startTime <= melbourneNowTime())
}

/**
 * The session a fee was raised for, read off the fee itself. New approval fees
 * carry startTime; older ones only have it inside the name bookingFeeName()
 * builds ("Meeting room — Podcast Studio · $120/hr · 20/11/2026 10:00–11:00").
 */
export function feeSession(f) {
  const m = String(f?.name ?? '').match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})–(\d{2}:\d{2})/)
  return {
    date: DATE_RE.test(String(f?.date ?? '')) ? f.date : (m ? `${m[3]}-${m[2]}-${m[1]}` : null),
    startTime: TIME_RE.test(String(f?.startTime ?? '')) ? f.startTime : (m ? m[4] : null),
  }
}

/** Is the session this fee was raised for still in the future (Melbourne)? */
function feeSessionAhead(f) {
  const { date, startTime } = feeSession(f)
  if (!date) return false
  const today = melbourneToday()
  if (date > today) return true
  return date === today && !!startTime && startTime > melbourneNowTime()
}

/**
 * Does this fee really belong to this studio booking? A fee whose bookingId
 * points here does. One reached only through the booking's (editable) feeId
 * must also be the same company's studio Booking Fee, unclaimed by any other
 * booking, for this booking's own date and start time — otherwise a member
 * could point feeId at any unbilled fee and have it waived.
 */
function feeBelongs(f, b, space) {
  if (!f || f.companyId !== b.companyId || f.type !== 'Booking Fee') return false
  if (f.bookingId) return f.bookingId === b.id
  const s = feeSession(f)
  return !!space?.unitNumber && String(f.name ?? '').includes(space.unitNumber) &&
    s.date === b.date && s.startTime === b.startTime
}

/**
 * Waive every unbilled fee raised for this booking. Fees are found two ways:
 * any fee whose `bookingId` points back at it, and the booking's own `feeId`
 * (approval fees raised before bookingId was stamped have only that link).
 *
 * `admin` callers are trusted to waive whatever is unbilled — an operator off
 * sick on the morning is still no charge. For members, the fee's own session
 * time must still be ahead.
 *
 * Returns { waived: [{id, price, data}], billed: [{id, price, status, invoiceNumber}], failed: [{id, error}] }.
 */
export async function waiveStudioFees(sb, b, { nowIso, actor, admin = false, space }) {
  const [byId, byBooking] = await Promise.all([
    b.feeId ? sb.from('fees').select('id,data').eq('id', b.feeId) : Promise.resolve({ data: [] }),
    sb.from('fees').select('id,data').eq('data->>bookingId', b.id),
  ])
  if (byId.error || byBooking.error) throw new Error((byId.error || byBooking.error).message)

  const fees = new Map()
  const seen = new Set()
  const unverified = [] // linked from the booking, but not provably this session's fee — left alone
  for (const r of [...(byBooking.data ?? []), ...(byId.data ?? [])]) {
    if (!r?.data || seen.has(r.id)) continue
    seen.add(r.id)
    if (feeBelongs(r.data, b, space)) fees.set(r.id, r.data)
    else unverified.push({ id: r.id })
  }

  const waived = [] // now Waived — no charge
  const billed = [] // already invoiced or paid — needs a credit note
  const kept = []   // unbilled, but by the fee's own record the session had started — the charge stands
  const failed = [] // the update itself failed
  for (const [id, f] of fees) {
    const price = Number(f.price) || 0
    if (f.status === 'Waived') continue
    if (['Paid', 'Invoiced'].includes(f.status)) {
      let invoiceNumber = null
      if (f.invoiceId) {
        const { data: inv } = await sb.from('invoices').select('data').eq('id', f.invoiceId)
        invoiceNumber = inv?.[0]?.data?.number ?? null
      }
      billed.push({ id, price, status: f.status, invoiceNumber })
      continue
    }
    if (!admin && !feeSessionAhead(f)) { kept.push({ id, price }); continue }
    const data = {
      ...f,
      status: 'Waived',
      waivedAt: nowIso,
      waivedBy: actor,
      bookingId: f.bookingId || b.id,
      notes: `${f.notes ? `${f.notes} · ` : ''}Waived — studio session cancelled before it started (no charge)`,
    }
    const { error } = await sb.from('fees').update({ data, updated_at: nowIso }).eq('id', id)
    if (error) failed.push({ id, price, error: error.message })
    else waived.push({ id, price, data })
  }
  return { waived, billed, kept, unverified, failed }
}

/** Every fee outcome, defaulted — so callers never trip over a missing list. */
export const emptyFeeOutcome = () => ({ waived: [], billed: [], kept: [], unverified: [], failed: [] })

/**
 * The cancelled booking row. Mirrors the admin Calendar's cancel (credits and
 * fee zeroed) and keeps a record of who cancelled and what was waived, so
 * "why wasn't this billed?" has an answer on the booking itself.
 */
export function cancelledStudioRow(b, { nowIso, by, email, reason, fees }) {
  return {
    ...b,
    status: 'Cancelled',
    cancelledAt: b.status === 'Cancelled' && b.cancelledAt ? b.cancelledAt : nowIso,
    cancelledBy: by === 'admin' ? 'Admin' : 'Member',
    ...(reason ? { cancelReason: reason } : {}),
    creditsUsed: 0,
    paidBy: 'cancelled',
    feeAmount: 0,
    feeId: null,
    studio: {
      ...(b.studio ?? {}),
      cancellation: {
        at: nowIso,
        by,
        email: email || null,
        reason: reason || '',
        wasConfirmed: b.status === 'Confirmed' || !!b.studio?.approval?.approvedAt,
        feesWaived: (fees?.waived ?? []).map((f) => f.id),
        feesStillBilled: (fees?.billed ?? []).map((f) => f.id),
        feesKept: (fees?.kept ?? []).map((f) => f.id),
        feesUnverified: (fees?.unverified ?? []).map((f) => f.id),
      },
    },
  }
}

/**
 * Tell the client and the studio team. The operator rostered for the slot
 * (Towhid is on STUDIO_NOTIFY_EMAILS but not an admin) has no other way to hear
 * that the session is off.
 */
export async function sendStudioCancelEmails(sb, b, { by, reason, wasConfirmed, fees, actorEmail }) {
  const [{ data: spRows }, { data: mRows }, { data: tRows }] = await Promise.all([
    sb.from('spaces').select('data').eq('id', b.resourceId),
    b.memberId ? sb.from('members').select('data').eq('id', b.memberId) : Promise.resolve({ data: [] }),
    b.companyId ? sb.from('tenants').select('data').eq('id', b.companyId) : Promise.resolve({ data: [] }),
  ])
  const space = spRows?.[0]?.data
  // memberId is editable on the booking row — only trust a member of the
  // booking's own company.
  const member = mRows?.[0]?.data?.companyId === b.companyId ? mRows[0].data : null
  const tenant = tRows?.[0]?.data
  const contact = b.studio?.contact ?? {}

  // The client's address comes from records the member can't edit (member,
  // then company). studio.contact is only for website requests, which have
  // neither — otherwise anyone could have us email any address they typed in.
  const clientEmail = member?.email || tenant?.email || contact.email || null
  // Plain text for subject lines; escaped copies for HTML. Every one of these
  // is member-writable and lands in email.
  const rawName = String(contact.name || b.memberName || member?.name || tenant?.contactName || 'there').replace(/[\r\n]+/g, ' ')
  const rawCompany = String(b.companyName || tenant?.businessName || contact.businessName || '').replace(/[\r\n]+/g, ' ')
  const rawWhen = `${studioDmy(b.date)} · ${studioTo12(b.startTime)} – ${studioTo12(b.endTime)}`.replace(/[\r\n]+/g, ' ')
  const rawSubjectWhen = `${studioDmy(b.date)} ${studioTo12(b.startTime)}`.replace(/[\r\n]+/g, ' ')
  const roomName = esc(space?.unitNumber || 'The Podcast Studio')
  const clientName = esc(rawName)
  const firstName = esc(rawName.split(' ')[0] || 'there')
  const companyName = esc(rawCompany)
  const reference = esc(b.reference || '—')
  const safeReason = esc(reason || '')
  const when = esc(rawWhen)
  const slotRows = [['Studio', roomName, true], ['When', when, true], ['Reference', reference, true]]

  const total = (list) => list.reduce((s, f) => s + (Number(f.price) || 0), 0)
  const waived = fees?.waived ?? []
  const billed = fees?.billed ?? []
  const kept = fees?.kept ?? []
  const unverified = fees?.unverified ?? []
  const failed = fees?.failed ?? []
  const invoiceList = [...new Set(billed.map((f) => f.invoiceNumber).filter(Boolean))].join(', ')
  // Only promise "no charge" when nothing for this session is still standing.
  const noCharge = !kept.length

  let opsSent = false
  let clientSent = false

  // ── Studio team ────────────────────────────────────────────────────────────
  const who = by === 'admin'
    ? `Cancelled by the Hexa Space team${actorEmail ? ` (${esc(actorEmail)})` : ''}`
    : `Cancelled by ${clientName}${actorEmail ? ` (${esc(actorEmail)})` : ''}`
  const chargeLines = [
    waived.length ? `No charge — the ${money(total(waived))} Booking Fee has been waived and won't be invoiced.` : '',
    billed.length ? `<strong>Action needed:</strong> ${money(total(billed))} for this session had already been ${invoiceList ? `invoiced on ${esc(invoiceList)}` : 'invoiced or paid'}. Cancelling is free, so raise a credit note for it.` : '',
    failed.length ? `<strong>Action needed:</strong> ${money(total(failed))} in Booking Fees for this session could not be waived automatically. Mark them Waived in Fees so they aren't billed.` : '',
    kept.length ? `<strong>Check:</strong> by its own record the ${money(total(kept))} fee is for a session that had already started, so it was left to be billed. Waive it in Fees if that's wrong.` : '',
    unverified.length ? `<strong>Check:</strong> this booking points at fee ${unverified.map((f) => esc(f.id)).join(', ')}, which couldn't be matched to the session, so it was left alone. Look at it in Fees before waiving anything.` : '',
  ].filter(Boolean)
  if (!chargeLines.length) chargeLines.push('No charge — nothing had been billed for this session.')
  const chargeLine = chargeLines.join('<br><br>')
  const opsInner =
    bKicker(wasConfirmed ? 'Studio session cancelled' : 'Studio request withdrawn') +
    bH1(wasConfirmed ? 'A podcast session has been cancelled' : 'A studio request has been withdrawn') +
    bP(`${who}. ${wasConfirmed ? 'The operator rostered for it is no longer needed and' : 'The'} slot is free again.`) +
    bTable([
      ...slotRows,
      ['Requested by', clientName, true],
      ['Company', companyName || '—', true],
      ...(safeReason ? [['Reason', safeReason, false]] : []),
    ]) +
    bP(chargeLine) +
    bSmall('Door access for the session is withdrawn automatically.')
  try {
    const r = await sendResendEmail({
      from: 'Hexa Space <noreply@hexaspace.com.au>',
      to: STUDIO_NOTIFY_EMAILS,
      ...(clientEmail ? { replyTo: clientEmail } : {}),
      subject: `${wasConfirmed ? 'Studio session cancelled' : 'Studio request withdrawn'}: ${rawName}${rawCompany ? ` (${rawCompany})` : ''} — ${rawSubjectWhen}`,
      html: brandFrame(opsInner, { footerLabel: 'Podcast Studio' }),
    })
    opsSent = !!r?.ok
  } catch (e) { console.error('studio cancel ops email failed:', e) }

  // ── The client ─────────────────────────────────────────────────────────────
  if (clientEmail) {
    const chargeNote = noCharge ? ' There\'s no charge for it.' : ''
    const lead = by === 'admin'
      ? `Hi ${firstName}, we've had to cancel your podcast studio session below.${chargeNote}`
      : wasConfirmed
        ? `Hi ${firstName}, your podcast studio session below has been cancelled, as you asked.${chargeNote}`
        : `Hi ${firstName}, your studio request below has been withdrawn and the slot released.${noCharge ? ' Nothing was charged.' : ''}`
    const invoicedNote = billed.length && noCharge
      ? bP(`It had already been included on ${invoiceList ? `invoice ${esc(invoiceList)}` : 'an invoice'}, so our team will credit it back to you.`)
      : !noCharge
        ? bP('The session had already started, so our team will be in touch about the session fee.')
        : ''
    const inner =
      bKicker(wasConfirmed ? 'Session cancelled' : 'Request withdrawn') +
      bH1(wasConfirmed ? 'Your studio session is cancelled.' : 'Your studio request is withdrawn.') +
      bP(lead) +
      bTable(slotRows) +
      (by === 'admin' && safeReason ? bPanel(
        `<div style="font-family:${CAPS};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${OLIVE};margin-bottom:8px">Why</div>` +
        `<div style="font-family:${SANS};font-size:13px;line-height:1.7;color:#3a3a3a">${safeReason}</div>`) : '') +
      invoicedNote +
      bP(by === 'admin'
        ? 'Reply to this email and we\'ll find you another time.'
        : 'Want another time? Request a new session from Studios in the member portal, or reply to this email.') +
      bSmall('Sent by the Hexa Space team.')
    try {
      const cr = await sendResendEmail({
        from: 'Hexa Space <noreply@hexaspace.com.au>',
        to: clientEmail,
        replyTo: 'info@hexaspace.com.au',
        subject: `${wasConfirmed ? 'Studio session cancelled' : 'Studio request withdrawn'} — ${rawSubjectWhen}`,
        html: brandFrame(inner, { footerLabel: 'Podcast Studio' }),
      })
      clientSent = !!cr?.ok
    } catch (e) { console.error('studio cancel client email failed:', e) }
  }

  return { opsSent, clientSent, clientEmail }
}
