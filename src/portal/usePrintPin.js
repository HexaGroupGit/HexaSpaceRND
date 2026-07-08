import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// The signed-in member's OWN print account (PaperCut Primary Card/Identity number
// + personal printing balance), fetched from the JWT-verified owner-scoped endpoint —
// never from the bulk member data (which is readable by every member).
// Fields stay null until loaded / when we have nothing synced for this member.
export function usePrintAccount() {
  const [account, setAccount] = useState({ pin: null, balance: null, balanceUpdatedAt: null })
  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token
      if (!token) return
      fetch('/api/portal/print-pin', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setAccount({ pin: d.pin ?? null, balance: d.balance ?? null, balanceUpdatedAt: d.balanceUpdatedAt ?? null })
        })
        .catch(() => {})
    })
    return () => { alive = false }
  }, [])
  return account
}

// Back-compat: just the PIN string (or null).
export function usePrintPin() {
  return usePrintAccount().pin
}
