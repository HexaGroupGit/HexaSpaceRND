import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase.js'
import { Send } from 'lucide-react'

function fmt(ts) {
  try { return format(parseISO(ts), 'dd/MM/yyyy h:mm a') } catch { return '' }
}

export default function PortalMessages({ tenant }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    load()
    // Poll every 4 seconds for new messages
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [tenant.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function load() {
    const { data } = await supabase.from('portal_messages').select('data')
    const all = (data ?? []).map(r => r.data).filter(m => m.tenantId === tenant.id)
    all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    setMessages(all)

    // Mark admin messages as read
    for (const m of all.filter(m => m.sender === 'admin' && !m.readByTenant)) {
      supabase.from('portal_messages').upsert({ id: m.id, data: { ...m, readByTenant: true } })
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    setSending(true)

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId: tenant.id,
      sender: 'tenant',
      content,
      timestamp: new Date().toISOString(),
      readByAdmin: false,
      readByTenant: true,
    }

    // Optimistic update — show immediately
    setMessages(prev => [...prev, msg])

    await supabase.from('portal_messages').insert({ id: msg.id, data: msg })

    // Fire-and-forget email notification to admin
    fetch('/api/portal/notify-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantName: tenant.businessName,
        tenantEmail: tenant.email,
        message: content,
      }),
    }).catch(() => {})

    setSending(false)
    inputRef.current?.focus()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <h1 className="text-xl font-bold text-gray-900 mb-1 shrink-0">Messages</h1>
      <p className="text-sm text-gray-400 mb-5 shrink-0">
        Send a message to the HexaHub team. We'll reply as soon as possible.
      </p>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-lg p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            No messages yet. Start the conversation below.
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'tenant' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-xl text-sm ${
              msg.sender === 'tenant'
                ? 'bg-black text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            }`}>
              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs mt-1 opacity-50">{fmt(msg.timestamp)}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="mt-4 flex gap-3 shrink-0">
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type your message…"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          disabled={sending}
          autoFocus
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="bg-black text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-2 text-sm font-medium shrink-0"
        >
          <Send size={14} />
          Send
        </button>
      </form>
    </div>
  )
}
