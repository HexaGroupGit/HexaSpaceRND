import { useEffect, useState } from 'react'
import { useApp } from '../context.js'
import { apiUrl } from './native.js'

// The member's OWN print PIN (their PaperCut Primary Card/Identity number), fetched
// from the JWT-verified, owner-scoped endpoint — never from the bulk member data.
// Returns null until it loads (or if the member has none). Shared by the Printer
// screen and Account screen.
export function usePrintPin() {
  const { session } = useApp()
  const accessToken = session?.access_token
  const [pin, setPin] = useState(null)
  useEffect(() => {
    if (!accessToken) return
    let alive = true
    fetch(apiUrl('/api/portal/print-pin'), { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.pin) setPin(d.pin) })
      .catch(() => {})
    return () => { alive = false }
  }, [accessToken])
  return pin
}
