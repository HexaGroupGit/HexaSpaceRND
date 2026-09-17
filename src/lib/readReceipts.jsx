import { format, parseISO } from 'date-fns'
import { Check, CheckCheck } from 'lucide-react'
import { supabase } from './supabase.js'

// Read receipts for the concierge thread (portal_messages). A member's message is
// read once an admin opens that thread (Messages page or tenant profile); an admin
// reply is read once the member opens Messages in the portal or app. The reader
// stamps readByAdminAt / readByTenantAt next to the flag — messages flagged before
// that field existed show "Seen" with no time.

const FLAG = { admin: 'readByAdmin', tenant: 'readByTenant' }

// Ids already flagged this session: a poll can return rows from before our write
// landed, and re-flagging would push the read time later.
const flagged = new Set()

// Flag as read by `reader` ('admin' | 'tenant') every message the other side sent.
// Postgrest builders only fire when awaited — an unawaited update never runs.
export async function markThreadRead(messages, reader) {
  const flag = FLAG[reader]
  const sender = reader === 'admin' ? 'tenant' : 'admin'
  const at = new Date().toISOString()
  const unread = messages.filter((m) => m.sender === sender && !m[flag] && !flagged.has(m.id))
  await Promise.all(unread.map(async (m) => {
    flagged.add(m.id)
    const { error } = await supabase.from('portal_messages')
      .update({ data: { ...m, [flag]: true, [`${flag}At`]: at } }).eq('id', m.id)
    if (error) flagged.delete(m.id)
  }))
}

function fmtRead(ts) {
  try { return format(parseISO(ts), 'dd/MM/yyyy h:mm a') } catch { return '' }
}

// "Sent" / "Seen" tag for the sender's own bubble; inherits the line's colour and
// size. `compact` renders the tick alone (thread-list previews).
export function ReadReceipt({ msg, compact = false }) {
  const byAdmin = msg.sender === 'tenant'
  const flag = byAdmin ? FLAG.admin : FLAG.tenant
  const seen = !!msg[flag]
  const at = msg[`${flag}At`]
  const title = seen
    ? `Seen${at ? ` ${fmtRead(at)}` : ''}`
    : byAdmin ? 'Not opened by the Hexa Space team yet' : 'Not opened in the member portal or app yet'
  const Icon = seen ? CheckCheck : Check
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" title={title}>
      <Icon size="1.25em" aria-hidden="true" />
      <span className={compact ? 'sr-only' : undefined}>{seen ? 'Seen' : 'Sent'}</span>
    </span>
  )
}
