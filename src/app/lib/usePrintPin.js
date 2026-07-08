import { useEffect, useState } from 'react'
import { useApp } from '../context.js'
import { apiUrl } from './native.js'

// The member's OWN print account (PaperCut Primary Card/Identity number + personal
// printing balance), fetched from the JWT-verified, owner-scoped endpoint — never
// from the bulk member data. Fields stay null until loaded (or if the member has
// none). Shared by the Printer screen and Account screen.
export function usePrintAccount() {
  const { session } = useApp()
  const accessToken = session?.access_token
  const [account, setAccount] = useState({ pin: null, balance: null, balanceUpdatedAt: null })
  useEffect(() => {
    if (!accessToken) return
    let alive = true
    fetch(apiUrl('/api/portal/print-pin'), { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setAccount({ pin: d.pin ?? null, balance: d.balance ?? null, balanceUpdatedAt: d.balanceUpdatedAt ?? null })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [accessToken])
  return account
}

// Back-compat: just the PIN string (or null).
export function usePrintPin() {
  return usePrintAccount().pin
}
