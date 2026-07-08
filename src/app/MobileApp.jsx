import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import './app.css'
import { AppCtx } from './context.js'
import { useMemberData } from './lib/useMemberData.js'
import { isNative, applyNativeChrome, onAppResume } from './lib/native.js'
import AppLogin from './AppLogin.jsx'
import TabBar from './AppShell.jsx'
import Home from './tabs/Home.jsx'
import Book from './tabs/Book.jsx'
import Food from './tabs/Food.jsx'
import More from './tabs/More.jsx'
import Mail from './screens/Mail.jsx'
import Printer from './screens/Printer.jsx'
import Key from './screens/Key.jsx'
import MemberChat from './screens/MemberChat.jsx'

/** Phone splash — auth/loading/error states share it. */
function Splash({ children }) {
  return (
    <div className="app-safe-top min-h-dvh flex items-center justify-center px-8">
      <div className="text-center w-full">
        <div className="font-heading uppercase text-lg tracking-[0.22em] text-ink">Hexa&nbsp;Space</div>
        <p className="hx-eyebrow mt-2">Member App</p>
        <div className="mt-10">{children}</div>
      </div>
    </div>
  )
}

// The member app, served at /app — a separate phone-only experience over the
// same Supabase auth + data as the portal. Members sign in once; the session
// is shared with the portal (same origin, same Supabase client).
export default function MobileApp() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const email = session?.user?.email ?? null
  const { data, loading, refresh, patch } = useMemberData(email)

  useEffect(() => {
    applyNativeChrome()
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  // Coming back from a Stripe custom tab (native) or another browser tab:
  // re-pull data so paid invoices / placed orders reflect the webhook's writes.
  useEffect(() => {
    if (!email) return
    return onAppResume(() => refresh())
  }, [email]) // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  let body
  if (session === undefined || (session && loading && !data)) {
    body = <Splash><p className="hx-prose">Loading…</p></Splash>
  } else if (!session) {
    body = <AppLogin />
  } else if (!data?.company) {
    body = (
      <Splash>
        <p className="hx-prose mb-1">No member account found for</p>
        <p className="font-heading uppercase tracking-label text-[12px] text-ink mb-8">{session.user.email}</p>
        <a href="mailto:info@hexaspace.com.au" className="hx-btn w-full mb-4">Contact Hexa Space</a>
        <button onClick={signOut} className="hx-btn-ghost mx-auto">Sign out</button>
      </Splash>
    )
  } else if (data.member && data.member.portalAccess === false) {
    body = (
      <Splash>
        <p className="hx-prose mb-1">Your membership has ended</p>
        <p className="font-heading uppercase tracking-label text-[12px] text-ink mb-8">{session.user.email}</p>
        <a href="mailto:info@hexaspace.com.au" className="hx-btn w-full mb-4">Contact Hexa Space</a>
        <button onClick={signOut} className="hx-btn-ghost mx-auto">Sign out</button>
      </Splash>
    )
  } else {
    body = (
      <AppCtx.Provider value={{ data, refresh, patch, signOut, session }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<Book />} />
          <Route path="/food" element={<Food />} />
          <Route path="/more/*" element={<More />} />
          <Route path="/mail" element={<Mail />} />
          <Route path="/printer" element={<Printer />} />
          <Route path="/key" element={<Key />} />
          <Route path="/dm/:otherId" element={<MemberChat />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TabBar />
      </AppCtx.Provider>
    )
  }

  // Native serves the bundle at the webview root; the web serves it at /app.
  return (
    <BrowserRouter basename={isNative() ? '/' : '/app'}>
      <div className="app-frame">{body}</div>
    </BrowserRouter>
  )
}
