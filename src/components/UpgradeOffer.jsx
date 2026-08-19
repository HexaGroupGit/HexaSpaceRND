import { useMemo, useState } from 'react'
import { format, parseISO, differenceInMonths } from 'date-fns'
import { Send, Loader2, FileDown, AlertTriangle } from 'lucide-react'
import { availableOffices, availableParking, isUpgradeFrom } from '../lib/officeAvailability.js'
import { resolvePrimaryContact } from '../lib/leaseContact.js'
import { buildProposalPdf } from '../lib/proposalPdf.js'
import { sendEmail, brandShell, bKicker, bH1, bP, bBtn, bSmall, BRAND, PORTAL_URL } from '../lib/sendEmail.js'
import { randomToken } from '../lib/token.js'
import { Modal, ic, Field, money } from './spaces/shared.jsx'

const FLOOR_LABEL = { l2: 'Level 2', l4: 'Level 4', l5: 'Level 5' }
const TERM_LABEL = { '6mo': '6-month term', '12mo': '12-month term' }

// jsPDF's datauristring is the one output format every build handles; strip the
// prefix Resend rejects.
function pdfToBase64(doc) {
  const u = doc.output('datauristring')
  return u && u.includes(',') ? u.slice(u.indexOf(',') + 1) : (u || '')
}

const addMonths = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setMonth(d.getMonth() + n)
  return d.toISOString().split('T')[0]
}
const firstOfNextMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0]
}
const fmtD = (s) => { try { return format(parseISO(s), 'd MMM yyyy') } catch { return s } }

