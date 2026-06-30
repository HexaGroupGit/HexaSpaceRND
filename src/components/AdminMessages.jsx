import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase.js'
import { useOutletContext } from 'react-router-dom'
import { Send, MessageSquare } from 'lucide-react'

function fmtTime(ts) {
  try { return format(parseISO(ts), 'dd/MM h:mm a') } catch { return '' }
}

export default function AdminMessages() {
  const { tenants } = useOutletContext()
  const [allMessages, setAllMessages] = useState([])
  const [selectedTenantId, setSelectedTenantId] = useState(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    load()
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (!selectedTenantId) return
    // Mark tenant messages as read when viewing
    allMessages
      .filter(m => m.tenantId === selectedTenantId && m.sender === 'tenant' && !m.readByAdmin)
      .forEach(m => {
        supabase.from('portal_messages').upsert({ id: m.id, data: { ...m, readByAdmin: true } })
      })
  }, [selectedTenantId, allMessages])

  async function load() {
    const { data } = await supabase.from('portal_messages').select('data')
    const msgs = (data ?? []).map(r => r.data)
    msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    setAllMessages(msgs)
  }

  const tenantThreads = tenants
    .map(t => {
      const msgs = allMessages.filter(m => m.tenantId === t.id)
      if (msgs.length === 0) return null
      const unread = msgs.filter(m => m.sender === 'tenant' && !m.readByAdmin).length
      const last = msgs[msgs.length - 1]
      return { tenant: t, msgs, unread, lastTs: last?.timestamp }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.lastTs) - new Date(a.lastTs))

  const selectedThread = tenantThreads.find(t => t.tenant.id === selectedTenantId)
  const totalUnread = tenantThreads.reduce((s, t) => s + t.unread, 0)

  async function sendReply(e) {
    e.preventDefault()
    if (!reply.trim() || !selectedTenantId) return
    const content = reply.trim()
    setReply('')
    setSending(true)

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId: selectedTenantId,
      sender: 'admin',
      content,
      timestamp: new Date().toISOString(),
      readByAdmin: true,
      readByTenant: false,
    }

    // Optimistic update
    setAllMessages(prev => [...prev, msg])

    await supabase.from('portal_messages').insert({ id: msg.id, data: msg })

    // Notify tenant by email (fire-and-forget)
    fetch('/api/portal/notify-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantEmail: selectedThread.tenant.email,
        tenantName: selectedThread.tenant.businessName,
        message: content,
      }),
    }).catch(() => {})

    setSending(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Thread list */}
      <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-900">Portal Messages</h1>
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Messages from members</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {tenantThreads.length === 0 ? (
            <div className="px-5 py-8 text-sm text-gray-400 text-center">No messages yet.</div>
          ) : (
            tenantThreads.map(({ tenant, msgs, unread, lastTs }) => {
              const last = msgs[msgs.length - 1]
              return (
                <button
                  key={tenant.id}
                  onClick={() => setSelectedTenantId(tenant.id)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                    selectedTenantId === tenant.id ? 'bg-gray-50 border-l-2 border-black' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm truncate ${unread > 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {tenant.businessName}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {unread > 0 && (
                        <span className="bg-black text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 truncate flex-1">{last?.content}</p>
                    <span className="text-xs text-gray-300 ml-2 shrink-0">{fmtTime(lastTs)}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Thread view */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedThread ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            <div className="text-center">
              <MessageSquare size={32} className="mx-auto mb-3 text-gray-300" />
              Select a conversation
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
              <div className="font-semibold text-gray-900">{selectedThread.tenant.businessName}</div>
              <div className="text-xs text-gray-400">{selectedThread.tenant.email}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {selectedThread.msgs.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-sm px-4 py-2.5 rounded-xl text-sm ${
                    msg.sender === 'admin'
                      ? 'bg-black text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                  }`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs mt-1 opacity-50">
                      {msg.sender === 'admin' ? 'You' : selectedThread.tenant.businessName} · {fmtTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendReply} className="border-t border-gray-200 bg-white p-4 flex gap-3 shrink-0">
              <input
                ref={inputRef}
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder={`Reply to ${selectedThread.tenant.businessName}…`}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                disabled={sending}
                autoFocus
              />
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="bg-black text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-2 text-sm font-medium shrink-0"
              >
                <Send size={14} /> Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
