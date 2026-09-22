import { useRef, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { availabilityEmailDraft, matchingAvailableOffices, officeSuiteLabel } from '../lib/waitingOffice.js'
import { messageEmailHtml, sendEmail } from '../lib/sendEmail.js'

export default function WaitingAvailabilityEmail({ entry, store, onClose }) {
  const offices = matchingAvailableOffices(entry, store)
  const [spaceId, setSpaceId] = useState(offices[0]?.id || '')
  const [draft, setDraft] = useState(() => offices[0] ? availabilityEmailDraft(entry, offices[0]) : { subject: '', body: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const sendLock = useRef(false)
  const office = offices.find((space) => space.id === spaceId)
  const previous = (entry.waitingListNotifications || []).filter((notice) => notice.spaceId === spaceId).at(-1)
  const html = messageEmailHtml({ body: draft.body, company: store.settings?.company?.name, website: store.settings?.company?.website })
  const input = 'w-full border border-input rounded-md px-3 py-2 text-sm'

  function selectOffice(id) {
    const next = offices.find((space) => space.id === id)
    if (!next) return
    setSpaceId(id)
    setDraft(availabilityEmailDraft(entry, next))
    setError('')
  }

  async function send(event) {
    event.preventDefault()
    if (sendLock.current || sent) return
    setError('')
    // Recheck the current inventory immediately before an admin sends.
    if (!office) { setError('This suite is no longer available. Choose another available office.'); return }
    if (!entry.email?.trim() || !draft.subject.trim() || !draft.body.trim()) { setError('A recipient email, subject and message are required.'); return }
    sendLock.current = true
    setSending(true)
    try {
      const result = await sendEmail({
        to: entry.email.trim(), subject: draft.subject.trim(), html, settings: store.settings,
        tenantId: entry.kind === 'member' ? store.members?.find((member) => member.id === entry.recordId)?.companyId : undefined,
        emailType: 'waiting-list-availability',
        logExtra: { waitingListRecordId: entry.recordId, waitingListKind: entry.kind, spaceId },
      })
      if (result?.suppressed) { setError('This recipient has unsubscribed. No availability email was sent.'); return }
      const notice = { sentAt: new Date().toISOString(), spaceId, to: entry.email.trim(), subject: draft.subject.trim(), body: draft.body, providerId: result?.id || null }
      const notifications = [...(entry.waitingListNotifications || []), notice]
      if (entry.kind === 'member') {
        const member = store.members.find((item) => item.id === entry.recordId)
        store.updateMember(member.id, { waitingListRequest: { ...member.waitingListRequest, waitingListNotifications: notifications } })
      } else {
        store.updateLead(entry.recordId, { waitingListNotifications: notifications })
      }
      setSent(true)
    } catch (err) {
      setError(err.message || 'Email could not be sent. Please try again.')
    } finally {
      sendLock.current = false
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="availability-email-title" className="bg-card rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="availability-email-title" className="font-semibold">Review availability email</h2>
          <button type="button" disabled={sending} onClick={onClose} aria-label="Close availability email" className="p-1 text-muted-foreground disabled:opacity-50"><X size={18} /></button>
        </div>
        {sent ? (
          <div className="p-6 space-y-4">
            <p role="status" className="text-sm text-green-700">Availability email sent to {entry.email}. This person remains on the waiting list until you remove them.</p>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-input rounded-md text-sm">Done</button>
          </div>
        ) : (
          <form onSubmit={send} className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Review and customise the message below. It will only be sent when you click Send availability email.</p>
            <p className="text-sm"><span className="font-medium">To:</span> {entry.name} &lt;{entry.email || 'No email recorded'}&gt;</p>
            {!entry.email && <p role="alert" className="text-sm text-amber-700">Add an email address to this contact’s record before sending.</p>}
            <fieldset disabled={sending} className="space-y-4">
              <label className="block text-sm">Available office suite
                <select required value={office ? spaceId : ''} onChange={(event) => selectOffice(event.target.value)} className={`${input} mt-1`}>
                  {!office && <option value="">Choose an available office suite</option>}
                  {offices.map((space) => <option key={space.id} value={space.id}>{officeSuiteLabel(space)}</option>)}
                </select>
              </label>
              {!office && <p role="alert" className="text-sm text-amber-700">No matching office is currently available for this selection.</p>}
              {previous && <p className="text-xs text-amber-700">An availability email for this suite was already sent on {new Date(previous.sentAt).toLocaleDateString('en-AU')}. Sending again will send a new email.</p>}
              <label className="block text-sm">Subject<input required value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} className={`${input} mt-1`} /></label>
              <label className="block text-sm">Message<textarea required rows={13} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} className={`${input} mt-1`} /></label>
            </fieldset>
            <details><summary className="text-sm cursor-pointer">Preview branded email</summary><iframe title="Availability email preview" sandbox="" srcDoc={html} className="w-full h-96 border border-border rounded-md mt-2" /></details>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={sending} onClick={onClose} className="px-4 py-2 text-sm border border-input rounded-md disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={sending || !office || !entry.email?.trim()} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50">{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}{sending ? 'Sending…' : 'Send availability email'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
