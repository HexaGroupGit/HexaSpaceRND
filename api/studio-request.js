// Vercel serverless — POST /api/studio-request  (public, CORS *)
//
// The "Request a session" form on hexaspace.com.au/podcast-studio posts here.
// It writes a PENDING booking that holds the slot, plus the questionnaire and
// policy acceptance, and notifies both ops and the requester.
//
// What this endpoint deliberately does NOT do:
//   · No invoice, no Stripe, no charge. The studio is quoted and charged on
//     approval — nobody pays for a session we might not be able to staff.
//   · No door access. Pending bookings are invisible to the Salto sweep, which
//     only ever grants access to Confirmed bookings.
//
// Abuse control: honeypot, per-email/IP rate limit, payload caps, and fixed
// internal recipients — a public endpoint must never be steerable into sending
// mail to an address the caller chooses.
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from './_email.js'
import { brandFrame, bKicker, bH1, bP, bTable, bSmall, bPanel, CAPS, SANS, OLIVE, MUTE } from './_brand.js'
import {
  emptyQuestionnaire, validateQuestionnaire, validateStudioSlot, buildStudioPayload,
  questionnaireRows, recordingMinutesFor, studioDmy, studioTo12, CONFIRM_SLA,
  STUDIO_POLICY_VERSION, QUESTIONNAIRE_FIELDS, STUDIO_NOTIFY_EMAILS,
} from '../src/lib/studio.js'

const OPS_EMAILS = STUDIO_NOTIFY_EMAILS
const ADMIN_URL = 'https://admin.hexaspace.com.au/studio-requests'
const MAX_TEXT = 2000
const RATE_WINDOW_MS = 60 * 60 * 1000   // an hour
const RATE_MAX = 3                       // requests per email per window
const RATE_IP_MAX = 5                    // requests per IP per window
const MAX_OPEN_REQUESTS = 40             // unanswered website requests holding future slots

