import { Printer as PrinterIcon, Wifi } from 'lucide-react'
import { useApp } from '../context.js'
import { usePrintPin } from '../lib/usePrintPin.js'
import { Screen, BackHeader, Label, Card } from '../ui.jsx'

// Printer setup — mirrors the portal guide (PaperCut) plus the member's own
// print account details, phone-sized.
export default function Printer() {
  const { data } = useApp()
  const email = data.member?.email || data.company?.email || ''
  const pin = usePrintPin()

  return (
    <Screen>
      <BackHeader title="Printing" />
      <div className="bg-charcoal text-paper p-6 mt-2">
        <div className="flex items-center justify-between">
          <Label className="text-paper/50">Your print account</Label>
          <PrinterIcon size={16} strokeWidth={1.4} className="text-paper/40" />
        </div>
        <p className="font-display font-extralight text-2xl mt-4">PaperCut · Hexa-Secure</p>

        {/* Print PIN — prominent, since members type it at the copier keypad */}
        {pin && (
          <div className="mt-5 border border-paper/20 bg-paper/5 px-4 py-3.5 flex items-end justify-between">
            <div>
              <span className="block font-heading uppercase tracking-label text-[10px] text-paper/50">Your print PIN</span>
              <span className="block hx-prose text-[11px] text-paper/40 mt-1">Type at the keypad, or tap your pass</span>
            </div>
            <span className="font-mono text-3xl tracking-[0.3em] text-hexa-green leading-none">{pin}</span>
          </div>
        )}

        <div className="border-t border-paper/15 my-4" />
        <div className="space-y-2">
          <KV k="Sign-in" v={email || 'your member email'} />
          <KV k="Portal" v="print.hexaspace.com.au" />
          <KV k="Queue" v="Hexa-Secure" />
          <KV k="Release" v="Tap your access pass at any printer" />
        </div>
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

function KV({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="hx-prose text-[12px] text-paper/50">{k}</span>
      <span className="font-body text-[13px] text-paper text-right break-all">{v}</span>
    </div>
  )
}
