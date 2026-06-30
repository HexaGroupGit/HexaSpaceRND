import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, MessageSquare, User, Calendar, LogOut, Menu, X,
} from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/billing', label: 'Billing', icon: Receipt },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/account', label: 'Account', icon: User },
  { to: '/events', label: 'Events', icon: Calendar },
]

export default function PortalLayout({ tenant, onSignOut, children }) {
  const [open, setOpen] = useState(false)

  const sidebar = (
    <aside className="w-52 bg-black text-white flex flex-col h-full">
      <div className="px-5 py-6 border-b border-gray-800 flex items-center justify-between">
        <div>
          <span className="text-lg font-bold tracking-tight">HexaHub</span>
          <p className="text-xs text-gray-400 mt-0.5">Member Portal</p>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-gray-400 hover:text-white p-1">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/portal'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-white text-black font-semibold'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-800 shrink-0">
        <div className="text-xs text-gray-400 mb-0.5 truncate font-medium">{tenant.businessName}</div>
        <div className="text-xs text-gray-600 truncate mb-3">{tenant.email}</div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-52 z-40 md:hidden flex">
            {sidebar}
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <button onClick={() => setOpen(true)} className="text-gray-600">
            <Menu size={20} />
          </button>
          <span className="font-black tracking-widest text-sm">HEXAHUB</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
