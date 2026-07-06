import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// The signed-in member's OWN print PIN (PaperCut Primary Card/Identity number),
// fetched from the JWT-verified owner-scoped endpoint — never from the bulk member
// data (which is readable by every member). Returns null until loaded / if none.
export function usePrintPin() {
  const [pin, setPin] = useState(null)
  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token
      if (!token) return
      fetch('/api/portal/print-pin', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d?.pin) setPin(d.pin) })
        .catch(() => {})
    })
    return () => { alive = false }
  }, [])
  return pin
}
