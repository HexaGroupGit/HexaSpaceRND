import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Public /set-password page — the landing point for invite and password-reset
// emails.
//
// The one-time token arrives in the URL FRAGMENT (#t=…), which browsers never
// send to a server. That matters: Supabase's own verify link is spent by a
// single background GET, so mail scanners and link previewers were burning
// reset links before members clicked them — and the portal then showed nothing
// but the login page. Here the token is only redeemed when the member submits
// the form, so nothing that merely *fetches* the URL can consume it.
export default function SetPasswordPage({ invite = false }) {
  const [token, setToken] = useState(null)   // null = still reading the hash
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dead, setDead] = useState('')       // link expired / already used

  useEffect(() => {
    const m = (window.location.hash || '').match(/[#&]t=([^&]+)/)
    setToken(m ? decodeURIComponent(m[1]) : '')
    // Keep it out of the address bar (and out of anything the member copies).
    if (m) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setSaving(true); setError('')

    // Redeem the token only now — one shot, at the member's own click.
    const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' })
    if (otpErr) { setDead(otpErr.message); setSaving(false); return }

    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) { setError(pwErr.message); setSaving(false); return }

    // Session is live — hand over to the app, which routes admin vs member.
    // Some invites nominate a landing page (?next=/function-space); only ever
    // honour a same-origin path, never a protocol-relative or absolute URL.
    const next = new URLSearchParams(window.location.search).get('next') || ''
    window.location.replace(/^\/[^/]/.test(next) ? next : '/')
  }

  if (token === null) return <Shell />

  if (!token || dead) {
    return (
      <Shell>
        <h1 className="hx-h text-lg mb-2">This link has expired</h1>
        <p className="hx-prose mb-6">
          Password links can only be used once, and requesting a new one cancels the previous
          link — so only the most recent email works. Enter your email and we'll send a fresh one.
        </p>
        <RequestNewLink />
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="hx-h text-lg mb-2">{invite ? 'Set your password' : 'Choose a new password'}</h1>
      <p className="hx-prose mb-6">
        {invite
          ? "Choose a password to secure your account, then you'll be taken straight in."
          : "Pick a new password and we'll sign you straight in."}
      </p>
      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="hx-eyebrow block mb-1.5">New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={8} autoComplete="new-password"
            placeholder="At least 8 characters" className="hx-input" />
        </div>
        <div>
          <label className="hx-eyebrow block mb-1.5">Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            required autoComplete="new-password" placeholder="Repeat your password" className="hx-input" />
        </div>
        <button type="submit" disabled={saving} className="hx-btn w-full disabled:opacity-50">
          {saving ? 'Saving…' : 'Save password & sign in'}
        </button>
      </form>
    </Shell>
  )
}

/** Branded card wrapper shared by every state of this page. */
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bone flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="font-heading uppercase text-2xl tracking-[0.22em] text-ink">Hexa&nbsp;Space</div>
          <p className="hx-eyebrow mt-2">Member Portal</p>
        </div>
        <div className="hx-card p-8">{children ?? <p className="hx-prose text-center">Loading…</p>}</div>
        <p className="text-center hx-eyebrow mt-6 normal-case tracking-normal">
          402/830 Whitehorse Road, Box Hill VIC 3128 · hexaspace.com.au
        </p>
      </div>
    </div>
  )
}

/** Inline "send me another link" form, so a dead link is never a dead end. */
export function RequestNewLink({ initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  if (sent) {
    return (
      <div className="text-sm text-hexa-green bg-hexa-green/5 border border-hexa-green/30 px-3 py-3 text-center">
        If an account exists for that email, a new link is on its way. Open the newest email and
        use it within 24 hours.
      </div>
    )
  }

  async function send(e) {
    e.preventDefault()
    setSending(true); setErr('')
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'Could not send the email. Please try again shortly.')
      }
      setSent(true)
    } catch (e2) { setErr(e2.message) }
    setSending(false)
  }

  return (
    <>
      {err && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{err}</div>}
      <form onSubmit={send} className="space-y-4">
        <div>
          <label className="hx-eyebrow block mb-1.5">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            autoComplete="email" placeholder="your@email.com" className="hx-input" />
        </div>
        <button type="submit" disabled={sending} className="hx-btn w-full disabled:opacity-50">
          {sending ? 'Sending…' : 'Send me a new link'}
        </button>
      </form>
      <a href="/" className="mt-5 hx-eyebrow hover:text-ink transition-colors w-full text-center block">
        ← Back to sign in
      </a>
    </>
  )
}
