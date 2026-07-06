import { useEffect, useState } from 'react'
import { Printer as PrinterIcon, Wifi } from 'lucide-react'
import { useApp } from '../context.js'
import { apiUrl } from '../lib/native.js'
import { Screen, BackHeader, Label, Card } from '../ui.jsx'

// Printer setup — mirrors the portal guide (PaperCut) plus the member's own
// print account details, phone-sized.
export default function Printer() {
  const { data, session } = useApp()
  const email = data.member?.email || data.company?.email || ''
  const pin = usePrintPin(session?.access_token)

  return (
    <Screen>
      <BackHeader title="Printing" />
      <div className="bg-charcoal text-paper p-6 mt-2">
        <div className="flex items-center justify-between">
          <Label className="text-paper/50">Your print account</Label>
          <PrinterIcon size={16} strokeWidth={1.4} className="text-paper/40" />
        </div>
        <p className="font-display font-extralight text-2xl mt-4">PaperCut · Hexa-Secure</p>
        <div className="border-t border-paper/15 my-4" />
        <div className="space-y-2">
          <KV k="Sign-in" v={email || 'your member email'} />
          {pin && <KV k="Your PIN" v={pin} mono />}
          <KV k="Portal" v="print.hexaspace.com.au" />
          <KV k="Queue" v="Hexa-Secure" />
          <KV k="Release" v="Tap your access pass at any printer" />
        </div>
        {pin && <p className="hx-prose text-[11px] text-paper/40 mt-3">Enter this PIN at the printer keypad if you don't have your access pass.</p>}
      </div>

      <Label className="mt-9 mb-3">Set up in four steps</Label>
      <div className="space-y-px bg-ink/10">
        {[
          ['Connect to the “Hexa Space” Wi-Fi network.', Wifi],
          ['Visit print.hexaspace.com.au and sign in with your member email.', null],
          ['Install the PaperCut client for your device when prompted.', null],
          ['Send your document to the “Hexa-Secure” queue, then tap your access pass at any printer to release it.', null],
        ].map(([step], i) => (
          <Card key={i} className="p-5 flex gap-4">
            <span className="font-heading text-hexa-green text-[12px] tracking-label mt-0.5 shrink-0">0{i + 1}</span>
            <span className="hx-prose text-[14px] text-ink">{step}</span>
          </Card>
        ))}
      </div>

      <p className="hx-prose text-[12px] mt-6">
        Trouble printing? Message the team from the More tab and we'll sort it out.
      </p>
    </Screen>
  )
}

function KV({ k, v, mono }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="hx-prose text-[12px] text-paper/50">{k}</span>
      <span className={`text-[13px] text-paper text-right break-all ${mono ? 'font-mono tracking-[0.2em]' : 'font-body'}`}>{v}</span>
    </div>
  )
}

// Fetches the member's OWN print PIN from the JWT-verified endpoint. The pin is
// never in the bulk member data (that's world-readable to all members) — it comes
// only from this authenticated, owner-scoped call.
function usePrintPin(accessToken) {
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
