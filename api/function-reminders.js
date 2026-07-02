// Vercel cron — GET/POST /api/function-reminders (daily).
// Emails confirmed function clients 1 week and 1 day before their event.
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from './_email.js'

const SUPABASE_URL = process.env.SUPABASE_URL

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default async function handler(req, res) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  try {
    const [{ data: rows }, { data: settRows }] = await Promise.all([
      supabase.from('function_bookings').select('id, data'),
      supabase.from('settings').select('data').eq('id', 'global'),
    ])
    const settings = settRows?.[0]?.data ?? {}
    const in7 = addDays(7)
    const in1 = addDays(1)
    const bookings = (rows ?? []).map((r) => r.data).filter((b) => b?.stage === 'confirmed' && b?.eventDate)

    let sent = 0
    for (const b of bookings) {
      let flag = null
      if (b.eventDate === in7 && !b.reminded7) flag = 'reminded7'
      else if (b.eventDate === in1 && !b.reminded1) flag = 'reminded1'
      if (!flag) continue
      const when = flag === 'reminded7' ? 'in one week' : 'tomorrow'
      await emailReminder(settings, b, when)
      const now = new Date().toISOString()
      await supabase.from('function_bookings').upsert({ id: b.id, data: { ...b, [flag]: now, updatedAt: now }, updated_at: now })
      sent++
    }
    return res.status(200).json({ ok: true, sent })
  } catch (err) {
    console.error('function-reminders error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}

async function emailReminder(settings, b, when) {
  if (!b.email) return
  const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
  const fromEmail = settings?.emails?.fromEmail || 'noreply@hexahub.com.au'
  const replyTo = settings?.emails?.replyTo || settings?.emails?.notificationEmail
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
  <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
    <div style="background:#000;padding:24px 32px"><span style="color:#fff;font-size:18px;font-weight:900;letter-spacing:3px">${fromName.toUpperCase()}</span><span style="color:#888;font-size:12px;margin-left:12px">Function Space Hire</span></div>
    <div style="padding:32px">
      <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Event reminder</p>
      <h2 style="font-size:20px;color:#111;margin:0 0 18px">Your function is ${when}, ${b.name || 'there'}!</h2>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px">
        <tr><td style="padding:6px 0;color:#888;width:120px">Event</td><td style="padding:6px 0;color:#111">${b.eventName || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Date</td><td style="padding:6px 0;color:#111">${b.eventDate} · ${b.startTime || ''}–${b.endTime || ''}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Guests</td><td style="padding:6px 0;color:#111">${b.guests || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Layout</td><td style="padding:6px 0;color:#111">${b.layout || '—'}</td></tr>
      </table>
      <p style="font-size:13px;color:#555;margin:0 0 8px">You have 1 hour of complimentary bump-in and bump-out either side of your booking. If you have any final questions, just reply to this email.</p>
      <p style="font-size:13px;color:#555;margin:0">See you soon!</p>
    </div>
  </div></body></html>`
  await sendResendEmail({ from: `${fromName} <${fromEmail}>`, to: b.email, replyTo, subject: `Reminder: your Hexa Space function is ${when}`, html })
}
