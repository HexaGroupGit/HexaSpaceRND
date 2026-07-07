import { useState, useEffect, useRef } from 'react'
import { authHeaders } from '../../lib/apiFetch.js'
import { format, parseISO } from 'date-fns'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useApp } from '../context.js'
import { BackHeader } from '../ui.jsx'
import { apiUrl } from '../lib/native.js'

// Concierge thread — same portal_messages table + admin notification hook as
// the portal, in a phone chat layout (composer pinned above the tab bar).
function fmtTs(ts) {
  try { return format(parseISO(ts), 'dd MMM · h:mm a') } catch { return '' }
}

export default function Messages() {
  const { data } = useApp()
  const tenant = data.company
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    load()
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [tenant.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function load() {
    const { data: rows } = await supabase.from('portal_messages').select('data')
    const all = (rows ?? []).map((r) => r.data).filter((m) => m.tenantId === tenant.id)
    all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    setMessages(all)
    for (const m of all.filter((m) => m.sender === 'admin' && !m.readByTenant)) {
      supabase.from('portal_messages').upsert({ id: m.id, data: { ...m, readByTenant: true } })
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText(''); setSending(true)
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId: tenant.id, sender: 'tenant', content,
      timestamp: new Date().toISOString(), readByAdmin: false, readByTenant: true,
    }
    setMessages((prev) => [...prev, msg])
    await supabase.from('portal_messages').insert({ id: msg.id, data: msg })
    fetch(apiUrl('/api/portal/notify-message'), {
      method: 'POST', headers: await authHeaders(),
      body: JSON.stringify({ tenantName: tenant.businessName, tenantEmail: tenant.email, message: content }),
    }).catch(() => {})
    setSending(false)
  }

  return (
    <div className="app-safe-top px-5 flex flex-col" style={{ height: '100dvh', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      <BackHeader title="Messages" fallback="/more" />
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-4">
        {messages.length === 0 && (
          <p className="hx-prose text-center pt-16">
            Message the Hexa team — we'll reply as soon as we can.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'tenant' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-3 text-sm ${
              msg.sender === 'tenant' ? 'bg-charcoal text-paper' : 'bg-paper text-ink border border-ink/10'
            }`}>
              <p className="leading-relaxed whitespace-pre-wrap font-body">{msg.content}</p>
              <p className="text-[9px] mt-1.5 opacity-50 font-heading uppercase tracking-nav">{fmtTs(msg.timestamp)}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="app-cartbar flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message…"
          className="hx-input flex-1 min-h-[50px] shadow-[0_6px_24px_rgba(0,0,0,0.08)]" disabled={sending} />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send"
          className="h-[50px] w-[50px] shrink-0 bg-ink text-paper flex items-center justify-center disabled:opacity-40 active:bg-charcoal">
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
