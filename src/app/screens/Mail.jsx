import { Mailbox, Package } from 'lucide-react'
import { useApp } from '../context.js'
import { Screen, BackHeader, Label, Rule, Chip, EmptyNote, fmt } from '../ui.jsx'

// Mail & Deliveries — items reception has logged for this company (mail_items).
// Members collect from reception; items disappear from "waiting" once marked
// collected at handover.
export default function Mail() {
  const { data } = useApp()
  const items = [...(data.mailItems ?? [])].sort((a, b) => (b.loggedAt || '').localeCompare(a.loggedAt || ''))
  const awaiting = items.filter((m) => m.status === 'awaiting')
  const collected = items.filter((m) => m.status === 'collected').slice(0, 10)

  return (
    <Screen>
      <BackHeader title="Mail & Deliveries" />
      <p className="font-display font-extralight text-[28px] leading-tight text-ink mt-2 mb-1">
        {awaiting.length === 0
          ? 'Nothing waiting for you.'
          : awaiting.length === 1 ? 'One item is waiting.' : `${awaiting.length} items are waiting.`}
      </p>
      <p className="hx-prose text-[13px] mb-8">
        Collect from reception during opening hours. Parcels left over 48 hours may incur storage
        charges (see House Rules).
      </p>

      {awaiting.length > 0 && (
        <>
          <Label className="mb-2">Awaiting pickup</Label>
          <div className="divide-y divide-ink/5 border-y border-ink/10">
            {awaiting.map((m) => <MailRow key={m.id} item={m} />)}
          </div>
        </>
      )}

      {collected.length > 0 && (
        <>
          <Label className="mt-10 mb-2">Recently collected</Label>
          <div className="divide-y divide-ink/5 border-y border-ink/10 opacity-60">
            {collected.map((m) => <MailRow key={m.id} item={m} collected />)}
          </div>
        </>
      )}

      {items.length === 0 && (
        <>
          <Rule />
          <EmptyNote label="No mail on file." sub="We'll notify you the moment something arrives." />
        </>
      )}
    </Screen>
  )
}

function MailRow({ item, collected = false }) {
  const Icon = item.type === 'parcel' ? Package : Mailbox
  return (
    <div className="flex items-center gap-4 py-4 min-h-[60px]">
      <span className="h-10 w-10 shrink-0 bg-paper border border-ink/10 flex items-center justify-center">
        <Icon size={16} strokeWidth={1.5} className="text-ink" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-heading uppercase tracking-nav text-[11px] text-ink capitalize">
          {item.type}{item.description ? ` · ${item.description}` : ''}
        </span>
        <span className="block hx-prose text-[12px] mt-0.5">
          Arrived {item.loggedAt ? fmt(item.loggedAt.split('T')[0]) : '—'}
          {collected && item.collectedAt ? ` · collected ${fmt(item.collectedAt.split('T')[0])}` : ''}
        </span>
      </span>
      <Chip tone={collected ? 'ink' : 'green'}>{collected ? 'Collected' : 'At reception'}</Chip>
    </div>
  )
}
