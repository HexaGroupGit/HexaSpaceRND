// POST /api/studio/notify-request — every email in the podcast-studio request
// lifecycle, in one place.
//
//   kind 'requested'   → ops get the questionnaire + a review prompt; the
//                        requester gets an acknowledgement (slot held, nothing
//                        charged, we confirm within 1 business day).
//   kind 'approved'    → the requester gets their confirmation AND the Client &
//                        Guest Recording Guide in the same send, so a host has
//                        one email to forward to their guests.
//   kind 'declined'    → the reason, so they can act on it.
//   kind 'rescheduled' → we've proposed another time; still their call.
//
// Auth: member OR admin. A member may only notify about their OWN company's
// booking ('requested'); the decision kinds are admin-only, because sending
// "your session is approved" is a decision, not a notification.
import { serviceClient, verifiedUser, isAdminEmail, companyForEmail } from '../_auth.js'
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH1, bP, bTable, bSmall, bPanel, CAPS, SANS, OLIVE, INK, MUTE } from '../_brand.js'
import { applyCors } from '../_cors.js'
import {
  questionnaireRows, recordingMinutesFor, studioDmy, studioTo12,
  CONFIRM_SLA, RETENTION_DAYS, STUDIO_POLICY, STUDIO_NOTIFY_EMAILS,
} from '../../src/lib/studio.js'

const OPS_EMAILS = STUDIO_NOTIFY_EMAILS
const ADMIN_URL = 'https://admin.hexaspace.com.au/studio-requests'

const hoursBetween = (s, e) => {
  const [sh, sm] = String(s || '0:0').split(':').map(Number)
  const [eh, em] = String(e || '0:0').split(':').map(Number)
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60)
}
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

