// POST /api/function-enquiry-reply — admin only.
//
// Function enquiries often arrive with a written message ("we'd love to come in
// and have a look at the space first"). This endpoint reads that message with
// Claude, drafts a reply in the Hexa voice, and sends it with the function
// brochure attached and a "book a time to visit" tour link — the walkthrough
// path, not the quote / proposal path (that's function-bookings/notify.js).
//
//   { id, action: 'draft' }
//     → { subject, headline, body, wantsVisit, summary }
//   { id, action: 'send', subject, headline, body, attachBrochure, includeTourLink }
//     → { sent: true, to }
//
// The recipient is ALWAYS the address stored on the enquiry — never one supplied
// by the caller — so this can't be turned into an open relay even if the admin
// gate ever slips. Drafting requires ANTHROPIC_API_KEY; sending does not, so the
// team can still write the reply by hand if AI drafting isn't configured.
import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from './_auth.js'
import { sendResendEmail } from './_email.js'
import { brandFrame, bKicker, bH1, bP, bBtn, bSmall } from './_brand.js'
import { functionBrochureAttachment, tourUrlFor } from './_leads.js'

export const config = { maxDuration: 60 }

const MODEL = 'claude-opus-5'

const SYSTEM = `You write email replies for the events team at Hexa Space — a
business infrastructure and coworking space at Level 4, 402/830 Whitehorse Road,
Box Hill, Melbourne. You are replying to someone who enquired about hiring The
Function Space.

Voice: warm, professional, concise, Australian English. Write as "we" (the Hexa
Space team). No hype, no exclamation-mark stacking, no emoji.

What this particular email is for: answering the person's message and inviting
them in to see the space in person. It is NOT a quote and NOT a proposal — never
state a total, never say a date is held or confirmed, and never promise
availability. If they asked about a specific date, say we'll check availability
and come back to them, or that we can confirm it when they visit.

The app renders two things for you underneath your text, so do not write URLs:
- a "Book a time to visit" button linking to the tour booking page — refer to it
  as "pick a time below" / "the link below";
- the function brochure as a PDF attachment, when attached.
Only mention the brochure if the facts say it is attached.

Answer whatever they actually asked, using only the facts given. If a question
can't be answered from the facts (catering suppliers, specific AV gear, a firm
price), say we'll cover it when they come in or that we'll follow up — do not
invent details.

Output rules: PLAIN TEXT that gets typeset into a branded email — no markdown,
no HTML, no bullet characters. Blank line between paragraphs. Open with a
greeting on its own line ("Hi Sarah,"), close with "— The Hexa Space Team". Keep
the whole body under about 160 words. The headline is a short warm serif line
above the body (under 60 characters, no full stop needed).`

const SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', description: 'Email subject line, under 80 characters' },
    headline: { type: 'string', description: 'Short serif headline above the body, under 60 characters' },
    body: { type: 'string', description: 'Plain-text email body, blank lines between paragraphs, greeting first and sign-off last' },
    wantsVisit: { type: 'boolean', description: 'True if their message asks to come in / see the space / tour / inspect it' },
    summary: { type: 'string', description: 'One short line for the admin: what they are actually asking for' },
  },
  required: ['subject', 'headline', 'body', 'wantsVisit', 'summary'],
  additionalProperties: false,
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Plain-text body → branded paragraphs. Blank line = new paragraph, single
// newline = line break inside one.
const paragraphs = (text) => String(text ?? '')
  .split(/\n\s*\n/)
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => bP(esc(p).replace(/\n/g, '<br>')))
  .join('')

function rateCard(settings) {
  const f = settings?.functionSpace ?? {}
  const num = (v, fb) => (v === '' || v == null || Number.isNaN(Number(v)) ? fb : Number(v))
  return {
    weekday: num(f.weekdayRate, 250),
    weekend: num(f.weekendRate, 325),
    cleaning: num(f.cleaningFee, 200),
    security: num(f.securityDeposit, 300),
  }
}

function factSheet(b, settings, { attachBrochure = true } = {}) {
  const r = rateCard(settings)
  const addons = Object.entries(b.addons ?? {}).filter(([, v]) => v).map(([k]) => k).join(', ')
  const lines = [
    `Their name: ${b.name || '(not given)'}`,
    `Organisation: ${b.organisation || '(not given)'}`,
    `Event: ${b.eventName || '(not given)'}${b.eventType ? ` — ${b.eventType}` : ''}`,
    `Requested date/time: ${b.eventDate || '(none given)'} ${b.startTime || ''}${b.endTime ? `–${b.endTime}` : ''}`.trim(),
    `Guests: ${b.guests || '(not given)'}`,
    `Catering requested: ${b.catering ? 'yes' : 'no'}`,
    addons ? `Add-ons ticked: ${addons}` : '',
    '',
    'Venue facts you may use:',
    `- The Function Space seats 20–100 guests, Level 4, 402/830 Whitehorse Road, Box Hill.`,
    `- Venue hire $${r.weekday} + GST per hour weekday, $${r.weekend} + GST per hour weekend.`,
    `- Mandatory cleaning fee $${r.cleaning} + GST. Refundable security deposit $${r.security}.`,
    `- 50% deposit secures a date; balance due 14 days before the event.`,
    `- Tours run during business hours; they pick their own time on the booking page.`,
    `- The function brochure ${attachBrochure ? 'IS attached to this email' : 'is NOT attached to this email'}.`,
    '',
    'Their message:',
    (b.additionalRequirements || '').trim() || '(they did not write a message — invite them in to see the space)',
  ]
  return lines.filter((l) => l !== '').join('\n')
}

