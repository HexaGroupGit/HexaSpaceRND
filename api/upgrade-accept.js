// Vercel serverless — POST /api/upgrade-accept
// Public: an existing member accepts an upgrade offer on one of their contracts.
// We raise a NEW licence agreement for the chosen suite(s), schedule the old
// contract to end the day before changeover, reserve the new suite(s), send the
// agreement for e-signature and notify admin.
//
// What this deliberately does NOT do:
//   • refund the bond — it carries forward (bondCarriedForward), and only the
//     difference is billed, by raiseSigningInvoices when the contract is signed.
//   • enrol them in the clause-13(b) exit Virtual Office — they aren't leaving,
//     so the old contract carries skipVirtualOfficeEnrol.
//   • charge an exit fee — an upgrade is not a departure.
import { createClient } from '@supabase/supabase-js'
import { selectAllRows } from './_db.js'
import { fillVars, findEmailTemplate, sendResend } from './_leads.js'
import { offerStatus } from './upgrade.js'

const SUPABASE_URL = process.env.SUPABASE_URL

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const rid = (p) => `${p}${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const todayISO = () => new Date().toISOString().split('T')[0]
const isISO = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ''))
const shiftDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}
const money = (n) => `$${Number(n || 0).toLocaleString('en-AU')}`

// Every space a contract holds — line items first, primary spaceId as fallback
// for older contracts that predate items[].
const leaseSpaceIds = (l) => {
  const ids = (l?.items ?? []).map((i) => i.spaceId).filter(Boolean)
  if (!ids.length && l?.spaceId) ids.push(l.spaceId)
  return ids
}
const holdsSpace = (l) => ['active', 'pending'].includes(String(l?.status)) && !l?.offboardedAt
const vacatesOn = (l) => l?.vacateDate || l?.terminationScheduledFor || l?.endDate || null

// A suite is takeable on `changeover` if nobody else holds it by then: free
// now, or its occupant vacates strictly before that date. This is wider than
// "vacant right now" on purpose — offices whose occupant is leaving within 90
// days are offered ahead of time, so the accept has to honour that.
export function blockerFor(space, spaceId, leases, changeover, ownTenantId, ownLeaseId) {
  if (!space) return 'not found'
  const holders = leases.filter((l) =>
    l.id !== ownLeaseId && holdsSpace(l) && leaseSpaceIds(l).includes(spaceId))
  for (const h of holders) {
    const out = vacatesOn(h)
    if (!out || out >= changeover) return 'still occupied'
  }
  // Reserved for someone else with no contract yet (a proposal mid-accept).
  if (!holders.length && space.occupantTenantId && space.occupantTenantId !== ownTenantId) return 'reserved'
  if (!holders.length && space.status === 'reserved' && !space.occupantTenantId) return 'reserved'
  return null
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, officeIds, parkingIds, changeoverDate: reqChangeover } = req.body ?? {}
  if (!token) return res.status(400).json({ error: 'Missing token' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  try {
    const [leaseRows, tenantRows, memberRows, tmplRows, settRes] = await Promise.all([
      selectAllRows(supabase, 'leases', 'id, data'),
      selectAllRows(supabase, 'tenants', 'id, data'),
      selectAllRows(supabase, 'members', 'id, data'),
      selectAllRows(supabase, 'templates', 'data'),
      supabase.from('settings').select('data').eq('id', 'global'),
    ])
    const leases = leaseRows.map((r) => r.data)
    const oldRow = leaseRows.find((r) => r.data?.upgradeOffer?.token === token)
    if (!oldRow) {
      const superseded = leaseRows.some((r) => (r.data?.upgradeOffer?.previousTokens ?? []).includes(token))
      if (superseded) return res.status(410).json({ error: 'This offer has been updated — please use the link in our most recent email.', superseded: true })
      return res.status(404).json({ error: 'This upgrade offer is no longer available.' })
    }
    const oldLease = oldRow.data
    const offer = oldLease.upgradeOffer

    // Already done — hand back the signing link rather than raising a second
    // contract for a member who double-clicked or reopened the email.
    if (offer.status === 'accepted' || oldLease.supersededByContractId) {
      return res.status(200).json({ ok: true, alreadyAccepted: true, signLink: offer.signLink, contractNumber: offer.newContractNumber })
    }
    const status = offerStatus(oldLease)
    if (status === 'expired') return res.status(410).json({ error: 'This offer has expired — please contact us and we will refresh it.', expired: true })
    if (status === 'declined') return res.status(409).json({ error: 'This offer was declined. Please contact us if that was a mistake.' })
    if (status !== 'sent') return res.status(409).json({ error: 'This offer is no longer available — please contact us.' })

    const templates = tmplRows.map((r) => r.data)
    const settings = settRes?.data?.[0]?.data ?? {}
    const tenant = tenantRows.map((r) => r.data).find((t) => t.id === oldLease.tenantId)
    if (!tenant) return res.status(409).json({ error: 'We could not find your account — please contact us.' })

    // Chosen suites must be a subset of what was offered.
    const allOffices = offer.offices || []
    const allParking = offer.parking || []
    const offeredOfficeIds = allOffices.map((o) => o.spaceId)
    const offeredParkingIds = allParking.map((o) => o.spaceId)
    if (Array.isArray(officeIds) && officeIds.some((id) => !offeredOfficeIds.includes(id))) {
      return res.status(400).json({ error: 'One of the selected suites is not part of this offer.' })
    }
    if (Array.isArray(parkingIds) && parkingIds.some((id) => !offeredParkingIds.includes(id))) {
      return res.status(400).json({ error: 'One of the selected parking bays is not part of this offer.' })
    }
    const offices = (Array.isArray(officeIds) && officeIds.length) ? allOffices.filter((o) => officeIds.includes(o.spaceId)) : allOffices
    const parking = (Array.isArray(parkingIds) && parkingIds.length) ? allParking.filter((o) => parkingIds.includes(o.spaceId)) : []
    if (!offices.length) return res.status(400).json({ error: 'Please choose at least one suite.' })
    const items = [...offices, ...parking]

    // Changeover: the day the new suite starts and the old one ends.
    const today = todayISO()
    const changeover = isISO(reqChangeover) ? reqChangeover : (isISO(offer.changeoverDate) ? offer.changeoverDate : today)
    if (changeover < today) return res.status(400).json({ error: 'The changeover date cannot be in the past.' })

    // Re-check availability against the changeover date — the same suite is
    // often offered to a lead and a member at once; first accept wins.
    const spaceRows = await selectAllRows(supabase, 'spaces', 'id, data')
    const spacesById = Object.fromEntries(spaceRows.map((r) => [r.id, r.data]))
    const blocked = items
      .map((o) => ({ o, why: blockerFor(spacesById[o.spaceId], o.spaceId, leases, changeover, tenant.id, oldLease.id) }))
      .filter((x) => x.why)
    if (blocked.length) {
      const names = blocked.map(({ o }) => o.unit || spacesById[o.spaceId]?.unitNumber || o.spaceId).join(', ')
      return res.status(409).json({
        error: `${names} ${blocked.length > 1 ? 'are' : 'is'} no longer available on ${changeover}. Please contact us and we will arrange an alternative.`,
      })
    }

    const now = new Date()
    const term = offer.term || '12mo'
    const termMonths = term === '6mo' ? 6 : 12
    const rentFreeMonths = Number(offer.freeMonths || 0)
    const endD = new Date(`${changeover}T00:00:00Z`)
    endD.setUTCMonth(endD.getUTCMonth() + termMonths)
    endD.setUTCDate(endD.getUTCDate() - 1)
    const endDate = endD.toISOString().split('T')[0]

    // Contract number off a FRESH read — the snapshot above can be seconds old
    // under a concurrent accept or bill run.
    const freshRows = await selectAllRows(supabase, 'leases', 'data->>contractNumber')
    const numStrs = freshRows.map((r) => String(r.contractNumber ?? '').replace(/\D/g, '')).filter(Boolean)
    const nums = numStrs.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n) && n < 100000)
    const pad = Math.max(3, ...numStrs.filter((s) => parseInt(s, 10) < 100000).map((s) => s.length))
    const contractNumber = `CON-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(pad, '0')}`

    const monthlyRent = items.reduce((s, o) => s + Number(o.price || 0), 0)
    // One month's rent as security, less whatever is already held under the
    // contract being replaced. raiseSigningInvoices bills only the difference.
    const carriedBond = Number(oldLease.bondAmount ?? oldLease.items?.[0]?.deposit ?? 0)
    const deposit = monthlyRent

    const eToken = rid('sign')
    const portalBase = settings?.portalUrl || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || req.headers.host}`
    const signLink = `${portalBase}/sign/${eToken}`
    const leaseId = contractNumber
    const newLease = {
      id: leaseId, contractNumber,
      tenantId: tenant.id,
      memberId: oldLease.memberId, memberName: oldLease.memberName,
      companyName: tenant.businessName || oldLease.companyName,
      spaceId: items[0].spaceId,
      resource: items.map((o) => o.unit).filter(Boolean).join(', '),
      membershipType: 'Private Office',
      documentType: 'License Agreement',
      // 'Transfer' is what makes this an upgrade rather than a renewal further
      // down: raiseSigningInvoices bills the opening month but not a full bond,
      // and onboarding greets them as a move, not a welcome.
      contractType: 'Transfer',
      previousContractId: oldLease.id,
      upgradeFromContractId: oldLease.id,
      bondCarriedForward: carriedBond,
      bondCarriedFromContract: oldLease.contractNumber || oldLease.id,
      startDate: changeover, endDate,
      monthlyRent, bondAmount: deposit, discount: '',
      termMonths, rentFreeMonths,
      status: 'pending', signatureStatus: 'out_for_signature',
      items: items.map((o, i) => ({
        spaceId: o.spaceId,
        deposit: i === 0 ? deposit : 0,
        steps: [{ startDate: changeover, endDate, listPrice: Number(o.price || 0), qty: 1, discount: '' }],
      })),
      noticePeriodMonths: oldLease.noticePeriodMonths ?? 1,
      source: 'upgrade',
      eSignMemberLink: signLink, eSignAdminLink: `${signLink}?admin=1`, eSignSentAt: now.toISOString(),
      createdAt: today,
    }

    await supabase.from('leases').upsert({ id: leaseId, data: newLease, updated_at: now.toISOString() })
    await supabase.from('esign_requests').insert({ token: eToken, lease_id: leaseId, tenant_id: tenant.id, status: 'pending' })

    // The contract being replaced: a scheduled end the day before changeover,
    // using the same fields a manual termination sets so the Renewals board and
    // the reconcile cron treat it identically. skipVirtualOfficeEnrol because
    // they are moving, not leaving.
    const lastDay = shiftDays(changeover, -1)
    const updatedOld = {
      ...oldLease,
      noticeGiven: true,
      noticeDate: today,
      vacateDate: lastDay,
      terminationScheduledFor: lastDay,
      terminationReason: 'Upgrade / Downgrade',
      terminationComments: `Upgrading to ${newLease.resource} — superseded by ${contractNumber}.`,
      skipVirtualOfficeEnrol: true,
      autoRenew: false,
      supersededByContractId: leaseId,
      upgradeOffer: {
        ...offer,
        status: 'accepted',
        acceptedAt: now.toISOString(),
        acceptedOffices: offices.map((o) => o.spaceId),
        acceptedParking: parking.map((o) => o.spaceId),
        changeoverDate: changeover,
        newContractId: leaseId,
        newContractNumber: contractNumber,
        signLink,
      },
    }
    await supabase.from('leases').upsert({ id: oldRow.id, data: updatedOld, updated_at: now.toISOString() })

    // Hold the new suite(s). A failure here has to surface — an unreserved
    // space invites a double booking.
    const warnings = []
    await Promise.all(items.map(async (o) => {
      const s = spacesById[o.spaceId]
      if (!s) { warnings.push(`Space ${o.unit || o.spaceId} not found — reserve it manually.`); return }
      const { error } = await supabase.from('spaces').upsert({
        id: o.spaceId,
        data: { ...s, status: 'reserved', occupantTenantId: tenant.id },
        updated_at: now.toISOString(),
      })
      if (error) warnings.push(`Could not reserve ${o.unit || o.spaceId}: ${error.message}`)
    }))
    if (warnings.length) console.error('upgrade-accept reservation warnings:', warnings)

    // ── Emails ───────────────────────────────────────────────────────────────
    const team = memberRows.map((r) => r.data).filter((m) => m.companyId === tenant.id)
    const named = oldLease.memberName
      ? team.find((m) => (m.name || '').trim().toLowerCase() === String(oldLease.memberName).trim().toLowerCase())
      : null
    const contact = named ?? team.find((m) => m.billingPerson) ?? team.find((m) => m.contactPerson) ?? team[0] ?? null
    const to = contact?.email || tenant.email
    const contactName = contact?.name || tenant.contactName || 'there'

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && to) {
      const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
      const fromEmail = settings?.emails?.fromEmail || 'noreply@hexaspace.com.au'
      const replyTo = settings?.emails?.replyTo || settings?.emails?.notificationEmail
      const website = settings?.company?.website || 'hexaspace.com.au'
      const esignTpl = findEmailTemplate(templates, 'esign')
      const vars = {
        company: settings?.company?.name || 'Hexa Space', tenantName: contactName, contract: contractNumber,
        signLink, signerName: settings?.contracts?.eSignName || settings?.company?.name || 'Hexa Space', website,
      }
      const subject = fillVars(esignTpl?.subject || 'Please sign: {{contract}} — {{company}}', vars)
      const html = esignTpl?.content
        ? fillVars(esignTpl.content, vars)
        : `<div style="font-family:Arial,sans-serif;padding:32px;max-width:560px"><p>Hi ${contactName},</p><p>Great news — ${newLease.resource} is yours from ${changeover}. Please review and sign your licence agreement ${contractNumber}:</p><p><a href="${signLink}">Review &amp; sign document</a></p></div>`
      await sendResend(resendKey, { fromName, fromEmail, to, subject, html, replyTo })

      const adminTo = [...new Set(['eric@hexaspace.com.au', 'info@hexaspace.com.au', settings?.emails?.notificationEmail].filter(Boolean).map((e) => e.toLowerCase()))]
      const topUp = Math.max(0, deposit - carriedBond)
      const adminHtml = `<div style="font-family:Arial,sans-serif;padding:24px;max-width:600px">
        <h2 style="font-size:16px">Upgrade accepted 🎉</h2>
        <p><strong>${tenant.businessName || ''}</strong> (${contactName}${to ? `, ${to}` : ''}) accepted their upgrade offer.</p>
        <p>Moving from <strong>${oldLease.resource || ''}</strong> (${money(oldLease.monthlyRent)}/mo, ${oldLease.contractNumber || oldLease.id}) to <strong>${newLease.resource}</strong> (${money(monthlyRent)}/mo) on <strong>${changeover}</strong>.</p>
        <p>Contract <strong>${contractNumber}</strong> raised for a ${termMonths}-month term${rentFreeMonths ? `, ${rentFreeMonths} month${rentFreeMonths > 1 ? 's' : ''} rent-free` : ''} and sent for e-signature. The old contract ends ${lastDay} — no exit fee, no bond refund, no exit Virtual Office.</p>
        <p>Bond: ${money(carriedBond)} carries forward${topUp > 0 ? `; a ${money(topUp)} top-up is invoiced when they sign` : ' — no top-up needed'}. Countersign once they have signed.</p>
        ${warnings.length ? `<p style="color:#b45309"><strong>Warning:</strong> ${warnings.join(' ')}</p>` : ''}
      </div>`
      if (adminTo.length) {
        await sendResend(resendKey, { fromName, fromEmail, to: adminTo, subject: `Upgrade accepted — ${tenant.businessName || ''} (${contractNumber})`, html: adminHtml, replyTo })
      }
    }

    return res.status(200).json({
      ok: true, contractNumber, signLink, changeoverDate: changeover,
      monthlyRent, previousRent: Number(oldLease.monthlyRent || 0),
      depositTopUp: Math.max(0, deposit - carriedBond),
      ...(warnings.length ? { warnings } : {}),
    })
  } catch (err) {
    console.error('upgrade-accept error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
