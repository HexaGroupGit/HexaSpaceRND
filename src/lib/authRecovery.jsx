import { useState } from 'react'
import { supabase } from './supabase.js'

// Set-password (invite / password-reset) flow, shared by the admin and member
// apps. The arrival hash is read ONCE, synchronously at module load — before
// Supabase's async URL processing can clear it — and everything derived from it
// is exported so no other module has to race for it. Handled at the RootAuth
// level so an invited ADMIN (routed to AdminApp) gets the same set-password
// screen a member does, instead of landing on login with no way to set one.
const _hash = (typeof window !== 'undefined' && window.location.hash) || '';
const _params = new URLSearchParams(_hash.replace(/^#/, ''));

export const IS_RECOVERY_FLOW = ['recovery', 'invite'].includes(_params.get('type') || '');

// Supabase bounces a spent or expired link back here as
// `#error=access_denied&error_code=otp_expired`. Surfacing it is the difference
// between "the link just dumps me on the login page" and an actual explanation.
export const LINK_ERROR = _params.get('error_code') || _params.get('error') || '';
export const LINK_ERROR_DESC = _params.get('error_description') || '';

// Strip the fragment so a refresh (or a copied URL) doesn't replay it.
export function clearAuthHash() {
  if (typeof window !== 'undefined' && window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

// Set once the password has been set, so the member app (which mounts after the
// RootAuth screen) doesn't prompt a second time for the same link.
let _handled = false;
export const recoveryHandled = () => _handled;
export const setRecoveryHandled = () => { _handled = true; };

export function SetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setSaving(false); return; }
    setRecoveryHandled();
    onDone();
  }

  return (
    <div className="min-h-screen bg-bone flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="font-heading uppercase text-2xl tracking-[0.22em] text-ink">Hexa&nbsp;Space</div>
        </div>
        <div className="hx-card p-8">
          <h1 className="hx-h text-lg mb-2">Set your password</h1>
          <p className="hx-prose mb-6">Choose a password to secure your account, then you'll be taken straight in.</p>
          {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="hx-eyebrow block mb-1.5">New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} placeholder="At least 8 characters" className="hx-input" />
            </div>
            <div>
              <label className="hx-eyebrow block mb-1.5">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                required placeholder="Repeat your password" className="hx-input" />
            </div>
            <button type="submit" disabled={saving} className="hx-btn w-full disabled:opacity-50">
              {saving ? 'Saving…' : 'Set password & enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
