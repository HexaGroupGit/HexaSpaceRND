import { NavLink } from 'react-router-dom'
import { House, CalendarClock, Croissant, Ellipsis } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/book', label: 'Book', icon: CalendarClock },
  { to: '/food', label: 'Food', icon: Croissant },
  { to: '/more', label: 'More', icon: Ellipsis },
]

/** Fixed bottom tab bar — 4 tabs, big targets, tracked-caps labels. */
export default function TabBar() {
  return (
    <nav className="app-tabbar">
      <div className="grid grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className="flex flex-col items-center justify-center gap-1 min-h-[58px] active:opacity-60">
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 1.8 : 1.4}
                  className={isActive ? 'text-ink' : 'text-portal-muted'} />
                <span className={`font-heading uppercase tracking-label text-[9px] ${isActive ? 'text-ink' : 'text-portal-muted'}`}>
                  {label}
                </span>
                <span className={`h-[3px] w-[3px] rounded-full ${isActive ? 'bg-hexa-green' : 'bg-transparent'}`} />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