// The guest-facing half of the Operations Guide §3, rendered as an email block.
// Sent with every confirmation so a host has something to forward to guests.
function guestGuideBlock() {
  const item = (t) => `<li style="margin-bottom:7px">${t}</li>`
  const list = (items) => `<ul style="font-family:${SANS};font-size:13px;line-height:1.6;color:#3a3a3a;margin:0 0 18px;padding-left:18px">${items.join('')}</ul>`
  const head = (t) => `<div style="font-family:${CAPS};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${OLIVE};margin:0 0 9px">${t}</div>`
  return (
    `<div style="border-top:1px solid #e3e1e6;margin:26px 0 0;padding-top:24px">` +
    `<div style="font-family:${CAPS};font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:${INK};margin:0 0 16px">Guest recording guide</div>` +
    `<p style="font-family:${SANS};font-size:13px;line-height:1.65;color:#3a3a3a;margin:0 0 20px">Please forward this to anyone appearing on the recording — it takes two minutes to read and makes a noticeable difference to how the session turns out.</p>` +
    head('Microphone') +
    list([
      item('A microphone is positioned for you before you sit down — speak <strong>toward</strong> it rather than across it.'),
      item('Please don\'t move the microphone or its stand once you\'re set up. Ask the operator if something feels wrong.'),
      item('Avoid tapping the table or handling the stand while recording — both are very audible.'),
    ]) +
    head('Framing') +
    list([
      item('Stay seated within the marked area so you remain in shot.'),
      item('Keep your face toward the camera or the host when you speak.'),
      item('Small natural movement is fine — just avoid leaning far forward, back or sideways.'),
      item('Need a break? Tell the operator and we\'ll pause. Please don\'t touch the equipment yourself.'),
    ]) +
    head('What to wear') +
    list([
      item('Mid-tone colours record best. Avoid pure white and pure black.'),
      item('Avoid tight, busy patterns like fine stripes — they shimmer on camera.'),
      item('Glasses are no problem; the lighting is angled to cut glare, and we may ask for a small adjustment.'),
      item('Skip large jewellery that can knock the microphone or rattle.'),
    ]) +
    head('On the day') +
    list([
      item('<strong>Arrive at the start of your booked time.</strong> Setup is inside your booking, not before it.'),
      item('Phones on silent, please.'),
      item('Water is welcome at the table — just keep it away from cables and equipment.'),
    ])
  )
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sb = serviceClient()
  const user = await verifiedUser(req, sb)
  if (!user) return res.status(401).json({ error: 'Sign in required.' })
  const admin = await isAdminEmail(sb, user.email)

  const { bookingId, kind = 'requested', reason = '' } = req.body ?? {}
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' })
  if (!['requested', 'approved', 'declined', 'rescheduled'].includes(kind)) {
    return res.status(400).json({ error: 'Unknown notification kind.' })
  }
  // Approving/declining/moving a session is a decision — only staff make it.
  if (kind !== 'requested' && !admin) {
    return res.status(403).json({ error: 'Admin access required.' })
  }

  try {
    const { data: rows } = await sb.from('bookings').select('data').eq('id', bookingId)
    const b = rows?.[0]?.data
    if (!b) return res.status(404).json({ error: 'Booking not found.' })

    // A member may only trigger notifications for their own company's request.
    // Fail CLOSED: an authenticated user we can't tie to a company has no
    // business triggering notifications on someone else's booking. The previous
    // `b.companyId && companyId &&` form skipped the check entirely whenever
    // companyForEmail returned null (archived member, stale account), letting
    // any signed-in user spam any booking's contact and read the address back.
    if (!admin) {
      const companyId = await companyForEmail(sb, user.email)
      if (!companyId || !b.companyId || b.companyId !== companyId) {
        return res.status(403).json({ error: 'Not your booking.' })
      }
    }

    const [{ data: spRows }, { data: mRows }, { data: tRows }] = await Promise.all([
      sb.from('spaces').select('data').eq('id', b.resourceId),
      b.memberId ? sb.from('members').select('data').eq('id', b.memberId) : Promise.resolve({ data: [] }),
      b.companyId ? sb.from('tenants').select('data').eq('id', b.companyId) : Promise.resolve({ data: [] }),
    ])
    const space = spRows?.[0]?.data
    if (space && space.type !== 'podcast') {
      return res.status(200).json({ skipped: 'not a request-gated studio' })
    }

    // Escape ONCE, at the source. Every one of these is member-writable (the
    // booking row is a member-owned jsonb), and they all land inside HTML emails
    // sent to staff — an unescaped anchor here is a phishing link inside a
    // Hexa-branded email from our own domain.
    const roomName = esc(space?.unitNumber || 'The Podcast Studio')
    const member = mRows?.[0]?.data
    const tenant = tRows?.[0]?.data
    const contact = b.studio?.contact ?? {}
    // Website requests have no member row — the contact block carries the email.
    const clientEmail = contact.email || member?.email || tenant?.email || null
    const clientName = esc(contact.name || b.memberName || member?.name || tenant?.contactName || 'there')
    const firstName = String(clientName).split(' ')[0] || 'there'
    const companyName = esc(b.companyName || tenant?.businessName || contact.businessName || '')
    const reference = esc(b.reference || '—')

    const hrs = hoursBetween(b.startTime, b.endTime)
    const when = `${studioDmy(b.date)} · ${studioTo12(b.startTime)} – ${studioTo12(b.endTime)}`
    const slotRows = [
      ['Studio', roomName, true],
      ['When', when, true],
      ['Length', `${hrs} hour${hrs !== 1 ? 's' : ''} · about ${recordingMinutesFor(hrs)} min recording`, true],
      ['Reference', reference, true],
    ]

    let opsSent = false
    let clientSent = false

    // ── Ops: a request is waiting ────────────────────────────────────────────
    if (kind === 'requested') {
      const inner =
        bKicker('Studio request') +
        bH1('A podcast session needs confirming 🎙️') +
        bP(`<strong>${clientName}</strong>${companyName ? ` (${companyName})` : ''} has requested the studio. The slot is held but <strong>not confirmed</strong> — no door access is granted until someone approves it.`) +
        bTable([
          ...slotRows,
          ['Requested by', clientName, true],
          ['Company', companyName || (b.source === 'Website' ? 'Website — no account' : '—'), true],
          ['Contact', esc(clientEmail || '—') + (contact.phone ? ` · ${esc(contact.phone)}` : ''), false],
          ['Source', esc(b.studio?.requestSource || b.source || '—'), false],
        ]) +
        bPanel(
          `<div style="font-family:${CAPS};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${OLIVE};margin-bottom:10px">Pre-session questionnaire</div>` +
          questionnaireRows(b.studio?.questionnaire).map(([k, v]) =>
            `<div style="font-family:${SANS};font-size:13px;color:#3a3a3a;line-height:1.75"><span style="color:${MUTE}">${esc(k)}:</span> ${esc(v)}</div>`).join('')) +
        bP('Check an operator can cover the slot, then approve, propose another time, or decline.') +
        `<div style="text-align:center;margin:26px 0"><a href="${ADMIN_URL}" style="display:inline-block;background:${OLIVE};color:#ffffff;text-decoration:none;padding:13px 34px;font-family:${CAPS};font-size:12px;letter-spacing:.14em;text-transform:uppercase;border-radius:6px"><span style="color:#ffffff;text-decoration:none">Review this request</span></a></div>` +
        bSmall(`Target turnaround is ${CONFIRM_SLA}. Requests still unanswered after 48 hours are flagged in the admin queue.`)

      const r = await sendResendEmail({
        from: 'Hexa Space <noreply@hexaspace.com.au>',
        to: OPS_EMAILS,
        ...(clientEmail ? { replyTo: clientEmail } : {}),
        subject: `Studio request: ${clientName}${companyName ? ` (${companyName})` : ''} — ${studioDmy(b.date)} ${studioTo12(b.startTime)}`,
        html: brandFrame(inner, { footerLabel: 'Podcast Studio' }),
      })
      opsSent = !!r?.ok
    }

    // ── The client ───────────────────────────────────────────────────────────
    if (clientEmail) {
      let subject = ''
      let inner = ''

      if (kind === 'requested') {
        subject = `Studio request received — ${studioDmy(b.date)} ${studioTo12(b.startTime)}`
        inner =
          bKicker('Request received') +
          bH1('We’ve got your studio request.') +
          bP(`Hi ${firstName}, thanks for booking in with us. Your slot is <strong>held</strong> while we confirm an operator — we'll come back to you within ${CONFIRM_SLA}. Nothing is charged yet.`) +
          bTable(slotRows) +
          bPanel(
            `<div style="font-family:${CAPS};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${OLIVE};margin-bottom:8px">Before you plan your session</div>` +
            `<div style="font-family:${SANS};font-size:13px;line-height:1.7;color:#3a3a3a">Setup, briefing and file handover happen <strong>inside</strong> your booking — roughly 30 minutes to set up and 15 to transfer files and reset. Your ${hrs}-hour session leaves about <strong>${recordingMinutesFor(hrs)} minutes</strong> of actual recording. If that's tight, reply and we'll extend it.</div>`) +
          bP('Once confirmed we\'ll send your confirmation along with the guest recording guide, so you can forward it to anyone appearing with you.') +
          bSmall('Questions before then? Just reply to this email.')
      }

      if (kind === 'approved') {
        subject = `Studio session confirmed — ${studioDmy(b.date)} ${studioTo12(b.startTime)}`
        inner =
          bKicker('Session confirmed') +
          bH1('Your studio session is confirmed ✅') +
          bP(`Hi ${firstName}, you're locked in. Here are the details:`) +
          bTable(slotRows) +
          bPanel(
            `<div style="font-family:${CAPS};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${OLIVE};margin-bottom:8px">Please arrive on time</div>` +
            `<div style="font-family:${SANS};font-size:13px;line-height:1.7;color:#3a3a3a">Setup is part of your booking, so arriving late shortens your recording rather than extending the session. Come to <strong>Suite 25, Level 2, 830 Whitehorse Road, Box Hill</strong> — our team will meet you and get you set up.</div>`) +
          bP(`Your files are copied and verified before you leave, and handed over as raw footage — multi-camera video and multi-track audio. Bring a USB drive or portable SSD if you can. We keep a working copy for ${RETENTION_DAYS} days as a safety net, then delete it.`) +
          guestGuideBlock() +
          bSmall('Need to change or cancel? Reply to this email as early as you can — an operator is rostered for your session.')
      }

      if (kind === 'declined') {
        subject = `Studio request — ${studioDmy(b.date)} ${studioTo12(b.startTime)}`
        inner =
          bKicker('Request update') +
          bH1('We can’t make that time work.') +
          bP(`Hi ${firstName}, thanks for your patience. Unfortunately we can't run your session at the time you asked for:`) +
          bTable(slotRows) +
          (reason ? bPanel(
            `<div style="font-family:${CAPS};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${OLIVE};margin-bottom:8px">Why</div>` +
            `<div style="font-family:${SANS};font-size:13px;line-height:1.7;color:#3a3a3a">${esc(reason)}</div>`) : '') +
          bP('The slot has been released. Reply to this email with a time that suits and we\'ll get you booked in.') +
          bSmall('Sorry for the inconvenience — we\'d still love to get you in the studio.')
      }

      if (kind === 'rescheduled') {
        subject = `A new time for your studio session — ${studioDmy(b.date)} ${studioTo12(b.startTime)}`
        inner =
          bKicker('New time proposed') +
          bH1('Could this time work instead?') +
          bP(`Hi ${firstName}, we couldn't staff your original slot, so we've pencilled you in here instead:`) +
          bTable(slotRows) +
          bP('Your request is still open — reply to confirm this works and we\'ll lock it in, or tell us what suits better and we\'ll try again.') +
          bSmall('Nothing is charged, and the new time isn\'t confirmed until you say yes.')
      }

      const cr = await sendResendEmail({
        from: 'Hexa Space <noreply@hexaspace.com.au>',
        to: clientEmail,
        replyTo: 'info@hexaspace.com.au',
        subject,
        html: brandFrame(inner, { footerLabel: 'Podcast Studio' }),
      })
      clientSent = !!cr?.ok

      // Stamp when the guide actually went out, so nobody has to guess later.
      if (kind === 'approved' && clientSent) {
        try {
          // RE-READ before writing. `b` is the snapshot this handler opened
          // with, and the admin's approve() writes via a fire-and-forget
          // syncRow — so writing `{...b}` back here can land AFTER the approval
          // and revert it to Pending, having already emailed "confirmed".
          const { data: fresh } = await sb.from('bookings').select('data').eq('id', bookingId)
          const cur = fresh?.[0]?.data ?? b
          await sb.from('bookings').update({
            data: { ...cur, studio: { ...(cur.studio ?? {}), guideSentAt: new Date().toISOString() } },
            updated_at: new Date().toISOString(),
          }).eq('id', bookingId)
        } catch { /* the email is out; the stamp is bookkeeping */ }
      }
    }

    return res.status(200).json({ opsSent, clientSent, to: clientEmail })
  } catch (err) {
    console.error('studio notify-request error:', err)
    return res.status(500).json({ error: 'Could not send the studio notification.' })
  }
}
