import { LogOut } from 'lucide-react'
import { useApp } from '../context.js'
import { usePrintPin } from '../lib/usePrintPin.js'
import { Screen, BackHeader, Label, Card, Chip, fmt } from '../ui.jsx'
import { creditBalance, CREDIT_VALUE } from '../lib/bookingActions.js'

// Account — who you are, your company, your allowance. Read-only; changes go
// through the team (or the web portal).
export default function Account() {
  const { data, signOut } = useApp()
  const { company, member, leases } = data
  const activeLease = (leases ?? []).find((l) => l.status === 'active')
  const credits = creditBalance(company)
  const pin = usePrintPin()

  return (
    <Screen>
      <BackHeader title="Account" fallback="/more" />

      <div className="flex items-center gap-4 pt-3 pb-7">
        <div className="h-16 w-16 bg-charcoal text-paper flex items-center justify-center font-display font-extralight text-2xl">
          {(member?.name || company?.contactName || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
        </div>
        <div className="min-w-0">
          <p className="font-display font-extralight text-2xl leading-tight text-ink truncate">
            {member?.name || company?.contactName}
          </p>
          <p className="hx-prose text-[12px] mt-1 truncate">{member?.email || company?.email}</p>
        </div>
      </div>

      <Label className="mb-3">Company</Label>
      <Card className="p-5 space-y-4">
        <Field label="Business" value={company?.businessName} />
        <Field label="ABN" value={company?.abn} />
        <Field label="Primary contact" value={company?.contactName} />
        <Field label="Billing email" value={company?.email} />
      </Card>

      <Label className="mb-3 mt-8">Membership</Label>
      <Card className="p-5 space-y-4">
        <Field label="Status" value={activeLease ? <Chip tone="green">Active</Chip> : <Chip>None</Chip>} />
        {activeLease && <Field label="Term" value={`${fmt(activeLease.startDate)} – ${fmt(activeLease.endDate)}`} />}
        <Field label="Booking allowance" value={`${credits} credits remaining · A$${CREDIT_VALUE} each`} />
      </Card>

      {pin && (
        <>
          <Label className="mb-3 mt-8">Printing</Label>
          <Card className="p-5 space-y-4">
            <Field label="Print PIN" value={<span className="font-mono tracking-[0.2em] text-[15px]">{pin}</span>} />
            <Field label="Queue" value="Hexa-Secure" />
            <p className="hx-prose text-[11px]">Type your PIN at any printer keypad to release your jobs, or tap your access pass.</p>
          </Card>
        </>
      )}

      <p className="hx-prose text-[12px] mt-6">
        Something out of date? Message the team from More → Messages, or email{' '}
        <a href="mailto:info@hexaspace.com.au" className="text-hexa-green">info@hexaspace.com.au</a>.
      </p>

      <button onClick={signOut}
        className="mt-8 flex items-center gap-2 font-heading uppercase tracking-nav text-[11px] text-portal-muted active:text-ink min-h-[44px]">
        <LogOut size={14} /> Sign out
      </button>
    </Screen>
  )
}

function Field({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="hx-eyebrow mt-0.5 shrink-0">{label}</span>
      <span className="font-body text-[14px] text-ink text-right min-w-0 break-words">{value || '—'}</span>
    </div>
  )
}
