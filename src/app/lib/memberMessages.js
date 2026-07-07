import { supabase } from '../../lib/supabase.js'

// Member-to-member direct messages. The member_messages table is participant-
// scoped by RLS (see member-messages-schema.sql), so a plain select only ever
// returns the signed-in member's own conversations — we can filter client-side
// without leaking anyone else's messages.

const lc = (s) => String(s || '').toLowerCase()

// Stable conversation id for a pair of members (order-independent).
export function convoId(emailA, emailB) {
  return [lc(emailA), lc(emailB)].sort().join('__')
}

// The "other participant" descriptor from a message row, given who I am.
function otherOf(m, myEmail) {
  return lc(m.fromEmail) === lc(myEmail)
    ? { email: m.toEmail, id: m.toId, name: m.toName }
    : { email: m.fromEmail, id: m.fromId, name: m.fromName }
}

async function myMessages() {
  const { data, error } = await supabase.from('member_messages').select('data')
  if (error) throw error
  return (data ?? []).map((r) => r.data).filter(Boolean)
}

// All my conversations, newest first: [{ convoId, other, last, unread }].
export async function loadMyConversations(myEmail) {
  const me = lc(myEmail)
  const msgs = await myMessages()
  const map = new Map()
  for (const m of msgs) {
    const cur = map.get(m.convoId) ?? { convoId: m.convoId, other: otherOf(m, me), last: null, unread: 0 }
    if (!cur.last || new Date(m.timestamp) > new Date(cur.last.timestamp)) cur.last = m
    if (lc(m.toEmail) === me && !m.read) cur.unread += 1
    map.set(m.convoId, cur)
  }
  return [...map.values()].sort((a, b) => new Date(b.last?.timestamp || 0) - new Date(a.last?.timestamp || 0))
}

// Count of unread messages addressed to me (for the bell / badges).
export async function unreadDmCount(myEmail) {
  const me = lc(myEmail)
  try {
    const msgs = await myMessages()
    return msgs.filter((m) => lc(m.toEmail) === me && !m.read).length
  } catch {
    return 0 // table not created yet, or offline — degrade quietly
  }
}

// Full thread between me and one other member, oldest first.
export async function loadThread(myEmail, otherEmail) {
  const cid = convoId(myEmail, otherEmail)
  const msgs = await myMessages()
  return msgs.filter((m) => m.convoId === cid)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

export async function sendMemberMessage({ from, to, content }) {
  const msg = {
    id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    convoId: convoId(from.email, to.email),
    fromEmail: lc(from.email), fromId: from.id, fromName: from.name || from.email,
    toEmail: lc(to.email), toId: to.id, toName: to.name || to.email,
    content: content.trim(),
    timestamp: new Date().toISOString(),
    read: false,
  }
  const { error } = await supabase.from('member_messages').insert({ id: msg.id, data: msg })
  if (error) throw new Error(error.message)
  return msg
}

// Mark every message the other person sent me in this thread as read.
export async function markThreadRead(myEmail, otherEmail) {
  const cid = convoId(myEmail, otherEmail)
  const me = lc(myEmail)
  const msgs = await myMessages()
  const unread = msgs.filter((m) => m.convoId === cid && lc(m.toEmail) === me && !m.read)
  await Promise.all(unread.map((m) =>
    supabase.from('member_messages').upsert({ id: m.id, data: { ...m, read: true } })))
}
