import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Label, BigButton } from './ui.jsx'

// Phone-first sign-in — same Supabase member auth as the portal, restyled for
// the app: full-height bone screen, serif welcome, big targets.
export default function AppLogin() {
  const [mode, setMode] = useState('login') // 'login' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) setError(error.message)
    else setResetSent(true)
    setLoading(false)
  }

  return (
    <div className="app-safe-top min-h-dvh flex flex-col px-6 pb-10">
      <div className="pt-16 pb-12">
        <div className="font-heading uppercase text-lg tracking-[0.22em] text-ink">Hexa&nbsp;Space</div>
        <h1 className="font-display font-extralight text-[40px] leading-[1.05] text-ink mt-8">
          {mode === 'login' ? <>Welcome to<br />the club.</> : <>Reset your<br />password.</>}
        </h1>
        <Label className="mt-4">Member App · Box Hill</Label>
      </div>

      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="hx-eyebrow block mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              autoComplete="email" placeholder="your@email.com" className="hx-input min-h-[50px]" />
          </div>
          <div>
            <label className="hx-eyebrow block mb-2">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password" placeholder="••••••••" className="hx-input min-h-[50px]" />
          </div>
          <BigButton disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</BigButton>
          <button type="button" onClick={() => { setMode('reset'); setError('') }}
            className="hx-eyebrow w-full text-center py-3 active:opacity-60">
            Forgot password?
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-5">
          {resetSent ? (
            <div className="text-sm text-hexa-green bg-hexa-green/5 border border-hexa-green/30 px-3 py-4 text-center">
              Check your email for a reset link.
            </div>
          ) : (
            <>
              <div>
                <label className="hx-eyebrow block mb-2">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="your@email.com" className="hx-input min-h-[50px]" />
              </div>
              <BigButton disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</BigButton>
            </>
          )}
          <button type="button" onClick={() => { setMode('login'); setError(''); setResetSent(false) }}
            className="hx-eyebrow w-full text-center py-3 active:opacity-60">
            ← Back to sign in
          </button>
        </form>
      )}

      <p className="hx-prose text-[11px] text-center mt-auto pt-10">
        402/830 Whitehorse Road, Box Hill VIC 3128 · hexaspace.com.au
      </p>
    </div>
  )
}