// Draft with Claude. Server-side fallbacks are on so a spurious safety refusal
// re-runs on another model instead of blocking the team; older SDK/API combos
// that don't know the beta just fall through to the plain call.
async function draftWithClaude(prompt) {
  const client = new Anthropic()
  const params = {
    model: MODEL,
    max_tokens: 6000,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  }
  try {
    return await client.beta.messages.create({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
  } catch (err) {
    console.warn('function-enquiry-reply: fallbacks unavailable, retrying plain —', err?.message || err)
    return client.messages.create(params)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb

  const { id, action = 'draft' } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'Missing enquiry id.' })

  const [{ data: rows }, { data: settRows }] = await Promise.all([
    sb.from('function_bookings').select('data').eq('id', id),
    sb.from('settings').select('data').eq('id', 'global'),
  ])
  const booking = rows?.[0]?.data
  if (!booking) return res.status(404).json({ error: 'Enquiry not found.' })
  const settings = settRows?.[0]?.data ?? {}

  if (action === 'draft') {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI drafting is not configured yet — add ANTHROPIC_API_KEY in Vercel.' })
    }
    try {
      const attachBrochure = req.body?.attachBrochure !== false
      const response = await draftWithClaude(
        `Reply to this function space enquiry and invite them in for a look.\n\n${factSheet(booking, settings, { attachBrochure })}`
      )
      if (response.stop_reason === 'refusal') {
        return res.status(400).json({ error: 'The assistant declined to draft that one — write the reply by hand.' })
      }
      const text = response.content.find((blk) => blk.type === 'text')?.text ?? ''
      const draft = JSON.parse(text)
      return res.status(200).json({
        subject: draft.subject ?? '',
        headline: draft.headline ?? '',
        body: draft.body ?? '',
        wantsVisit: !!draft.wantsVisit,
        summary: draft.summary ?? '',
      })
    } catch (err) {
      console.error('function-enquiry-reply draft error:', err)
      return res.status(500).json({ error: 'Could not draft the reply — try again.' })
    }
  }

  if (action === 'send') {
    const to = booking.email
    if (!to) return res.status(400).json({ error: 'This enquiry has no email address.' })

    const subject = String(req.body?.subject ?? '').trim()
    const headline = String(req.body?.headline ?? '').trim()
    const body = String(req.body?.body ?? '').trim()
    if (!subject || !body) return res.status(400).json({ error: 'Subject and message are required.' })

    const attachBrochure = req.body?.attachBrochure !== false
    const includeTourLink = req.body?.includeTourLink !== false
    const tourUrl = tourUrlFor(settings)
    const address = settings?.tours?.address || '402/830 Whitehorse Road, Box Hill VIC 3128'

    const inner = bKicker('Function Space Hire') +
      (headline ? bH1(esc(headline)) : '') +
      paragraphs(body) +
      (includeTourLink
        ? bBtn('Book a time to visit', tourUrl) +
          bSmall(`We're at ${esc(address)} — take the lift to Level 4 and check in at reception. If none of the times suit, just reply and we'll find one that does.`)
        : bSmall('Just reply to this email and we\'ll take it from there.'))

    const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
    const fromEmail = settings?.emails?.fromEmail || 'noreply@hexaspace.com.au'
    const replyTo = settings?.emails?.replyTo || settings?.emails?.notificationEmail

    const r = await sendResendEmail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html: brandFrame(inner, { footerLabel: 'Function Space Hire' }),
      replyTo,
      ...(attachBrochure ? { attachments: functionBrochureAttachment(settings) } : {}),
    })
    if (!r.ok) return res.status(502).json({ error: 'The email did not send — check the Resend key and try again.' })

    const now = new Date().toISOString()
    const updated = {
      ...booking,
      read: true,
      replySentAt: now,
      replySubject: subject,
      ...(attachBrochure ? { brochureSentAt: now } : {}),
      ...(includeTourLink ? { tourInviteSentAt: now } : {}),
      // A personal reply supersedes the automated drip — same rule the tour
      // booking modal applies to leads.
      nurture: { ...(booking.nurture ?? {}), done: true, lastAt: now.split('T')[0] },
      updatedAt: now,
    }
    await sb.from('function_bookings').upsert({ id, data: updated, updated_at: now })

    return res.status(200).json({ sent: true, to, skipped: !!r.skipped, booking: updated })
  }

  return res.status(400).json({ error: 'Unknown action.' })
}
