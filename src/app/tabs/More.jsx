import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import {
  Receipt, CalendarDays, MessageSquare, BookOpen, User, Users, LogOut, ChevronRight,
} from 'lucide-react'
import { useApp } from '../context.js'
import { Screen, Label, Display, Rule } from '../ui.jsx'
import Billing from '../screens/Billing.jsx'
import Events from '../screens/Events.jsx'
import Messages from '../screens/Messages.jsx'
import Guides from '../screens/Guides.jsx'
import Account from '../screens/Account.jsx'
import Members from '../screens/Members.jsx'

export default function More() {
  return (
    <Routes>
      <Route index element={<MoreMenu />} />
      <Route path="billing" element={<Billing />} />
      <Route path="events" element={<Events />} />
      <Route path="messages" element={<Messages />} />
      <Route path="guides" element={<Guides />} />
      <Route path="account" element={<Account />} />
      <Route path="members" element={<Members />} />
      <Route path="*" element={<Navigate to="/more" replace />} />
    </Routes>
  )
}

const ITEMS = [
  { to: '/more/billing', icon: Receipt, label: 'Billing & invoices', sub: 'Invoices, membership, saved card' },
  { to: '/more/events', icon: CalendarDays, label: 'Events', sub: "What's on at Hexa Space" },
  { to: '/more/messages', icon: MessageSquare, label: 'Messages', sub: 'Talk to the Hexa team' },
  { to: '/more/guides', icon: BookOpen, label: 'Guides', sub: 'Wi-Fi, printing, access, amenities' },
  { to: '/more/members', icon: Users, label: 'Members directory', sub: 'The Hexa Space community' },
  { to: '/more/account', icon: User, label: 'Account', sub: 'Your details & payment method' },
]

function MoreMenu() {
  const { data, signOut } = useApp()
  const nav = useNavigate()
  const who = data.member?.name || data.company?.contactName || data.company?.businessName

  return (
    <Screen>
      <div className="pt-9 pb-7">
        <Label>{data.company?.businessName}</Label>
        <Display className="mt-4">{who?.split(' ')[0]}.</Display>
      </div>

      <div className="divide-y divide-ink/5 border-y border-ink/10">
        {ITEMS.map(({ to, icon: Icon, label, sub }) => (
          <button key={to} onClick={() => nav(to)}
            className="w-full flex items-center gap-4 py-4 min-h-[64px] active:opacity-60 transition-opacity">
            <span className="h-11 w-11 shrink-0 bg-paper border border-ink/10 flex items-center justify-center">
              <Icon size={16} strokeWidth={1.5} className="text-ink" />
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="block font-heading uppercase tracking-nav text-[11px] text-ink">{label}</span>
              <span className="block hx-prose text-[12px] mt-0.5 truncate">{sub}</span>
            </span>
            <ChevronRight size={15} className="text-portal-muted shrink-0" />
          </button>
        ))}
      </div>

      <button onClick={signOut}
        className="mt-8 flex items-center gap-2 font-heading uppercase tracking-nav text-[11px] text-portal-muted active:text-ink min-h-[44px]">
        <LogOut size={14} /> Sign out
      </button>

      <Rule className="mt-8 mb-5" />
      <p className="hx-prose text-[11px]">
        Hexa Space Pty Ltd · 402/830 Whitehorse Road, Box Hill VIC 3128 · hexaspace.com.au
      </p>
    </Screen>
  )
}
