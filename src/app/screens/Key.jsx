import { useState, useEffect, useRef } from 'react'
import { KeyRound, Check, ArrowUpRight, DoorOpen } from 'lucide-react'
import { useApp } from '../context.js'
import { Screen, BackHeader, Label, Card, Rule } from '../ui.jsx'
import { apiUrl } from '../lib/native.js'
import { authHeaders } from '../../lib/apiFetch.js'
import { saltoWebUrl } from '../lib/doorAccess.js'

// My key — tap-to-unlock the member's OWN office door. The server decides
// which doors they may open (active contract + admin lock mapping); this
// screen is just the big button. Building entry (front door, lifts, common
// areas) stays on the fob / Salto BLE key by policy — reflected in the copy.

export default function Key() {
  const { data } = useApp()
  const [info, setInfo] = useState(null)     // { enabled, doors, remaining }
  const [doorIdx, setDoorIdx] = useState(0)
  const [phase, setPhase] = useState('idle') // idle | unlocking | open | error
  const [error, setError] = useState('')
  const resetTimer = useRef(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch(apiUrl('/api/salto/open'), { headers: await authHeaders() })
        const d = r.ok ? await r.json() : null
        if (alive) setInfo(d ?? { enabled: false, doors: [] })
      } catch { if (alive) setInfo({ enabled: false, doors: [] }) }
    })()
    return () => { alive = false; if (resetTimer.current) clearTimeout(resetTimer.current) }
  }, [])

  const doors = info?.doors ?? []
  const door = doors[Math.min(doorIdx, doors.length - 1)]
  const hasKey = info?.enabled && doors.length > 0

  async function unlock() {
    if (!door || phase === 'unlocking') return
    setPhase('unlocking'); setError('')
    try {
      const r = await fetch(apiUrl('/api/salto/open'), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ spaceId: door.spaceId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Could not unlock — try your fob or the Salto app.')
      setPhase('open')
      if (navigator.vibrate) navigator.vibrate(30)
      resetTimer.current = setTimeout(() => setPhase('idle'), 6000)
    } catch (e) {
      setPhase('error'); setError(e.message)
      resetTimer.current = setTimeout(() => setPhase('idle'), 6000)
    }
  }

  return (
    <Screen>
      <BackHeader title="My key" />

      {!info && (
        <Card className="p-6 mt-4"><p className="hx-prose text-[13px]">Checking your access…</p></Card>
      )}

      {info && hasKey && (
        <>
          {/* Which office (only when they hold more than one) */}
          {doors.length > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {doors.map((d, i) => (
                <button key={d.spaceId} onClick={() => { setDoorIdx(i); setPhase('idle') }}
                  className={`px-4 py-2 font-heading uppercase tracking-nav text-[11px] border ${
                    i === doorIdx ? 'bg-ink text-paper border-ink' : 'text-ink border-ink/20'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {/* The door */}
          <div className="text-center mt-8">
            <Label>Your office</Label>
            <p className="font-display font-extralight text-4xl mt-2">{door.label}</p>
          </div>

          {/* The button */}
          <div className="flex justify-center mt-10 mb-6">
            <button onClick={unlock} disabled={phase === 'unlocking'} aria-label={`Unlock ${door.label}`}
              className={`h-56 w-56 rounded-full flex flex-col items-center justify-center gap-3 select-none
                transition-all duration-300 border-2 active:scale-95
                ${phase === 'open'
                  ? 'bg-hexa-green border-hexa-green text-paper'
                  : phase === 'unlocking'
                    ? 'bg-ink border-ink text-paper animate-pulse'
                    : 'bg-paper border-ink text-ink'}`}>
              {phase === 'open'
                ? <Check size={44} strokeWidth={1.5} />
                : phase === 'unlocking'
                  ? <DoorOpen size={40} strokeWidth={1.3} />
                  : <KeyRound size={40} strokeWidth={1.3} />}
              <span className="font-heading uppercase tracking-nav text-[12px]">
                {phase === 'open' ? 'Unlocked' : phase === 'unlocking' ? 'Unlocking…' : 'Tap to unlock'}
              </span>
            </button>
          </div>

          <p className={`text-center hx-prose text-[13px] min-h-[20px] ${phase === 'error' ? 'text-red-700' : ''}`}>
            {phase === 'open' && 'Give the door a few seconds, then push.'}
            {phase === 'error' && error}
            {(phase === 'idle' || phase === 'unlocking') && 'Opens your own office door only.'}
          </p>
          {Number.isFinite(info.remaining) && info.remaining <= 3 && phase !== 'error' && (
            <p className="text-center hx-prose text-[11px] mt-1">{info.remaining} unlock{info.remaining === 1 ? '' : 's'} left today</p>
          )}
        </>
      )}

      {info && !hasKey && (
        <Card className="p-6 mt-6 text-center">
          <KeyRound size={20} strokeWidth={1.4} className="mx-auto text-portal-muted" />
          <p className="hx-prose text-[13px] mt-3">
            In-app unlock isn't set up for your office yet — your key lives in the Salto app below.
          </p>
        </Card>
      )}

      {/* Building entry — always via fob / Salto BLE at the door */}
      <Rule className="mt-10 mb-6" />
      <Label className="mb-3">Building entry</Label>
      <Card className="p-5">
        <p className="hx-prose text-[13px] text-ink">
          Front door, lifts and common areas open with your access pass, or the Salto app held at the reader —
          including after hours if your membership has 24/7 access.
        </p>
      </Card>
      <button onClick={() => window.open(saltoWebUrl(data.settings), '_blank', 'noopener')}
        className="mt-4 w-full min-h-[48px] border border-ink/15 font-heading uppercase tracking-nav text-[11px] text-ink flex items-center justify-center gap-2 active:bg-bone">
        <ArrowUpRight size={14} /> Open the Salto app
      </button>
    </Screen>
  )
}
