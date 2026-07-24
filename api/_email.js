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
      const val = {
        mode: e.safeMode !== false,
        to: e.safeRecipient || DEFAULT_SAFE_RECIPIENT,
        // Unsubscribed addresses (Settings → Emails) — the platform never
        // emails these, on any flow. Compared lowercase.
        suppressed: (Array.isArray(e.suppressed) ? e.suppressed : []).map((a) => String(a).toLowerCase().trim()).filter(Boolean),
      }
      _cache = { at: now, val }
      return val
    }
  } catch (err) {
    console.error('email safe-config read failed:', err)
  }
  // Fail safe: if we can't read the setting, block everything but the default.
  return { mode: true, to: DEFAULT_SAFE_RECIPIENT, suppressed: [] }
}

const isSuppressed = (safe, addr) => safe.suppressed.includes(String(addr ?? '').toLowerCase().trim())

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

  // Unsubscribed addresses: drop them from every recipient field; if nobody
  // is left to address, skip the send entirely (reported ok+skipped so
  // callers treat it as a non-event, not a failure).
  const toList = (Array.isArray(p.to) ? p.to : [p.to]).filter(Boolean).filter((a) => !isSuppressed(safe, a))
  if (!toList.length) return { ok: true, skipped: true, reason: 'suppressed' }
  p.to = toList
  if (p.cc) { p.cc = p.cc.filter((a) => !isSuppressed(safe, a)); if (!p.cc.length) delete p.cc }
  if (p.bcc) { p.bcc = p.bcc.filter((a) => !isSuppressed(safe, a)); if (!p.bcc.length) delete p.bcc }

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

// Send many INDIVIDUALLY-addressed emails in one request (Resend batch, max 100
// per call). Each recipient gets their own email with a proper `To:` — no shared
// BCC, which mail providers spam-filter or drop when the envelope `to` is a
// no-reply address. Safe mode still applies: the whole batch collapses to a
// single email to the safe recipient so a broadcast can never escape in test.
// messages: [{ from, to, subject, html, replyTo? }]. Returns { ok, status, sent }.
export async function sendResendBatch(messages = []) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, skipped: true, reason: 'no_key', sent: 0 }
  if (!messages.length) return { ok: true, sent: 0 }

  const safe = await getSafeConfig()

  let batch = messages.map((m) => {
    const p = { from: m.from, to: Array.isArray(m.to) ? m.to : [m.to], subject: m.subject, html: m.html }
    const replyTo = m.replyTo ?? m.reply_to
    if (replyTo) p.reply_to = replyTo
    return p
  })
    // Unsubscribed addresses never receive batch mail either.
    .map((p) => ({ ...p, to: p.to.filter((a) => !isSuppressed(safe, a)) }))
    .filter((p) => p.to.length)
  if (!batch.length) return { ok: true, sent: 0 }

  if (safe.mode) {
    // Collapse the entire batch to ONE email to the safe recipient.
    const first = messages[0] ?? {}
    const origCount = messages.length
    batch = [{
      from: first.from,
      to: [safe.to],
      ...(first.replyTo || first.reply_to ? { reply_to: first.replyTo ?? first.reply_to } : {}),
      subject: `[TEST → ${safe.to}] ${first.subject || ''}`.trim(),
      html: `<div style="background:#fff3cd;border:1px solid #ffe69c;color:#664d03;padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;margin-bottom:12px">
        <strong>Safe mode is ON.</strong> This would normally go individually to ${origCount} recipient${origCount === 1 ? '' : 's'}. All outbound email is redirected to ${safe.to} until safe mode is turned off in Settings.
      </div>${first.html || ''}`,
    }]
  }

  try {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
    let data = null
    try { data = await res.json() } catch { /* ignore */ }
    // In safe mode the real recipients got nothing (only the safe address did).
    return { ok: res.ok, status: res.status, data, sent: res.ok ? (safe.mode ? 0 : batch.length) : 0 }
  } catch (err) {
    console.error('sendResendBatch error:', err)
    return { ok: false, error: String(err), sent: 0 }
  }
}

// Where to email a company: its own email, else the member flagged Billing
// Person, else the Contact Person, else any member with an email. Client
// twin: src/lib/credits.js billingEmailFor.
export function billingEmailFor(tenant, members = []) {
  if (tenant?.email) return tenant.email
  const mine = (members ?? []).filter((m) => m.companyId === tenant?.id && m.email)
  return (mine.find((m) => m.billingPerson) ?? mine.find((m) => m.contactPerson) ?? mine[0])?.email || ''
}
