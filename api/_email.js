// Central outbound-email guard. EVERY email in the app must go through
// sendResendEmail() so the "safe mode" allowlist can be enforced in one place.
//
// Safe mode (settings.emails.safeMode) redirects ALL recipients to a single
// address (settings.emails.safeRecipient, default eric@hexaspace.com.au) so you
// can wire up real sending without any client ever receiving an email until you
// deliberately turn it off. It is ON by default — the block only lifts when
// safeMode is explicitly set to false.
import { createClient } from '@supabase/supabase-js'

const DEFAULT_SAFE_RECIPIENT = 'eric@hexaspace.com.au'
let _cache = { at: 0, val: null }

async function getSafeConfig() {
  const now = Date.now()
  if (_cache.val && now - _cache.at < 20000) return _cache.val
  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false } })
      const { data } = await sb.from('settings').select('data').eq('id', 'global')
      const e = data?.[0]?.data?.emails ?? {}
      const val = { mode: e.safeMode !== false, to: e.safeRecipient || DEFAULT_SAFE_RECIPIENT }
      _cache = { at: now, val }
      return val
    }
  } catch (err) {
    console.error('email safe-config read failed:', err)
  }
  // Fail safe: if we can't read the setting, block everything but the default.
  return { mode: true, to: DEFAULT_SAFE_RECIPIENT }
}

// payload: { from, to, subject, html, replyTo|reply_to, cc, bcc, attachments }
// Returns { ok, skipped?, status?, data? }.
export async function sendResendEmail(payload = {}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, skipped: true, reason: 'no_key' }

  const safe = await getSafeConfig()
  const p = {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  }
  const replyTo = payload.replyTo ?? payload.reply_to
  if (replyTo) p.reply_to = replyTo
  if (payload.cc) p.cc = Array.isArray(payload.cc) ? payload.cc : [payload.cc]
  if (payload.bcc) p.bcc = Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]
  if (payload.attachments?.length) p.attachments = payload.attachments

  if (safe.mode) {
    // Redirect everything to the single safe recipient; strip cc/bcc so no one
    // else is copied, and flag the subject so it's obviously a test send.
    p.to = [safe.to]
    delete p.cc
    delete p.bcc
    const orig = Array.isArray(payload.to) ? payload.to.join(', ') : (payload.to || '')
    p.subject = `[TEST → ${safe.to}] ${payload.subject || ''}`.trim()
    p.html = `<div style="background:#fff3cd;border:1px solid #ffe69c;color:#664d03;padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;margin-bottom:12px">
      <strong>Safe mode is ON.</strong> This email would normally go to: ${orig || '—'}. All outbound email is being redirected to ${safe.to} until safe mode is turned off in Settings.
    </div>${payload.html || ''}`
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
    let data = null
    try { data = await res.json() } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    console.error('sendResendEmail error:', err)
    return { ok: false, error: String(err) }
  }
}
