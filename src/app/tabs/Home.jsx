import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Mailbox, Printer, Croissant, ArrowRight, ArrowUpRight, KeyRound, Receipt, CalendarClock,
} from 'lucide-react'
import { useApp } from '../context.js'
import { Screen, Label, Display, Rule, Card, Chip, fmt, to12, money, bookingName } from '../ui.jsx'
import { invoiceTotal, unpaidInvoices } from '../lib/invoiceTotal.js'
import PaySheet from '../screens/PaySheet.jsx'

export default function Home() {
  const { data, patch } = useApp()
  const nav = useNavigate()
  const { company, member, bookings, spaces, invoices, mailItems } = data
  const [payInvoice, setPayInvoice] = useState(null)

  // Stripe Checkout bounces back to /app?paid=<invoice number>.
  const [justPaid] = useState(() => new URLSearchParams(window.location.search).get('paid'))
  useEffect(() => {
    if (justPaid) window.history.replaceState({}, '', window.location.pathname)
  }, [justPaid])

  const firstName = (member?.name || company?.contactName || company?.businessName || '').split(' ')[0]
  const awaitingMail = (mailItems ?? []).filter((m) => m.status === 'awaiting')

  const todayStr = new Date().toISOString().split('T')[0]
  const nextBooking = [...(bookings ?? [])]
    .filter((b) => b.date && b.date >= todayStr && b.status !== 'Cancelled')
    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')))[0]

  const unpaid = unpaidInvoices(invoices)
  const owing = unpaid.reduce((s, i) => s + invoiceTotal(i), 0)

  return (
    <Screen>
      {/* Greeting */}
      <div className="pt-9 pb-7">
        <Label>{format(new Date(), 'EEEE d MMMM')} · Box Hill</Label>
        <Display className="mt-4 text-[38px]">
          Hello {firstName},<br />welcome back.
        </Display>
      </div>

      {justPaid && (
        <div className="mb-5 border border-hexa-green/40 bg-hexa-green/10 px-4 py-3">
          <p className="hx-prose text-[13px] text-ink">
            ✓ Payment received for <span className="font-heading uppercase tracking-nav text-[11px]">{justPaid}</span> — thank
            you. It will show as paid within a few minutes.
          </p>
        </div>
      )}

      {/* Unpaid invoice banner */}
      {unpaid.length > 0 && !justPaid && (
        <button onClick={() => setPayInvoice(unpaid[0])}
          className="w-full mb-5 bg-charcoal text-paper px-5 py-4 flex items-center gap-4 text-left active:opacity-80">
          <Receipt size={18} strokeWidth={1.5} className="text-hexa-green shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block font-heading uppercase tracking-nav text-[10px] text-paper/60">
              {unpaid.length === 1 ? 'Invoice due' : `${unpaid.length} invoices due`}
            </span>
            <span className="block font-display font-extralight text-xl mt-0.5">
              {money(owing)}{unpaid.some((i) => i.status === 'overdue') ? ' · overdue' : ''}
            </span>
          </span>
          <span className="font-heading uppercase tracking-nav text-[10px] text-hexa-green shrink-0">
            Pay <ArrowRight size={11} className="inline -mt-0.5" />
          </span>
        </button>
      )}

      {/* Door access — Salto mobile key; the slot exists ahead of go-live */}
      <div className="bg-charcoal text-paper p-6">
        <div className="flex items-center justify-between">
          <Label className="text-paper/50">Door access</Label>
          <Chip tone="green">Coming soon</Chip>
        </div>
        <div className="flex items-center gap-4 mt-6">
          <span className="h-12 w-12 shrink-0 border border-paper/20 bg-paper/5 flex items-center justify-center">
            <KeyRound size={18} strokeWidth={1.4} className="text-paper/70" />
          </span>
          <div>
            <p className="font-heading uppercase tracking-nav text-[11px] text-paper">Mobile key</p>
            <p className="hx-prose text-[12px] text-paper/50 mt-0.5">Unlock the door from your phone</p>
          </div>
        </div>
        <p className="hx-prose text-[12px] text-paper/50 mt-5">
          Smart access is on its way — your key will live here. Until then, your access pass works
          around the clock.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-px bg-ink/10 mt-px">
        <QuickAction icon={Mailbox} label={'Mail &\ndeliveries'} onClick={() => nav('/mail')}
          badge={awaitingMail.length > 0 ? awaitingMail.length : null} />
        <QuickAction icon={Printer} label={'Printer\nsetup'} onClick={() => nav('/printer')} />
        <QuickAction icon={Croissant} label={'Order\nfood'} onClick={() => nav('/food')} />
      </div>

      {/* Next booking */}
      <div className="mt-9">
        <div className="flex items-center justify-between mb-4">
          <Label>Next booking</Label>
          <Link to="/book" className="font-heading uppercase tracking-nav text-[10px] text-ink flex items-center gap-1 py-2 active:opacity-60">
            Book <ArrowUpRight size={11} />
          </Link>
        </div>
        {nextBooking ? (
          <Card className="p-5 flex items-center gap-4">
            <div className="bg-bone border border-ink/10 h-14 w-14 shrink-0 flex flex-col items-center justify-center">
              <span className="font-display font-extralight text-xl leading-none">{nextBooking.date.slice(8, 10)}</span>
              <span className="font-heading uppercase tracking-label text-[8px] text-portal-muted mt-1">
                {format(new Date(nextBooking.date + 'T00:00:00'), 'MMM')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading uppercase tracking-nav text-[11px] text-ink truncate">
                {bookingName(spaces, nextBooking)}
              </div>
              <div className="hx-prose text-[12px] mt-1">
                {fmt(nextBooking.date)}{nextBooking.startTime ? ` · ${to12(nextBooking.startTime)} – ${to12(nextBooking.endTime)}` : ''}
              </div>
            </div>
            <Chip tone={nextBooking.status === 'Confirmed' ? 'green' : 'ink'}>{nextBooking.status}</Chip>
          </Card>
        ) : (
          <Card onClick={() => nav('/book')} className="p-5 flex items-center gap-4">
            <CalendarClock size={18} strokeWidth={1.4} className="text-hexa-green shrink-0" />
            <span className="flex-1">
              <span className="block font-heading uppercase tracking-nav text-[11px] text-ink">No upcoming bookings</span>
              <span className="block hx-prose text-[12px] mt-0.5">Book a meeting room or studio</span>
            </span>
            <ArrowRight size={14} className="text-ink shrink-0" />
          </Card>
        )}
      </div>

      <Rule className="mt-10 mb-6" />
      <p className="hx-prose text-[12px] text-center">
        Hexa Space · 402/830 Whitehorse Road, Box Hill · build locally, scale sustainably
      </p>

      {payInvoice && (
        <PaySheet
          invoice={payInvoice}
          company={company}
          onClose={() => setPayInvoice(null)}
          onPaid={(updated) => {
            patch((prev) => ({
              ...prev,
              invoices: prev.invoices.map((i) => (i.id === updated.id ? updated : i)),
            }))
            setPayInvoice(null)
          }}
        />
      )}
    </Screen>
  )
}

function QuickAction({ icon: Icon, label, onClick, badge }) {
  return (
    <button onClick={onClick} className="relative bg-paper p-4 min-h-[96px] flex flex-col items-start justify-between active:bg-bone transition-colors">
      <Icon size={18} strokeWidth={1.4} className="text-ink" />
      {badge != null && (
        <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 bg-hexa-green text-paper text-[10px] font-heading flex items-center justify-center">
          {badge}
        </span>
      )}
      <span className="font-heading uppercase tracking-nav text-[10px] text-ink text-left whitespace-pre-line leading-[1.5]">
        {label}
      </span>
    </button>
  )
}
