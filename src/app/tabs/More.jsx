import { LogOut } from 'lucide-react'
import { useApp } from '../context.js'
import { Screen, Label, Display, Rule } from '../ui.jsx'

// Phase 4 — billing, events, messages, guides, account, members directory.
export default function More() {
  const { data, signOut } = useApp()
  const who = data.member?.name || data.company?.contactName || data.company?.businessName

  return (
    <Screen>
      <div className="pt-9 pb-7">
        <Label>{who}</Label>
        <Display className="mt-4">More.</Display>
      </div>
      <p className="hx-prose">Billing, events, messages and more are on their way.</p>
      <Rule className="my-8" />
      <button onClick={signOut}
        className="flex items-center gap-2 font-heading uppercase tracking-nav text-[11px] text-portal-muted active:text-ink min-h-[44px]">
        <LogOut size={14} /> Sign out
      </button>
    </Screen>
  )
}
