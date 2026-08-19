// ─────────────────────────────────────────────────────────────────────────────
// Hexa Space member portal — shared UI kit.
// Quiet-luxury language mirrored from the marketing site (hexaspace.com.au):
// Rework Micro labels, Big Daily Short display, GT America body, hexa-green accent.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { format, parseISO, startOfMonth, startOfWeek, addDays, addMonths, isSameMonth } from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

export function fmt(dateStr) {
  if (!dateStr) return '—'
  try { return format(typeof dateStr === 'string' ? parseISO(dateStr) : dateStr, 'dd MMM yyyy') }
  catch { return '—' }
}

export function money(n) {
  return `A$${Number(n ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function money0(n) {
  return `A$${Number(n ?? 0).toLocaleString('en-AU')}`
}

/** 24h "14:00" → "2:00 pm" (booking times use the admin 24h format). */
export function to12(t) {
  if (!t) return ''
  const [h, m] = String(t).split(':').map(Number)
  if (Number.isNaN(h)) return t
  const ap = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${ap}`
}

/** Resolve a booking's room/space label from the spaces list. */
export function bookingName(spaces, b) {
  return spaces?.find((s) => s.id === b.resourceId)?.unitNumber || b.resourceName || b.title || 'Booking'
}

/** Page wrapper — bone background, generous rhythm. */
export function Page({ children }) {
  return <div className="hx-rise px-5 md:px-10 py-8 md:py-12 max-w-6xl mx-auto">{children}</div>
}

/** Editorial page header: small kicker + large serif/heading title. */
export function PageHeader({ kicker, title, children, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink/10 pb-7 mb-9">
      <div>
        {kicker && <p className="hx-eyebrow mb-3">{kicker}</p>}
        <h1 className="hx-display">{title}</h1>
        {children && <p className="hx-prose mt-4 max-w-xl">{children}</p>}
      </div>
      {action}
    </div>
  )
}

export function Eyebrow({ children, className = '' }) {
  return <p className={`hx-eyebrow ${className}`}>{children}</p>
}

export function Card({ children, className = '' }) {
  return <div className={`hx-card ${className}`}>{children}</div>
}

/** Underlined sub-tabs (Profile / Team Members / …) like the OfficeRND screens. */
export function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-ink/10 mb-9">
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key
        const label = typeof t === 'string' ? t : t.label
        const on = key === active
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`relative -mb-px pb-3 font-heading uppercase tracking-nav text-[11px] transition-colors ${
              on ? 'text-ink' : 'text-portal-muted hover:text-ink'
            }`}
          >
            {label}
            {on && <span className="absolute inset-x-0 -bottom-px h-px bg-hexa-green" />}
          </button>
        )
      })}
    </div>
  )
}

