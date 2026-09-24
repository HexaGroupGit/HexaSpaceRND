import { useState, useEffect, useMemo } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  Sparkles, Plus, X, Trash2, Pencil, ArrowUpRight,
  CheckCircle2, Circle, ChevronDown, ChevronRight, RotateCcw, AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { melbourneToday } from '../lib/studio.js'
import {
  PRIORITIES, PRIORITY_STYLE, CATEGORIES, TASK_LINKS,
  newTask, sortTasks, sortDone, linkLabel,
} from '../lib/tasks.js'
import { useAssistantChat } from '../lib/useAssistant.js'
import AssistantChat from './AssistantChat.jsx'

const EMPTY_FORM = {
  title: '', detail: '', priority: 'normal', category: 'admin', dueDate: '', link: '',
}

const dmy = (iso) => { try { return format(parseISO(iso), 'dd/MM/yyyy') } catch { return iso } }

export default function Assistant() {
  const store = useOutletContext()
  const { tasks = [], addTasks, updateTask, deleteTask, currentUserEmail = '' } = store
  const navigate = useNavigate()
  const today = melbourneToday()

  const chat = useAssistantChat(store)

  const [setupErr, setSetupErr] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState('all')
  const [doneOpen, setDoneOpen] = useState(false)

  // The tasks table ships as its own migration (tasks-schema.sql). Without it
  // every write would fail silently in the console and tasks would vanish on
  // refresh — so probe once and say so plainly instead.
  useEffect(() => {
    let cancelled = false
    supabase.from('tasks').select('id').limit(1).then(({ error }) => {
      if (cancelled || !error) return
      setSetupErr(/does not exist|schema cache/i.test(error.message ?? '')
        ? 'The tasks table is missing — run tasks-schema.sql in the Supabase SQL editor. Until then nothing you add here will be saved.'
        : `Tasks could not be loaded: ${error.message}`)
    })
    return () => { cancelled = true }
  }, [])

  const open = useMemo(
    () => sortTasks(tasks.filter((t) => t.status !== 'done'), today),
    [tasks, today])
  const done = useMemo(() => sortDone(tasks.filter((t) => t.status === 'done')), [tasks])

  const visible = filter === 'all' ? open : open.filter((t) => t.category === filter)
  const overdueCount = open.filter((t) => t.dueDate && t.dueDate < today).length
  const usedCategories = [...new Set(open.map((t) => t.category))]

  function completeTask(task) {
    updateTask(task.id, {
      status: 'done',
      completedAt: new Date().toISOString(),
      completedBy: currentUserEmail,
    })
  }

  function reopenTask(task) {
    updateTask(task.id, { status: 'open', completedAt: '', completedBy: '' })
  }

  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setShowForm(true) }
  function openEdit(task) {
    setEditId(task.id)
    setForm({
      title: task.title ?? '', detail: task.detail ?? '', priority: task.priority ?? 'normal',
      category: task.category ?? 'admin', dueDate: task.dueDate ?? '', link: task.link ?? '',
    })
    setShowForm(true)
  }

  function saveForm(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    if (editId) {
      const existing = tasks.find((t) => t.id === editId)
      updateTask(editId, newTask({ ...existing, ...form }, { createdBy: existing?.createdBy ?? currentUserEmail }))
    } else {
      addTasks([newTask({ ...form, source: 'manual' }, { createdBy: currentUserEmail })])
    }
    setShowForm(false)
  }

  function removeTask(task) {
    if (window.confirm(`Delete "${task.title}"?`)) deleteTask(task.id)
  }

  function clearThread() {
    if (!chat.thread.length || window.confirm('Clear this conversation? Your tasks stay on the board.')) chat.clearThread()
  }

  const input = 'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {open.length} to do{overdueCount > 0 && <span className="text-red-600 font-medium"> · {overdueCount} overdue</span>} · {done.length} completed
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 shrink-0">
          <Plus size={15} /> Add Task
        </button>
      </div>

      {setupErr && (
        <div className="flex items-start gap-2 mb-5 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> <span>{setupErr}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">

        {/* ── Chat ─────────────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-[32rem] lg:h-[calc(100vh-13rem)] lg:sticky lg:top-0">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-none">Ops Assistant</p>
                <p className="text-[11px] text-muted-foreground mt-1">Tell it what's on — it writes the tickets</p>
              </div>
            </div>
            {chat.thread.length > 0 && (
              <button onClick={clearThread} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
            )}
          </div>

          <AssistantChat chat={chat} />
        </div>

        {/* ── Board ────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {open.length > 0 && usedCategories.length > 1 && (
            <div className="flex flex-wrap gap-1 bg-muted rounded-md p-0.5 w-fit">
              {['all', ...CATEGORIES.filter((c) => usedCategories.includes(c))].map((c) => (
                <button key={c} onClick={() => setFilter(c)}
                  className={`px-3 py-1.5 text-sm font-medium rounded capitalize transition-colors ${
                    filter === c ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {c === 'all' ? `All (${open.length})` : `${c} (${open.filter((t) => t.category === c).length})`}
                </button>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="bg-card border border-border rounded-xl shadow-sm p-10 text-center">
              <CheckCircle2 size={22} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {open.length === 0
                  ? <>Nothing on the board. Ask the assistant what's outstanding, or <button onClick={openAdd} className="text-blue-600 hover:underline">add a task</button>.</>
                  : 'Nothing in this category.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((task) => {
                const pMeta = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.normal
                const isOverdue = task.dueDate && task.dueDate < today
                return (
                  <div key={task.id} className="bg-card border border-border rounded-xl shadow-sm p-4 flex items-start gap-3.5">
                    <button onClick={() => completeTask(task)} title="Mark as done"
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 transition-colors">
                      <Circle size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {task.link && (
                            <button onClick={() => navigate(task.link)} title={`Open ${linkLabel(task.link)}`}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                              <ArrowUpRight size={14} />
                            </button>
                          )}
                          <button onClick={() => openEdit(task)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                          <button onClick={() => removeTask(task)}
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 size={13} /></button>
                        </div>
                      </div>

                      {task.detail && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{task.detail}</p>}

                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${pMeta.cls}`}>{pMeta.label}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{task.category}</span>
                        {task.dueDate && (
                          <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            Due {dmy(task.dueDate)}{isOverdue ? ' · overdue' : ''}
                          </span>
                        )}
                        {task.link && (
                          <button onClick={() => navigate(task.link)} className="text-xs text-blue-600 hover:underline">
                            {linkLabel(task.link)}
                          </button>
                        )}
                        {task.source === 'assistant' && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Sparkles size={11} /> assistant
                          </span>
                        )}
                      </div>

                      {task.sourceNote && (
                        <p className="text-xs text-muted-foreground/80 italic mt-2 border-l-2 border-border pl-2">
                          “{task.sourceNote}”
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Completed ──────────────────────────────────────────────────── */}
          {done.length > 0 && (
            <div className="bg-card border border-border rounded-xl shadow-sm">
              <button onClick={() => setDoneOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 rounded-xl">
                {doneOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <CheckCircle2 size={15} className="text-green-600" />
                Completed
                <span className="text-muted-foreground font-normal">({done.length})</span>
              </button>
              {doneOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {done.map((task) => (
                    <div key={task.id} className="flex items-start gap-3.5 px-4 py-3">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground line-through">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.completedAt ? `Done ${dmy(String(task.completedAt).slice(0, 10))}` : 'Done'}
                          {task.completedBy ? ` · ${task.completedBy}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => reopenTask(task)} title="Move back to to-do"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><RotateCcw size={13} /></button>
                        <button onClick={() => removeTask(task)}
                          className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add / edit ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{editId ? 'Edit Task' : 'Add Task'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <form onSubmit={saveForm} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Task *</label>
                <input required autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chase Top 1 Care for INV-3576" className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Detail</label>
                <textarea rows={3} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })}
                  placeholder="Context, or what done looks like" className={`${input} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={input}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_STYLE[p].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${input} capitalize`}>
                    {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Due date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={input} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Opens</label>
                  <select value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className={input}>
                    <option value="">— No page —</option>
                    {TASK_LINKS.map((l) => <option key={l.to} value={l.to}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-foreground border border-input rounded-md hover:bg-muted/50">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium">
                  {editId ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
