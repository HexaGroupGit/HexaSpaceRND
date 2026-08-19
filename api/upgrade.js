// Vercel serverless — /api/upgrade
// Public, token-gated UPGRADE OFFER for an existing member: the admin picks
// larger suites on the company profile and emails a link to /upgrade/<token>,
// which reads the offer with GET and declines it with POST. Accepting is a
// separate endpoint (upgrade-accept.js) because it raises a contract.
//
//   GET  ?token=…                 → the offer + what they hold today
//   POST { token, reason? }       → records a decline; nothing else changes
//
// The offer lives on the CONTRACT it would supersede (lease.upgradeOffer), not
// on the company — a tenant can hold several contracts and only one of them is
// being replaced.
import { createClient } from '@supabase/supabase-js'
import { selectAllRows } from './_db.js'
import { proposalExpired } from './_proposal.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const FLOOR_LABEL = { l2: 'Level 2', l4: 'Level 4', l5: 'Level 5' }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const todayISO = () => new Date().toISOString().split('T')[0]

// An offer is only actionable while the contract it replaces is still live and
// not already on its way out — a member who has given notice is leaving, not
// upgrading, and a superseded contract has had its successor raised already.
export function offerBlockedReason(lease) {
  if (!lease) return 'missing'
  if (lease.supersededByContractId) return 'accepted'
  if (!['active', 'pending'].includes(String(lease.status))) return 'ended'
  if (lease.noticeGiven || lease.renewalDeclined || lease.terminationScheduledFor) return 'leaving'
  return null
}

export function offerStatus(lease, now = new Date()) {
  const o = lease?.upgradeOffer
  if (!o) return 'missing'
  if (['accepted', 'declined'].includes(o.status)) return o.status
  const blocked = offerBlockedReason(lease)
  if (blocked) return blocked
  return proposalExpired(o, now) ? 'expired' : (o.status || 'sent')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.method === 'GET' ? req.query?.token : req.body?.token
  if (!token) return res.status(400).json({ error: 'Missing token' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  try {
    const leaseRows = await selectAllRows(supabase, 'leases', 'id, data')
    const row = leaseRows.find((r) => r.data?.upgradeOffer?.token === token)
    if (!row) {
      // An old link from a re-sent offer answers "superseded", not 404.
      const superseded = leaseRows.some((r) => (r.data?.upgradeOffer?.previousTokens ?? []).includes(token))
      if (superseded) return res.status(200).json({ ok: true, status: 'superseded' })
      return res.status(404).json({ error: 'This upgrade offer is no longer available.' })
    }
    const lease = row.data
    const offer = lease.upgradeOffer
    const status = offerStatus(lease)

    if (req.method === 'POST') {
      if (status !== 'sent') return res.status(409).json({ error: 'This offer can no longer be declined.', status })
      const reason = String(req.body?.reason ?? '').slice(0, 500)
      lease.upgradeOffer = { ...offer, status: 'declined', declinedAt: new Date().toISOString(), declineReason: reason }
      const { error } = await supabase.from('leases').upsert({ id: row.id, data: lease, updated_at: new Date().toISOString() })
      if (error) return res.status(500).json({ error: 'Could not record that — please contact us.' })
      return res.status(200).json({ ok: true, status: 'declined' })
    }

    const [spaceRows, tenantRows, settRows] = await Promise.all([
      selectAllRows(supabase, 'spaces', 'id, data'),
      selectAllRows(supabase, 'tenants', 'id, data'),
      supabase.from('settings').select('data').eq('id', 'global').then((r) => r.data ?? []),
    ])
    const spaces = Object.fromEntries(spaceRows.map((r) => [r.id, r.data]))
    const tenant = tenantRows.map((r) => r.data).find((t) => t.id === lease.tenantId) ?? {}
    const settings = settRows?.[0]?.data ?? {}

    const decorate = (o) => {
      const s = spaces[o.spaceId] || {}
      return {
        spaceId: o.spaceId,
        unit: o.unit || s.unitNumber,
        price: Number(o.price || 0),
        note: o.note || '',
        level: FLOOR_LABEL[s.floor] || '',
        pax: o.pax ?? s.pax ?? null,
        size: o.size ?? s.size ?? '',
      }
    }

    return res.status(200).json({
      ok: true,
      status,
      company: settings?.company?.name || 'Hexa Space',
      businessName: tenant.businessName || lease.companyName || '',
      contactName: lease.memberName || tenant.contactName || '',
      // What they hold today — the contract this offer would replace.
      current: {
        contract: lease.contractNumber || lease.id,
        unit: lease.resource || spaces[lease.spaceId]?.unitNumber || '',
        rent: Number(lease.monthlyRent || 0),
        pax: spaces[lease.spaceId]?.pax ?? null,
        endDate: lease.endDate || '',
      },
      offices: (offer.offices || []).map(decorate),
      parking: (offer.parking || []).map(decorate),
      term: offer.term || '12mo',
      freeMonths: Number(offer.freeMonths || 0),
      validityDays: offer.validityDays ?? 14,
      message: offer.message || '',
      changeoverDate: offer.changeoverDate || '',
      today: todayISO(),
    })
  } catch (err) {
    console.error('upgrade GET/POST error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
