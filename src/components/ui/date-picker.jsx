import { useState, useEffect, useRef } from 'react'
import { format, startOfMonth, startOfWeek, addDays, addMonths, isSameMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils.js'

// Month picker for the admin's date controls: click the date itself and pick a
// day from the month, instead of stepping there one arrow at a time.
//
// Deliberately not <input type="date">. That hands over to the OS picker, which
// ignores the admin's own type and spacing and behaves differently in every
// browser — and on a booking screen the date is the primary control, not a
// field buried in a form.
//
// value / onChange speak 'yyyy-MM-dd'; min and max (also 'yyyy-MM-dd', both
// inclusive) bound what can be picked.

const WEEK_STARTS = { weekStartsOn: 1 } // Monday — Australian convention
const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const toDay = (v) => (v instanceof Date ? v : new Date(`${v}T00:00:00`))
const dayStr = (d) => format(d, 'yyyy-MM-dd')

export function DatePicker({
  value,
  onChange,
  min,
  max,
  className = '',
  display = 'EEEE, d MMMM yyyy',
  align = 'left',
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(toDay(value)))
  const wrap = useRef(null)

  // Re-centre the grid on the selected month every time it opens, so reopening
  // after a jump doesn't strand you in whatever month you browsed to last.
  useEffect(() => { if (open) setMonth(startOfMonth(toDay(value))) }, [open, value])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [open])

  const selected = toDay(value)
  const selectedStr = dayStr(selected)
  const todayStr = dayStr(new Date())
  const gridStart = startOfWeek(startOfMonth(month), WEEK_STARTS)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const blocked = (ds) => (min && ds < min) || (max && ds > max)
  // A month is reachable only while it still holds a pickable day.
  const monthKey = (d) => format(d, 'yyyy-MM')
  const prevOK = !min || monthKey(addMonths(month, -1)) >= min.slice(0, 7)
  const nextOK = !max || monthKey(addMonths(month, 1)) <= max.slice(0, 7)

  const pick = (d) => { onChange(dayStr(d)); setOpen(false) }

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {format(selected, display)}
        <ChevronDown size={15} className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn(
          'absolute top-full z-30 mt-2 w-[17.5rem] rounded-md border border-border bg-card p-3 shadow-lg',
          align === 'right' ? 'right-0' : 'left-0',
        )}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" disabled={!prevOK} onClick={() => setMonth((m) => addMonths(m, -1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-foreground">{format(month, 'MMMM yyyy')}</span>
            <button type="button" disabled={!nextOK} onClick={() => setMonth((m) => addMonths(m, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {DAY_NAMES.map((d) => (
              <span key={d} className="pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{d}</span>
            ))}
            {cells.map((d) => {
              const ds = dayStr(d)
              const on = ds === selectedStr
              const off = !isSameMonth(d, month)
              const no = blocked(ds)
              return (
                <button
                  key={ds}
                  type="button"
                  disabled={no}
                  onClick={() => pick(d)}
                  className={cn(
                    'relative h-8 rounded-md text-sm tabular-nums transition-colors',
                    on ? 'bg-primary font-semibold text-primary-foreground'
                      : no ? 'text-muted-foreground/30'
                      : off ? 'text-muted-foreground/60 hover:bg-muted/60'
                      : 'text-foreground hover:bg-muted/60',
                  )}
                >
                  {format(d, 'd')}
                  {ds === todayStr && !on && (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button type="button" disabled={blocked(todayStr)} onClick={() => pick(new Date())}
              className="text-xs font-medium text-foreground underline underline-offset-2 disabled:opacity-40 disabled:no-underline">
              Today
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
