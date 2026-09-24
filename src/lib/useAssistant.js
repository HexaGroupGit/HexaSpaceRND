// The ops assistant conversation, shared by the full /assistant page and the
// floating widget in the corner of every admin screen.
//
// Both surfaces talk to ONE thread: open the bubble, raise a few tasks, then
// open the board and the same conversation is there. That only works because
// the thread lives here (and in localStorage) rather than in either component.
//
// The chat is a working surface, not the record — the board is. Tasks go to
// Supabase; the thread is per-admin, per-browser, and deliberately not synced.

import { useState, useRef, useEffect, useCallback } from 'react'
import { authHeaders } from './apiFetch.js'
import { melbourneToday } from './studio.js'
import { newTask, buildBriefing } from './tasks.js'

const THREAD_CAP = 40
const threadKey = (email) => `hexa.assistant.thread.${String(email || 'admin').toLowerCase()}`

// Both surfaces can be mounted at once (the widget lives in the layout, the page
// renders inside it), so a send on one has to show up on the other. Module-level
// subscribers keep the two copies of the hook in step within the tab.
const listeners = new Set()
function broadcast(thread, from) {
  listeners.forEach((fn) => { if (fn !== from) fn(thread) })
}

function loadThread(email) {
  try {
    const raw = localStorage.getItem(threadKey(email))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(-THREAD_CAP) : []
  } catch { return [] }
}

function saveThread(email, thread) {
  try { localStorage.setItem(threadKey(email), JSON.stringify(thread.slice(-THREAD_CAP))) } catch { /* private mode */ }
}

export const QUICK_PROMPTS = [
  'What should I do today?',
  'Anything overdue I should chase?',
  'What contracts need attention this month?',
]

export function useAssistantChat(store) {
  const { tasks = [], addTasks, updateTask, currentUserEmail = '' } = store ?? {}

  const [thread, setThread] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // The signed-in email arrives a beat after mount, so the thread can only be
  // read once it's known — until then we hold an empty thread rather than show
  // someone else's. Anything typed in that gap is kept, not overwritten.
  const loadedFor = useRef(null)
  useEffect(() => {
    if (!currentUserEmail || loadedFor.current === currentUserEmail) return
    loadedFor.current = currentUserEmail
    const stored = loadThread(currentUserEmail)
    setThread((prev) => (prev.length ? prev : stored))
  }, [currentUserEmail])

  useEffect(() => {
    if (loadedFor.current) saveThread(loadedFor.current, thread)
  }, [thread, currentUserEmail])

  // Mirror sends made from the other surface.
  useEffect(() => {
    const onPeer = (next) => setThread(next)
    listeners.add(onPeer)
    return () => { listeners.delete(onPeer) }
  }, [])

  const push = useCallback((entry) => {
    setThread((prev) => {
      const next = [...prev, entry].slice(-THREAD_CAP)
      broadcast(next, null)
      return next
    })
  }, [])

  const send = useCallback(async (text) => {
    const content = String(text ?? '').trim()
    if (!content || sending) return
    setError('')
    setDraft('')

    // The history the server sees is what was on screen BEFORE this message —
    // the new turn is sent separately so it can't be double-counted.
    const history = thread.map(({ role, content: c }) => ({ role, content: c }))
    push({ role: 'user', content, at: new Date().toISOString() })
    setSending(true)

    try {
      const r = await fetch('/api/assistant-chat', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ message: content, messages: history, briefing: buildBriefing(store, melbourneToday()) }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'The assistant could not answer.')

      // Drafts become real tasks here — newTask() is what clamps the priority,
      // category, due date and deep link before anything is written.
      const fresh = (d.created ?? [])
        .map((t) => newTask({ ...t, source: 'assistant' }, { createdBy: currentUserEmail }))
        .filter((t) => t.title)
      if (fresh.length) addTasks?.(fresh)

      const ticked = (d.completedIds ?? []).filter((id) => tasks.some((t) => t.id === id && t.status !== 'done'))
      ticked.forEach((id) => updateTask?.(id, {
        status: 'done', completedAt: new Date().toISOString(), completedBy: currentUserEmail,
      }))

      push({
        role: 'assistant',
        content: d.reply ?? '',
        at: new Date().toISOString(),
        added: fresh.length,
        ticked: ticked.length,
        taskIds: fresh.map((t) => t.id),
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }, [thread, sending, store, tasks, addTasks, updateTask, currentUserEmail, push])

  const clearThread = useCallback(() => {
    setThread([])
    broadcast([], null)
  }, [])

  return { thread, draft, setDraft, send, sending, error, clearThread }
}
