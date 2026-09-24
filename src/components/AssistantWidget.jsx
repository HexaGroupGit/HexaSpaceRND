import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Sparkles, X, Minus, ListChecks, Circle } from 'lucide-react'
import { useAssistantChat } from '../lib/useAssistant.js'
import { sortTasks } from '../lib/tasks.js'
import AssistantChat from './AssistantChat.jsx'

// The assistant, reachable from every admin screen. Collapsed it's a bubble in
// the bottom-right corner; open it's a chat panel with the current to-do count.
// It shares one conversation with the /assistant board (see useAssistantChat),
// so a task raised here is already on the board when you get there.
//
// Hidden ON the board itself — the page has the same chat in its left pane, and
// two composers for one thread is just confusing.
export default function AssistantWidget({ store }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const chat = useAssistantChat(store)

  const tasks = store?.tasks ?? []
  const openTasks = sortTasks(tasks.filter((t) => t.status !== 'done'))

  // Esc closes, like every other dismissible surface in the portal.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (pathname === '/assistant') return null

  function goToBoard() {
    setOpen(false)
    navigate('/assistant')
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ops assistant"
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all grid place-items-center"
      >
        <Sparkles size={22} />
        {openTasks.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-red-500 text-white text-[11px] font-bold border-2 border-background">
            {openTasks.length}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-[25rem] h-[min(34rem,calc(100vh-6rem))] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
            <Sparkles size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-none truncate">Ops Assistant</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {openTasks.length > 0 ? `${openTasks.length} on your list` : 'Nothing on your list'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={goToBoard} title="Open the full board"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><ListChecks size={15} /></button>
          <button onClick={() => setOpen(false)} title="Minimise"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Minus size={15} /></button>
          <button onClick={() => setOpen(false)} title="Close"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>
      </div>

      {/* The next few things due — so the bubble answers "what's on?" without
          having to ask, and without leaving the page you're working on. */}
      {openTasks.length > 0 && chat.thread.length === 0 && (
        <div className="border-b border-border px-4 py-2.5 space-y-1.5 shrink-0 max-h-32 overflow-y-auto">
          {openTasks.slice(0, 3).map((t) => (
            <button key={t.id} onClick={goToBoard}
              className="w-full flex items-start gap-2 text-left group">
              <Circle size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
              <span className="text-xs text-foreground group-hover:underline line-clamp-1">{t.title}</span>
            </button>
          ))}
          {openTasks.length > 3 && (
            <button onClick={goToBoard} className="text-xs text-blue-600 hover:underline pl-5">
              +{openTasks.length - 3} more
            </button>
          )}
        </div>
      )}

      <AssistantChat chat={chat} compact onOpenBoard={goToBoard} />
    </div>
  )
}