const CONTROL_CHARS = new RegExp('[\u0000-\u001F\u007F]', 'g')
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
// Strips control characters as well as truncating — these values land in email
// subject lines, where a bare CR/LF is header injection.
const clip = (s, n = MAX_TEXT) => String(s ?? '').replace(CONTROL_CHARS, ' ').slice(0, n)
const toDec = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) + (m || 0) / 60 }
const fromDec = (d) => `${String(Math.floor(d)).padStart(2, '0')}:${String(Math.round((d % 1) * 60)).padStart(2, '0')}`
const overlaps = (aS, aE, bS, bE) => toDec(aS) < toDec(bE) && toDec(bS) < toDec(aE)

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body ?? {}
  if (body.website) return res.status(200).json({ success: true }) // honeypot — look successful

  const name = clip(body.name, 120).trim()
  const email = clip(body.email, 160).trim().toLowerCase()
  const phone = clip(body.phone, 40).trim()
  const businessName = clip(body.businessName, 160).trim()
  const date = clip(body.date, 10)
  const startTime = clip(body.startTime, 5)
  const hours = Math.max(1, Math.min(8, Number(body.hours) || 1))

  if (!name) return res.status(400).json({ error: 'Please tell us your name.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please give us a valid email address.' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Please choose a date.' })
  if (!/^\d{2}:\d{2}$/.test(startTime)) return res.status(400).json({ error: 'Please choose a start time.' })
  if (!body.policyAccepted) return res.status(400).json({ error: 'Please accept the studio policy to send your request.' })

  // Studio hours, weekday and past-date rules — shared with the portal so the
  // two surfaces can never disagree, and Melbourne-local rather than UTC.
  const endTime = fromDec(toDec(startTime) + hours)
  const slotProblems = validateStudioSlot({ date, startTime, hours })
  if (slotProblems.length) return res.status(400).json({ error: slotProblems[0], problems: slotProblems })

  const questionnaire = {
    ...emptyQuestionnaire(),
    // Constrained to the known options — free text would land in staff emails
    // and the admin table having never been offered as a choice.
    recordingType: (() => {
      const opts = QUESTIONNAIRE_FIELDS.find((f) => f.key === 'recordingType')?.options ?? []
      const v = clip(body.recordingType, 60)
      return opts.includes(v) ? v : (v ? 'Other' : '')
    })(),
    // Clamped, not just validated: the room has two microphones.
    peopleOnCamera: Math.max(1, Math.min(2, Number(body.peopleOnCamera) || 1)),
    expectedRecordingMins: Number(body.expectedRecordingMins) || 0,
    ownCrew: !!body.ownCrew,
    ownCards: !!body.ownCards,
    transferHelp: body.transferHelp !== false,
    specialRequirements: clip(body.specialRequirements),
    deliverables: 'raw',
  }
  const problems = validateQuestionnaire(questionnaire, { hours })
  if (problems.length) return res.status(400).json({ error: problems[0], problems })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })
  const sb = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  try {
    const now = new Date().toISOString()

    // ── Which resource? ──────────────────────────────────────────────────────
    const { data: spaceRows } = await sb.from('spaces').select('id, data')
    const spaces = (spaceRows ?? []).map((r) => ({ id: r.id, ...(r.data ?? {}) }))
    const studio = spaces.find((s) => s.type === 'podcast')
    if (!studio) return res.status(503).json({ error: 'The studio isn’t taking requests online just yet — please email info@hexaspace.com.au.' })

    // ── Rate limit ───────────────────────────────────────────────────────────
    // Scoped by `updated_at` rather than reading the resource's whole history:
    // PostgREST caps an unbounded select at the project max-rows (~1000) and
    // returns an arbitrary subset, so an unfiltered read would silently start
    // passing everything once the studio accumulated enough bookings — the
    // rate limit and the clash check would both fail OPEN.
    const sinceIso = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    const { data: windowRows } = await sb.from('bookings').select('data')
      .eq('data->>resourceId', studio.id)
      .gte('updated_at', sinceIso)
      .limit(500)
    const inWindow = (windowRows ?? []).map((r) => r.data)

    // Keyed on BOTH the email and the caller's IP. Email alone is trivially
    // defeated by varying the address — and each request costs us a held slot,
    // a client record and two emails, one to a caller-chosen address.
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
      || req.socket?.remoteAddress || ''
    const byEmail = inWindow.filter((x) => String(x?.studio?.contact?.email ?? '').toLowerCase() === email)
    const byIp = ip ? inWindow.filter((x) => x?.studio?.requestIp === ip) : []
    if (byEmail.length >= RATE_MAX || byIp.length >= RATE_IP_MAX) {
      return res.status(429).json({ error: 'You’ve sent a few requests already — we’ll be in touch shortly. Reply to your confirmation email if you need to add anything.' })
    }

    // Cap how much of the calendar unconfirmed website requests may hold at
    // once. A Pending row blocks the slot for everyone (the portal and the
    // website both treat anything non-Cancelled as taken), so without this an
    // attacker can blank out the studio's calendar for months.
    const { data: openRows } = await sb.from('bookings').select('data')
      .eq('data->>resourceId', studio.id)
      .eq('data->>status', 'Pending')
      .limit(MAX_OPEN_REQUESTS + 1)
    const openWebRequests = (openRows ?? []).map((r) => r.data)
      .filter((x) => x?.source === 'Website' && x?.date >= new Date().toISOString().split('T')[0])
    if (openWebRequests.length >= MAX_OPEN_REQUESTS) {
      return res.status(503).json({ error: 'We have a lot of studio requests in the queue right now — please email info@hexaspace.com.au and we’ll book you in directly.' })
    }

    // ── Clash check ──────────────────────────────────────────────────────────
    // Scoped to the requested DAY, so it stays correct however many bookings
    // the studio has taken historically.
    const { data: dayRows } = await sb.from('bookings').select('data')
      .eq('data->>resourceId', studio.id)
      .eq('data->>date', date)
      .limit(200)
    const clash = (dayRows ?? []).map((r) => r.data).some((x) =>
      x?.status !== 'Cancelled' && overlaps(startTime, endTime, x?.startTime, x?.endTime))
    if (clash) {
      return res.status(409).json({ error: 'That time has just been taken — please pick another slot.', code: 'slot_taken' })
    }

    // ── Client record ────────────────────────────────────────────────────────
    // Match an existing company by email so a member requesting from the public
    // page doesn't spawn a duplicate client record.
    const { data: tenantRows } = await sb.from('tenants').select('id, data')
    const tenants = (tenantRows ?? []).map((r) => ({ id: r.id, ...(r.data ?? {}) }))
    // Match ONLY on the company's own email. Matching a member's address too
    // would mean anyone who can guess a teammate's email gets their request
    // filed against — and, once approved, billed to — that company. An
    // unauthenticated caller has proven nothing about who they are, so anything
    // short of an exact company-email match becomes a fresh drop-in record.
    let tenant = tenants.find((t) => String(t.email ?? '').toLowerCase() === email)
    if (!tenant) {
      const id = `t${Date.now()}${Math.random().toString(36).slice(2, 5)}`
      tenant = {
        id, businessName: businessName || name, contactName: name, email, phone,
        source: 'website-studio-request', status: 'Drop In', country: 'Australia',
        createdAt: now.split('T')[0],
      }
      await sb.from('tenants').upsert({ id, data: tenant, updated_at: now })
    }

    // ── The booking ──────────────────────────────────────────────────────────
    const booking = {
      id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      reference: `BKG-${Math.floor(100000 + Math.random() * 900000)}`,
      resourceId: studio.id,
      memberId: '',
      companyId: tenant.id,
      date, startTime, endTime,
      title: 'Podcast session',
      memberName: name,
      companyName: tenant.businessName || businessName || name,
      attendees: [],
      status: 'Pending',        // the gate — held, not booked
      source: 'Website',
      repeat: 'none',
      createdBy: 'Website',
      createdAt: now.split('T')[0],
      creditsUsed: 0,
      paidBy: 'pending_approval',
      studio: {
        ...buildStudioPayload({
          questionnaire,
          acceptedBy: name,
          contact: { name, email, phone, businessName },
          source: 'Website',
        }),
        requestIp: ip || null, // rate-limit key only; never shown to anyone
      },
    }
    const { error: insErr } = await sb.from('bookings').upsert({ id: booking.id, data: booking, updated_at: now })
    if (insErr) {
      console.error('studio-request insert error:', insErr)
      return res.status(500).json({ error: 'Could not save your request — please try again.' })
    }

    // Awaited: Vercel freezes the lambda once the response goes out, so an
    // unawaited send silently dies (see the 13 Jul 2026 fix across 9 endpoints).
    await sendEmails({ booking, questionnaire, hours, name, email, phone, businessName, studio })
      .catch((e) => console.error('studio-request email:', e))

    return res.status(200).json({ success: true, reference: booking.reference })
  } catch (err) {
    console.error('studio-request error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function sendEmails({ booking: b, questionnaire, hours, name, email, phone, businessName, studio }) {
  const roomName = studio?.unitNumber || 'The Podcast Studio'
  const when = `${studioDmy(b.date)} · ${studioTo12(b.startTime)} – ${studioTo12(b.endTime)}`
  const slotRows = [
    ['Studio', roomName, true],
    ['When', when, true],
    ['Length', `${hours} hour${hours !== 1 ? 's' : ''} · about ${recordingMinutesFor(hours)} min recording`, true],
    ['Reference', b.reference, true],
  ]

  // Ops — fixed recipients, never anything from the request body.
  const opsInner =
    bKicker('Studio request · website') +
    bH1('A podcast session needs confirming 🎙️') +
    bP(`<strong>${esc(name)}</strong>${businessName ? ` (${esc(businessName)})` : ''} requested the studio from the website. The slot is held but <strong>not confirmed</strong> — no door access until someone approves it.`) +
    bTable([
      ...slotRows,
      ['Contact', `${esc(email)}${phone ? ` · ${esc(phone)}` : ''}`, false],
      ['Policy', `Accepted ${STUDIO_POLICY_VERSION}`, false],
    ]) +
    bPanel(
      `<div style="font-family:${CAPS};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${OLIVE};margin-bottom:10px">Pre-session questionnaire</div>` +
      questionnaireRows(questionnaire).map(([k, v]) =>
        `<div style="font-family:${SANS};font-size:13px;color:#3a3a3a;line-height:1.75"><span style="color:${MUTE}">${esc(k)}:</span> ${esc(v)}</div>`).join('')) +
    `<div style="text-align:center;margin:26px 0"><a href="${ADMIN_URL}" style="display:inline-block;background:${OLIVE};color:#ffffff;text-decoration:none;padding:13px 34px;font-family:${CAPS};font-size:12px;letter-spacing:.14em;text-transform:uppercase;border-radius:6px"><span style="color:#ffffff;text-decoration:none">Review this request</span></a></div>` +
    bSmall(`This person has no member account — approving will need a quote or pay link. Target turnaround ${CONFIRM_SLA}.`)

  await sendResendEmail({
    from: 'Hexa Space <noreply@hexaspace.com.au>',
    to: OPS_EMAILS,
    replyTo: email,
    subject: `Studio request: ${name}${businessName ? ` (${businessName})` : ''} — ${studioDmy(b.date)} ${studioTo12(b.startTime)}`,
    html: brandFrame(opsInner, { footerLabel: 'Podcast Studio' }),
  })

  // The requester.
  const firstName = String(name).split(' ')[0] || 'there'
  const clientInner =
    bKicker('Request received') +
    bH1('We’ve got your studio request.') +
    bP(`Hi ${esc(firstName)}, thanks for getting in touch. Your slot is <strong>held</strong> while we confirm an operator — we'll come back to you within ${CONFIRM_SLA}. Nothing is charged yet.`) +
    bTable(slotRows) +
    bPanel(
      `<div style="font-family:${CAPS};font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${OLIVE};margin-bottom:8px">Before you plan your session</div>` +
      `<div style="font-family:${SANS};font-size:13px;line-height:1.7;color:#3a3a3a">Setup, briefing and file handover happen <strong>inside</strong> your booking — roughly 30 minutes to set up and 15 to transfer files and reset. Your ${hours}-hour session leaves about <strong>${recordingMinutesFor(hours)} minutes</strong> of actual recording. If that's tight, reply and we'll look at extending it.</div>`) +
    bP('Once we confirm, we\'ll send your confirmation together with the guest recording guide — forward that to anyone appearing with you.') +
    bSmall('Questions before then? Just reply to this email.')

  await sendResendEmail({
    from: 'Hexa Space <noreply@hexaspace.com.au>',
    to: email,
    replyTo: 'info@hexaspace.com.au',
    subject: `Studio request received — ${studioDmy(b.date)} ${studioTo12(b.startTime)}`,
    html: brandFrame(clientInner, { footerLabel: 'Podcast Studio' }),
  })
}
