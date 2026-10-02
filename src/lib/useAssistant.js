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

// Images ride on the next message only. Every one is redrawn in the browser —
// long edge capped at 1568px (the most the model uses anyway) and re-encoded as
// JPEG — so a 12 MB phone photo goes up as a few hundred KB and four of them
// stay well under Vercel's ~4.5 MB request limit. The thread keeps a small
// thumbnail, never the full image: localStorage holds ~5 MB for everything.
export const MAX_IMAGES = 4
const MAX_EDGE = 1568
const THUMB_EDGE = 240

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Couldn't read ${file.name || 'that image'}.`)) }
    img.src = url
  })
}

function drawJpeg(img, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // a transparent PNG would otherwise go black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

async function prepareImage(file) {
  if (!/^image\//.test(file?.type ?? '')) throw new Error(`${file?.name || 'That file'} isn't an image.`)
  const img = await loadImage(file)
  const dataUrl = drawJpeg(img, MAX_EDGE, 0.85)
  return {
    name: file.name || 'image',
    mediaType: 'image/jpeg',
    data: dataUrl.slice(dataUrl.indexOf(',') + 1),
    thumb: drawJpeg(img, THUMB_EDGE, 0.7),
  }
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
  const [images, setImages] = useState([])

  // Accepts a FileList / File[] from the picker, a drop or a paste.
  const addImages = useCallback(async (files) => {
    const list = [...(files ?? [])].filter((f) => /^image\//.test(f?.type ?? ''))
    if (!list.length) return
    setError('')
    const room = MAX_IMAGES - images.length
    if (room <= 0) { setError(`Up to ${MAX_IMAGES} images per message.`); return }
    try {
      const ready = await Promise.all(list.slice(0, room).map(prepareImage))
      setImages((prev) => [...prev, ...ready].slice(0, MAX_IMAGES))
      if (list.length > room) setError(`Only the first ${MAX_IMAGES} images were added.`)
    } catch (e) {
      setError(e.message)
    }
  }, [images.length])

  const removeImage = useCallback((i) => setImages((prev) => prev.filter((_, j) => j !== i)), [])

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
    const attached = images
    if ((!content && !attached.length) || sending) return
    setError('')
    setDraft('')
    setImages([])

    // The history the server sees is what was on screen BEFORE this message —
    // the new turn is sent separately so it can't be double-counted. Earlier
    // images are not re-sent; the turn just notes that they were there.
    const history = thread.map(({ role, content: c, imageCount }) => ({
      role,
      content: [c, imageCount && `[${imageCount} image${imageCount === 1 ? '' : 's'} attached]`].filter(Boolean).join('\n'),
    }))
    push({
      role: 'user', content, at: new Date().toISOString(),
      ...(attached.length ? { imageCount: attached.length, thumbs: attached.map((im) => im.thumb) } : {}),
    })
    setSending(true)

    try {
      const r = await fetch('/api/assistant-chat', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          message: content,
          images: attached.map(({ mediaType, data }) => ({ mediaType, data })),
          messages: history,
          briefing: buildBriefing(store, melbourneToday()),
        }),
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
  }, [thread, images, sending, store, tasks, addTasks, updateTask, currentUserEmail, push])

  const clearThread = useCallback(() => {
    setThread([])
    broadcast([], null)
  }, [])

  return { thread, draft, setDraft, send, sending, error, clearThread, images, addImages, removeImage }
}
