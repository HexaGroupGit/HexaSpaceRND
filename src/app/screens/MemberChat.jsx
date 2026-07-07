import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Send } from 'lucide-react'
import { useApp } from '../context.js'
import { BackHeader } from '../ui.jsx'
import { loadThread, sendMemberMessage, markThreadRead } from '../lib/memberMessages.js'

function fmtTs(ts) {
  try { return format(parseISO(ts), 'dd MMM · h:mm a') } catch { return '' }
}

// 1:1 direct message thread with another member. Same chat layout as the
// concierge Messages screen; polls every 4s.
export default function MemberChat() {
  const { otherId } = useParams()
  const { data } = useApp()
  const nav = useNavigate()
  const me = data.member
  const other = (data.members ?? []).find((m) => m.id === otherId)

  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const myEmail = me?.email
  const otherEmail = other?.email

  useEffect(() => {
    if (!myEmail || !otherEmail) return
    let alive = true
    async function refresh() {
      try {
        const thread = await loadThread(myEmail, otherEmail)
        if (alive) setMessages(thread)
        markThreadRead(myEmail, otherEmail).catch(() => {})
      } catch { /* table may not exist yet */ }
    }
    refresh()
    const timer = setInterval(refresh, 4000)
    return () => { alive = false; clearInterval(timer) }
  }, [myEmail, otherEmail])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content || !other) return
    setText(''); setSending(true)
    const optimistic = {
      id: `tmp_${Date.now()}`, convoId: '', fromEmail: myEmail, toEmail: otherEmail,
      content, timestamp: new Date().toISOString(), read: false, _mine: true,
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      await sendMemberMessage({
        from: { email: myEmail, id: me.id, name: me.name },
        to: { email: otherEmail, id: other.id, name: other.name },
        content,
      })
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      alert(err.message || 'Message could not be sent.')
    } finally { setSending(false) }
  }

  if (!other) {
    return (
      <div className="app-safe-top px-5">
        <BackHeader title="Message" fallback="/more/members" />
        <p className="hx-prose text-center pt-16">This member is no longer available.</p>
      </div>
    )
  }

  return (
    <div className="app-safe-top px-5 flex flex-col" style={{ height: '100dvh', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      <BackHeader title={other.name || 'Member'} fallback="/more/members" />
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-4">
        {messages.length === 0 && (
          <p className="hx-prose text-center pt-16">
            Say hello to {(other.name || 'this member').split(' ')[0]} — your messages are private between the two of you.
          </p>
        )}
        {messages.map((msg) => {
          const mine = msg._mine || (msg.fromEmail || '').toLowerCase() === (myEmail || '').toLowerCase()
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 text-sm ${mine ? 'bg-charcoal text-paper' : 'bg-paper text-ink border border-ink/10'}`}>
                <p className="leading-relaxed whitespace-pre-wrap font-body">{msg.content}</p>
                <p className="text-[9px] mt-1.5 opacity-50 font-heading uppercase tracking-nav">{fmtTs(msg.timestamp)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="app-cartbar flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${(other.name || 'member').split(' ')[0]}…`}
          className="hx-input flex-1 min-h-[50px] shadow-[0_6px_24px_rgba(0,0,0,0.08)]" disabled={sending} />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send"
          className="h-[50px] w-[50px] shrink-0 bg-ink text-paper flex items-center justify-center disabled:opacity-40 active:bg-charcoal">
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