// Offer an existing member a bigger suite. Same shape as the CRM lead proposal
// — pick suites, set the price and term, send a branded PDF with an accept link
// — but aimed at a contract we already hold, which the accept then supersedes.
export default function UpgradeOffer({ lease, tenant, spaces = [], leases = [], members = [], settings = {}, onClose, updateLease }) {
  const currentSpace = spaces.find((s) => s.id === lease.spaceId)
  const currentRent = Number(lease.monthlyRent || 0)
  const contact = resolvePrimaryContact(lease, tenant, members)

  // Never re-offer a suite the company already holds under any live contract.
  const ownSpaceIds = useMemo(() => {
    const ids = new Set()
    leases
      .filter((l) => l.tenantId === tenant?.id && ['active', 'pending'].includes(l.status))
      .forEach((l) => {
        ;(l.items ?? []).forEach((i) => i.spaceId && ids.add(i.spaceId))
        if (l.spaceId) ids.add(l.spaceId)
      })
    return [...ids]
  }, [leases, tenant?.id])

  const allOffices = useMemo(
    () => availableOffices({ spaces, leases, excludeSpaceIds: ownSpaceIds }),
    [spaces, leases, ownSpaceIds],
  )
  const parkingOptions = useMemo(
    () => availableParking({ spaces, leases, excludeSpaceIds: ownSpaceIds }),
    [spaces, leases, ownSpaceIds],
  )

  const [biggerOnly, setBiggerOnly] = useState(true)
  const officeOptions = biggerOnly
    ? allOffices.filter((o) => isUpgradeFrom(o.space, currentSpace))
    : allOffices

  const [picked, setPicked] = useState({}) // spaceId -> { on, price, note }
  const [term, setTerm] = useState('12mo')
  const [freeMonths, setFreeMonths] = useState(0)
  const [changeover, setChangeover] = useState(firstOfNextMonth())
  const [validityDays, setValidityDays] = useState(14)
  const [message, setMessage] = useState('')
  const [compressPdf, setCompressPdf] = useState(false)
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState('')

  const togglePick = (o) => setPicked((p) => ({
    ...p,
    [o.space.id]: p[o.space.id]?.on
      ? { ...p[o.space.id], on: false }
      : {
          on: true,
          price: p[o.space.id]?.price ?? (o.space.monthlyRate ?? o.space.rate ?? ''),
          note: p[o.space.id]?.note ?? (o.availableFrom ? `Available from ${fmtD(o.availableFrom)}` : ''),
        },
  }))
  const setPick = (id, k, v) => setPicked((p) => ({ ...p, [id]: { ...p[id], [k]: v } }))

  const selectedOffices = officeOptions.filter((o) => picked[o.space.id]?.on)
  const selectedParking = parkingOptions.filter((o) => picked[o.space.id]?.on)
  const selected = [...selectedOffices, ...selectedParking]
  const newTotal = selected.reduce((s, o) => s + Number(picked[o.space.id]?.price || 0), 0)
  const delta = newTotal - currentRent

  const termMonths = term === '6mo' ? 6 : 12
  // Upgrading resets the clock. If the new term is shorter than what they're
  // already committed to, the move quietly shortens their commitment — worth
  // seeing before it's emailed, not after.
  const remainingMonths = (() => {
    if (!lease.endDate) return 0
    try { return Math.max(0, differenceInMonths(parseISO(lease.endDate), parseISO(changeover))) } catch { return 0 }
  })()
  const shortensCommitment = remainingMonths > termMonths

  const toOffice = (o) => ({
    spaceId: o.space.id, unit: o.space.unitNumber, floor: o.space.floor, pax: o.space.pax,
    size: o.space.size, price: Number(picked[o.space.id]?.price || 0), note: picked[o.space.id]?.note || '',
  })

  const pdfArgs = () => ({
    offices: selectedOffices.map(toOffice),
    coverMsg: message.trim(),
    validityDays,
    lead: { name: contact.name, businessName: tenant?.businessName || lease.companyName || '' },
    settings,
    dateStr: format(new Date(), 'd MMMM yyyy'),
    compress: compressPdf,
    upgradeFrom: currentSpace || lease.resource
      ? { unit: lease.resource || currentSpace?.unitNumber, pax: currentSpace?.pax, rent: currentRent, contract: lease.contractNumber || lease.id }
      : null,
    changeoverDate: changeover,
  })

  const fileName = () => `Upgrade_${(tenant?.businessName || contact.name || 'member').replace(/\s+/g, '_')}.pdf`

  async function download() {
    if (!selectedOffices.length) { setResult('Tick at least one suite first.'); return }
    setDownloading(true); setResult('')
    try {
      const doc = await buildProposalPdf(pdfArgs())
      doc.save(fileName())
    } catch (e) { setResult(e.message) } finally { setDownloading(false) }
  }

  async function send() {
    if (!selectedOffices.length) { setResult('Tick at least one suite first.'); return }
    if (!contact.email) { setResult('No email address for this company — add one on the contact member first.'); return }
    if (selected.some((o) => !(Number(picked[o.space.id]?.price) > 0))) { setResult('Every ticked suite needs a monthly price.'); return }
    setSending(true); setResult('')
    try {
      const doc = await buildProposalPdf(pdfArgs())
      const pdfBase64 = pdfToBase64(doc)
      if (!pdfBase64) { setResult('Could not generate the PDF — try again.'); setSending(false); return }

      const token = randomToken()
      const link = `${PORTAL_URL}/upgrade/${token}`
      const offices = selectedOffices.map(toOffice)
      const parking = selectedParking.map((o) => ({ spaceId: o.space.id, unit: o.space.unitNumber, price: Number(picked[o.space.id]?.price || 0) }))
      const html = upgradeEmailHtml({
        contactName: contact.name, businessName: tenant?.businessName || '', settings, link, validityDays,
        currentUnit: lease.resource || currentSpace?.unitNumber || '', currentRent,
        offices, parking, term, freeMonths, changeover, message: message.trim(),
      })
      const subject = `${offices.length > 1 ? 'Some bigger suites' : `Suite ${offices[0].unit}`} for ${tenant?.businessName || 'you'} — ${settings?.company?.name || 'Hexa Space'}`

      await sendEmail({
        to: contact.email, subject, html, settings, tenantId: tenant?.id, emailType: 'proposal',
        attachments: [{ filename: fileName(), content: pdfBase64 }],
      })

      updateLease(lease.id, {
        upgradeOffer: {
          token,
          // Old emailed links then answer "superseded" instead of 404.
          previousTokens: [...(lease.upgradeOffer?.previousTokens ?? []), lease.upgradeOffer?.token].filter(Boolean).slice(-10),
          status: 'sent', sentAt: new Date().toISOString(),
          offices, parking, term, freeMonths: Number(freeMonths) || 0,
          changeoverDate: changeover, validityDays, message: message.trim(),
          currentUnit: lease.resource || currentSpace?.unitNumber || '', currentRent,
          sentTo: contact.email,
        },
      })
      setResult('Sent ✓')
      setTimeout(onClose, 900)
    } catch (e) { setResult(e.message) } finally { setSending(false) }
  }

  const prior = lease.upgradeOffer

  return (
    <Modal title={`Offer an upgrade — ${tenant?.businessName || lease.companyName || ''}`} onClose={onClose} maxW="max-w-3xl">
      <div className="space-y-5">
        {/* Anchor: what they hold today */}
        <div className="bg-muted/50 border border-border rounded-md px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Currently in</span>
            <span className="text-muted-foreground text-xs">{lease.contractNumber || lease.id}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-medium text-foreground">
              {lease.resource || currentSpace?.unitNumber || '—'}
              {currentSpace?.pax ? <span className="text-muted-foreground font-normal"> · {currentSpace.pax} pax</span> : null}
            </span>
            <span className="font-medium text-foreground">{money(currentRent)}<span className="text-muted-foreground">/mo</span></span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Term ends {lease.endDate ? fmtD(lease.endDate) : '—'} · offer goes to {contact.name || '—'} {contact.email ? `(${contact.email})` : '— no email on file'}
          </div>
        </div>

        {prior && (
          <div className="text-xs bg-muted/40 border border-border rounded-md px-3 py-2 text-muted-foreground">
            Last offer sent {prior.sentAt ? fmtD(prior.sentAt) : ''} — <span className="font-medium text-foreground capitalize">{prior.status}</span>
            {prior.declineReason ? ` · "${prior.declineReason}"` : ''}
            {prior.status === 'sent' && ' · sending again replaces it and invalidates the old link.'}
          </div>
        )}

        {/* Suites */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Suites to offer</span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={biggerOnly} onChange={(e) => setBiggerOnly(e.target.checked)} />
              Bigger than {lease.resource || 'their suite'} only
            </label>
          </div>
          {officeOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground border border-border rounded-md px-3 py-4 text-center">
              {biggerOnly ? 'No larger suites are free (or freeing up within 90 days). Untick the filter to see everything available.' : 'No suites are available to offer right now.'}
            </p>
          ) : (
            <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
              {officeOptions.map((o) => {
                const on = !!picked[o.space.id]?.on
                const step = Number(picked[o.space.id]?.price || o.space.monthlyRate || 0) - currentRent
                return (
                  <div key={o.space.id} className="px-3 py-2.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={on} onChange={() => togglePick(o)} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {o.space.unitNumber}
                          <span className="text-muted-foreground font-normal"> · {FLOOR_LABEL[o.space.floor] || ''}{o.space.pax ? ` · ${o.space.pax} pax` : ''}</span>
                        </span>
                        <span className="block text-xs">
                          {o.becoming
                            ? <span className="text-amber-600">Available from {fmtD(o.availableFrom)}</span>
                            : <span className="text-green-600">Available now</span>}
                          {step !== 0 && currentRent > 0 && <span className="text-muted-foreground"> · {step > 0 ? '+' : '−'}{money(Math.abs(step))} vs now</span>}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">{o.space.monthlyRate ? `list ${money(o.space.monthlyRate)}` : ''}</span>
                    </label>
                    {on && (
                      <div className="grid grid-cols-3 gap-2 mt-2 pl-7">
                        <Field label="Monthly price">
                          <input type="number" value={picked[o.space.id]?.price ?? ''} onChange={(e) => setPick(o.space.id, 'price', e.target.value)} className={ic} />
                        </Field>
                        <div className="col-span-2">
                          <Field label="Note on the offer (optional)">
                            <input value={picked[o.space.id]?.note ?? ''} onChange={(e) => setPick(o.space.id, 'note', e.target.value)} className={ic} />
                          </Field>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Parking add-on */}
        {parkingOptions.length > 0 && (
          <details className="border border-border rounded-md">
            <summary className="px-3 py-2 text-xs font-semibold text-foreground uppercase tracking-wide cursor-pointer">
              Add parking ({parkingOptions.length} free)
            </summary>
            <div className="divide-y divide-border border-t border-border max-h-40 overflow-y-auto">
              {parkingOptions.map((o) => (
                <div key={o.space.id} className="px-3 py-2 flex items-center gap-2.5">
                  <input type="checkbox" checked={!!picked[o.space.id]?.on} onChange={() => togglePick(o)} />
                  <span className="flex-1 text-sm text-foreground">Bay {o.space.unitNumber}</span>
                  {picked[o.space.id]?.on && (
                    <input type="number" value={picked[o.space.id]?.price ?? ''} onChange={(e) => setPick(o.space.id, 'price', e.target.value)} className={`${ic} w-28`} placeholder="$/mo" />
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Terms */}
        <div className="grid grid-cols-4 gap-3">
          <Field label="Term">
            <select value={term} onChange={(e) => setTerm(e.target.value)} className={ic}>
              <option value="12mo">12 months</option>
              <option value="6mo">6 months</option>
            </select>
          </Field>
          <Field label="Rent-free months">
            <input type="number" min="0" value={freeMonths} onChange={(e) => setFreeMonths(e.target.value)} className={ic} />
          </Field>
          <Field label="Changeover date">
            <input type="date" value={changeover} onChange={(e) => setChangeover(e.target.value)} className={ic} />
          </Field>
          <Field label="Valid for (days)">
            <input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value) || 14)} className={ic} />
          </Field>
        </div>

        {shortensCommitment && (
          <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              They have {remainingMonths} months left on {lease.contractNumber || 'their contract'} but this offers a {termMonths}-month term —
              accepting would shorten their commitment. Offer a {remainingMonths > 6 ? '12' : '6'}-month term, or push the changeover back, if that isn&apos;t intended.
            </span>
          </div>
        )}

        <Field label="Cover message (appears on the PDF and in the email)">
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={`${ic} resize-none`}
            placeholder={`Hi ${(contact.name || '').split(' ')[0] || 'there'} — you mentioned the team is growing, so here's what we have coming up.`} />
        </Field>

        {/* Summary */}
        {selected.length > 0 && (
          <div className="border border-border rounded-md px-4 py-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">New monthly total (ex GST)</span>
              <span className="font-semibold text-foreground">{money(newTotal)}</span>
            </div>
            <div className="flex items-baseline justify-between mt-1 text-xs text-muted-foreground">
              <span>{delta === 0 ? 'Same as today' : `${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}/mo vs today`}</span>
              <span>{TERM_LABEL[term]} from {fmtD(changeover)}{Number(freeMonths) > 0 ? ` · ${freeMonths} month${Number(freeMonths) > 1 ? 's' : ''} rent-free` : ''}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 border-t border-border pt-1.5">
              Bond of {money(lease.bondAmount ?? lease.items?.[0]?.deposit ?? 0)} carries over
              {newTotal > Number(lease.bondAmount ?? 0) ? ` — a ${money(newTotal - Number(lease.bondAmount ?? 0))} top-up is invoiced on signing.` : ' — no top-up needed.'}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1 border-t border-border">
          <button onClick={send} disabled={sending || !selectedOffices.length || !contact.email}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 mt-3">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send upgrade offer
          </button>
          <button onClick={download} disabled={downloading || !selectedOffices.length}
            className="flex items-center gap-2 border border-input px-3 py-2 rounded-md text-sm hover:bg-muted/50 disabled:opacity-40 mt-3">
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Preview PDF
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mt-3">
            <input type="checkbox" checked={compressPdf} onChange={(e) => setCompressPdf(e.target.checked)} /> Smaller file
          </label>
          {result && <span className={`text-xs mt-3 ${result.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>{result}</span>}
        </div>
      </div>
    </Modal>
  )
}

// Branded upgrade email — the suites, the price difference, and one button.
export function upgradeEmailHtml({ contactName, businessName, settings, link, validityDays, currentUnit, currentRent, offices, parking, term, freeMonths, changeover, message }) {
  const company = settings?.company?.name || 'Hexa Space'
  const website = settings?.company?.website || 'hexaspace.com.au'
  const first = String(contactName || '').trim().split(/\s+/)[0] || 'there'
  const { SANS, CAPS, OLIVE, INK, HAIR, MUTE } = BRAND
  const row = (label, sub, price) => `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid ${HAIR}">
        <div style="font-family:${CAPS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${INK}">${label}</div>
        ${sub ? `<div style="font-family:${SANS};font-size:12px;color:${MUTE};margin-top:3px">${sub}</div>` : ''}
      </td>
      <td style="padding:11px 0;border-bottom:1px solid ${HAIR};text-align:right;font-family:${SANS};font-size:14px;color:${INK};white-space:nowrap">$${Number(price || 0).toLocaleString('en-AU')}<span style="color:${MUTE}">/mo</span></td>
    </tr>`
  const total = [...offices, ...parking].reduce((s, o) => s + Number(o.price || 0), 0)
  const delta = total - Number(currentRent || 0)
  const termLabel = TERM_LABEL[term] || '12-month term'

  return brandShell(
    bKicker('Room To Grow') +
    bH1(offices.length > 1 ? 'A few options with more space' : 'A bigger suite, ready for you') +
    bP(`Hi ${first},`) +
    bP(message || `Thanks for being part of ${company}. ${currentUnit ? `You're in ${currentUnit} today` : 'You’re with us today'}, and ${offices.length > 1 ? 'these suites are' : 'this suite is'} available if ${businessName || 'the team'} is ready for more room.`) +
    `<table style="width:100%;border-collapse:collapse;margin:6px 0 18px">
      ${offices.map((o) => row(o.unit, [o.pax ? `${o.pax} pax` : '', o.note].filter(Boolean).join(' · '), o.price)).join('')}
      ${parking.map((o) => row(`Car parking ${o.unit}`, '', o.price)).join('')}
      <tr>
        <td style="padding:12px 0;font-family:${CAPS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${INK}">New total / month</td>
        <td style="padding:12px 0;text-align:right;font-family:${SANS};font-size:17px;color:${OLIVE};white-space:nowrap">$${total.toLocaleString('en-AU')}</td>
      </tr>
      ${currentRent > 0 ? `<tr><td colspan="2" style="text-align:right;font-family:${SANS};font-size:12px;color:${MUTE};padding-bottom:6px">${delta === 0 ? 'Same as your current rent' : `${delta > 0 ? '+' : '−'}$${Math.abs(delta).toLocaleString('en-AU')} a month compared with today`}</td></tr>` : ''}
    </table>` +
    bSmall(`${termLabel} from ${fmtD(changeover)}${Number(freeMonths) > 0 ? ` · final ${freeMonths} month${Number(freeMonths) > 1 ? 's' : ''} rent-free` : ''} · prices exclude GST. Your security deposit carries straight across — if the new suite calls for a larger one, we’ll invoice only the difference.`) +
    bBtn('Review & accept', link) +
    bP(`There's nothing to cancel: accept and we'll raise your new agreement, and ${currentUnit || 'your current suite'} closes off by itself the day before you move.`) +
    bSmall(`This offer is open for ${validityDays} days. Any questions at all, just reply to this email.`),
    { company, website },
  )
}
