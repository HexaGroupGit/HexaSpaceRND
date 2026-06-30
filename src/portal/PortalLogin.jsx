import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function PortalLogin() {
  const [mode, setMode] = useState('login') // 'login' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/portal`,
    })
    if (error) setError(error.message)
    else setResetSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-3xl font-black tracking-widest text-gray-900">HEXAHUB</div>
          <p className="text-sm text-gray-400 mt-1">Member Portal</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          {mode === 'login' ? (
            <>
              <h1 className="text-lg font-semibold text-gray-900 mb-6">Sign in</h1>
              {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="your@email.com"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white py-2.5 rounded text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <button
                onClick={() => { setMode('reset'); setError('') }}
                className="mt-4 text-xs text-gray-400 hover:text-gray-600 w-full text-center"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Reset password</h1>
              <p className="text-sm text-gray-500 mb-6">We'll send a reset link to your email.</p>
              {resetSent ? (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-3 text-center">
                  Check your email for a reset link.
                </div>
              ) : (
                <>
                  {error && (
                    <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="your@email.com"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-black text-white py-2.5 rounded text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                    >
                      {loading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                </>
              )}
              <button
                onClick={() => { setMode('login'); setError(''); setResetSent(false) }}
                className="mt-4 text-xs text-gray-400 hover:text-gray-600 w-full text-center"
              >
                ← Back to sign in
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          hexahub.com.au · build locally, scale sustainably
        </p>
        <p className="text-center mt-3">
          <button
            onClick={() => {
              Object.keys(localStorage)
                .filter(k => k.startsWith('sb-') || k.startsWith('supabase'))
                .forEach(k => localStorage.removeItem(k))
              sessionStorage.clear()
              window.location.replace('/')
            }}
            className="text-xs text-gray-300 hover:text-gray-500"
          >
            Having trouble signing in? Clear session
          </button>
        </p>
      </div>
    </div>
  )
}