/** Soft segmented filter (All / Pending / …). */
export function Segmented({ options, active, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 border border-ink/10 p-1 bg-paper">
      {options.map((o) => {
        const key = typeof o === 'string' ? o : o.key
        const label = typeof o === 'string' ? o : o.label
        const on = key === active
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-4 py-1.5 font-heading uppercase tracking-nav text-[10px] transition-colors ${
              on ? 'bg-ink text-paper' : 'text-portal-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

const STATUS_TONE = {
  paid: 'text-hexa-green border-hexa-green/40 bg-hexa-green/5',
  active: 'text-hexa-green border-hexa-green/40 bg-hexa-green/5',
  confirmed: 'text-hexa-green border-hexa-green/40 bg-hexa-green/5',
  pending: 'text-amber-700 border-amber-300 bg-amber-50',
  overdue: 'text-red-700 border-red-300 bg-red-50',
  cancelled: 'text-red-700 border-red-300 bg-red-50',
  voided: 'text-portal-muted border-ink/15 bg-bone',
  draft: 'text-portal-muted border-ink/15 bg-bone',
  completed: 'text-portal-muted border-ink/15 bg-bone',
  expired: 'text-portal-muted border-ink/15 bg-bone',
}

export function StatusBadge({ status }) {
  const key = String(status ?? '').toLowerCase()
  const tone = STATUS_TONE[key] ?? STATUS_TONE.draft
  return (
    <span className={`inline-block font-heading uppercase tracking-label text-[9px] px-2.5 py-1 border ${tone}`}>
      {status}
    </span>
  )
}

/** Empty state — centered hairline note. */
export function Empty({ label = 'Nothing here yet.', sub }) {
  return (
    <div className="hx-card py-16 px-6 text-center">
      <p className="font-display font-extralight text-2xl text-ink/70">{label}</p>
      {sub && <p className="hx-prose mt-2">{sub}</p>}
    </div>
  )
}

/** Two-column key/value field used across Account/Billing. */
export function Field({ label, value }) {
  return (
    <div>
      <div className="hx-eyebrow mb-1.5">{label}</div>
      <div className="font-body text-[15px] text-ink">{value || '—'}</div>
    </div>
  )
}

/**
 * Room/studio photo — same sources as the member app: `space.photo` if the
 * space record carries a URL, else /rooms/<space id>.jpg in public/. Drops to
 * the monogram plate when neither exists, so rooms without a photo still read
 * as deliberate rather than broken.
 */
export function RoomPhoto({ room, className = '' }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <Monogram name={room.unitNumber} className={className} />
  return (
    <img
      src={room.photo || `/rooms/${room.id}.jpg`}
      alt={room.unitNumber}
      onError={() => setFailed(true)}
      className={`block object-cover ${className}`}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Date dropdown — the brand's own month picker.
// Used by the portal calendar and the app's room calendar so a member can jump
// straight to a date instead of stepping through days one chevron at a time.
// Deliberately not <input type="date">: that renders the OS picker, which looks
// nothing like us and reads differently on every phone.
// ─────────────────────────────────────────────────────────────────────────────
const DAY_MS = 86400000
const toDay = (v) => (v instanceof Date ? v : new Date(`${v}T00:00:00`))
const dayStr = (d) => format(d, 'yyyy-MM-dd')
const WEEK_STARTS = { weekStartsOn: 1 } // Monday — Australian convention

/**
 * @param value    'yyyy-MM-dd' selected day
 * @param onChange (dayString) => void
 * @param min/max  'yyyy-MM-dd' bounds (inclusive); days outside are unpickable
 * @param inline   true  → the panel pushes content down (phone)
 *                 false → floating popover with click-away (desktop)
 * @param size     'md' (app rows) | 'lg' (portal page header)
 */
export function DateDropdown({ value, onChange, min, max, inline = false, size = 'md', className = '', label }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(toDay(value)))
  const wrap = useRef(null)

  // Re-centre the grid on the selected month each time it opens.
  useEffect(() => { if (open) setMonth(startOfMonth(toDay(value))) }, [open, value])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    if (!inline) document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [open, inline])

  const selected = toDay(value)
  const today = dayStr(new Date())
  const gridStart = startOfWeek(startOfMonth(month), WEEK_STARTS)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const blocked = (ds) => (min && ds < min) || (max && ds > max)
  // A month is reachable only while it still holds a pickable day.
  const monthKey = (d) => format(d, 'yyyy-MM')
  const prevOK = !min || monthKey(addMonths(month, -1)) >= min.slice(0, 7)
  const nextOK = !max || monthKey(addMonths(month, 1)) <= max.slice(0, 7)

  const pick = (d) => { onChange(dayStr(d)); setOpen(false) }

  const panel = (
    <div className="bg-paper border border-ink/15 p-3 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => prevOK && setMonth((m) => addMonths(m, -1))} disabled={!prevOK}
          aria-label="Previous month"
          className="h-9 w-9 flex items-center justify-center text-portal-muted hover:text-ink disabled:opacity-25">
          <ChevronLeft size={15} strokeWidth={1.6} />
        </button>
        <span className="font-heading uppercase tracking-nav text-[11px] text-ink">{format(month, 'MMMM yyyy')}</span>
        <button type="button" onClick={() => nextOK && setMonth((m) => addMonths(m, 1))} disabled={!nextOK}
          aria-label="Next month"
          className="h-9 w-9 flex items-center justify-center text-portal-muted hover:text-ink disabled:opacity-25">
          <ChevronRight size={15} strokeWidth={1.6} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {cells.slice(0, 7).map((d, i) => (
          <span key={i} className="h-6 flex items-center justify-center font-heading uppercase tracking-label text-[9px] text-portal-muted">
            {format(d, 'EEEEE')}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const ds = dayStr(d)
          const off = !isSameMonth(d, month)
          const no = blocked(ds)
          const on = ds === dayStr(selected)
          return (
            <button key={ds} type="button" disabled={no} onClick={() => pick(d)}
              className={`relative h-10 font-display font-extralight text-[15px] transition-colors ${
                on ? 'bg-ink text-paper'
                  : no ? 'text-ink/20 cursor-not-allowed'
                  : off ? 'text-ink/35 hover:bg-bone active:bg-bone'
                  : 'text-ink hover:bg-bone active:bg-bone'}`}>
              {format(d, 'd')}
              {ds === today && !on && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 bg-hexa-green" />}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-ink/10 mt-2 pt-2">
        <button type="button" onClick={() => !blocked(today) && pick(new Date())} disabled={blocked(today)}
          className="font-heading uppercase tracking-nav text-[10px] text-ink border-b border-hexa-green pb-0.5 disabled:opacity-30 disabled:border-ink/20">
          Today
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="font-heading uppercase tracking-nav text-[10px] text-portal-muted hover:text-ink">
          Close
        </button>
      </div>
    </div>
  )

  return (
    <div ref={wrap} className={`${inline ? '' : 'relative'} ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 border border-ink/15 bg-paper px-4 text-left transition-colors hover:bg-bone active:bg-bone ${
          size === 'lg' ? 'min-h-[46px] py-2' : 'min-h-[52px] py-2.5'}`}>
        <span className="min-w-0">
          {label && <span className="hx-eyebrow block mb-0.5">{label}</span>}
          <span className={`block font-display font-extralight text-ink truncate ${size === 'lg' ? 'text-2xl' : 'text-[18px]'}`}>
            {format(selected, 'EEEE, d MMMM')}
          </span>
        </span>
        <ChevronDown size={16} strokeWidth={1.6} className={`shrink-0 text-portal-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (inline
        ? <div className="mt-2">{panel}</div>
        : <div className="absolute left-0 top-full mt-2 z-40 w-[19rem]">{panel}</div>)}
    </div>
  )
}

/** Days between two 'yyyy-MM-dd' strings — used to size date strips. */
export function daysBetween(fromStr, toStr) {
  return Math.round((toDay(toStr).getTime() - toDay(fromStr).getTime()) / DAY_MS)
}

/** Monogram avatar (initials) — matches the OfficeRND member cards. */
export function Monogram({ name = '', className = '' }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  return (
    <div className={`flex items-center justify-center bg-stone text-ink/50 font-heading tracking-label text-sm ${className}`}>
      {initials || '—'}
    </div>
  )
}
