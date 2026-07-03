// POST /api/portal/notify-event
//
// Called in two ways:
//   1. From admin panel (adding a portal-only event): body = { event: { title, date, ... } }
//   2. From Sanity webhook (publishing on hexahub.com.au): body = raw Sanity document
//
// Only sends on Sanity "create" operations (not edits/deletes).

import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '../_email.js'

const SUPABASE_URL = process.env.SUPABASE_URL

function fmtDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

function extractEvent(body, headers) {
  // Sanity webhook — raw document in body
  if (body?._type === 'event') {
    const doc = body
    return {
      title: doc.title,
      date: doc.date ?? null,
      time: doc.date
        ? new Date(doc.date).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
        : null,
      location: [doc.location, doc.locationAddress].filter(Boolean).join(' — '),
      description: doc.summary ?? doc.tagline ?? '',
      link: doc.slug?.current
        ? `https://www.hexahub.com.au/events/${doc.slug.current}`
        : 'https://www.hexahub.com.au/events',
    }
  }
  // Admin panel call
  return body?.event ?? null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey  = process.env.RESEND_API_KEY
  if (!serviceKey || !resendKey) return res.status(500).json({ error: 'Not configured.' })

  // For Sanity webhooks, only notify on NEW events (not edits or deletes)
  const operation = req.headers['sanity-operation']
  if (operation && operation !== 'create') {
    return res.status(200).json({ skipped: true, reason: `operation=${operation}` })
  }

  const event = extractEvent(req.body, req.headers)
  if (!event?.title) return res.status(400).json({ error: 'No event data.' })

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Get all tenants with emails
  const { data: tenantsData } = await admin.from('tenants').select('data')
  const tenants = (tenantsData ?? []).map(r => r.data).filter(t => t.email)

  // Only email active portal members (have signed in at least once)
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const activeEmails = new Set(
    users.filter(u => u.last_sign_in_at).map(u => u.email?.toLowerCase())
  )
  const recipients = tenants.filter(t => activeEmails.has(t.email?.toLowerCase()))

  if (!recipients.length) return res.status(200).json({ sent: 0, reason: 'No active portal members.' })

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:#000000;padding:28px 40px;">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;">HEXAHUB</div>
    <div style="color:#888888;font-size:11px;margin-top:3px;">New Event</div>
  </div>

  <div style="padding:36px 40px;">
    <p style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">You're invited</p>
    <h2 style="font-size:22px;color:#111111;margin:0 0 20px;">${event.title}</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${event.date ? `
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#888888;width:80px;vertical-align:top;">Date</td>
        <td style="padding:8px 0;font-size:13px;color:#111111;font-weight:600;">
          ${fmtDate(event.date)}${event.time ? ` · ${event.time}` : ''}
        </td>
      </tr>` : ''}
      ${event.location ? `
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#888888;vertical-align:top;">Location</td>
        <td style="padding:8px 0;font-size:13px;color:#111111;">${event.location}</td>
      </tr>` : ''}
    </table>

    ${event.description ? `
    <p style="color:#444444;font-size:14px;line-height:1.7;margin:0 0 28px;">${event.description}</p>` : ''}

    <a href="${event.link || 'https://www.hexahub.com.au/events'}"
       style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;
              padding:12px 28px;font-size:13px;font-weight:600;border-radius:6px;">
      Find Out More
    </a>
  </div>

  <div style="background:#f5f5f5;padding:20px 40px;border-top:1px solid #eeeeee;">
    <p style="color:#999999;font-size:11px;margin:0;text-align:center;line-height:1.6;">
      HexaHub Pty Ltd &nbsp;·&nbsp; 402/830 Whitehorse Road, Box Hill VIC 3128<br>
      <em>build locally, scale sustainably</em> &nbsp;·&nbsp;
      <a href="https://hexahub.com.au" style="color:#999999;">hexahub.com.au</a>
    </p>
  </div>
</div>`

  let sent = 0
  for (const tenant of recipients) {
    const ok = await sendResendEmail({
      from: 'HexaHub <info@hexahub.com.au>',
      to: [tenant.email],
      subject: `New Event: ${event.title}`,
      html,
    }).then(r => r.ok).catch(() => false)
    if (ok) sent++
  }

  return res.status(200).json({ sent, total: recipients.length })
}
