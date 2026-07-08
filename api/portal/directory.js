// GET /api/portal/directory — the community directory for the member portal.
//
// Post-RLS, members' direct table reads are scoped to their own company, which
// (correctly) blinded the Members/Companies community page. This endpoint
// restores the directory ON PURPOSE with a sanitized subset: every ACTIVE
// company and its members, name + contact only — no billing, credits, notes,
// Stripe or portal-status fields.
//
// "Active" = the company holds at least one active lease/membership and isn't
// a neutralized duplicate. Members must be Active-ish (not Former/archived).
import { requireMember } from '../_auth.js'
import { applyCors } from '../_cors.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireMember(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const sb = auth.sb

  try {
    const [{ data: tRows }, { data: mRows }, { data: lRows }] = await Promise.all([
      sb.from('tenants').select('data'),
      sb.from('members').select('data'),
      sb.from('leases').select('data'),
    ])
    const tenants = (tRows ?? []).map((r) => r.data)
    const members = (mRows ?? []).map((r) => r.data)
    const leases = (lRows ?? []).map((r) => r.data)

    const activeIds = new Set(leases.filter((l) => l.status === 'active').map((l) => l.tenantId))

    const companies = tenants
      .filter((t) => activeIds.has(t.id))
      .filter((t) => !/^zzz/i.test(t.businessName || ''))
      .map((t) => ({
        id: t.id,
        businessName: t.businessName ?? '',
        industry: t.industry ?? null,
        email: t.email ?? null,
        website: t.website ?? null,
      }))
      .sort((a, b) => a.businessName.localeCompare(b.businessName))

    const companyName = new Map(companies.map((c) => [c.id, c.businessName]))
    const people = members
      .filter((m) => companyName.has(m.companyId))
      .filter((m) => m.name && !['Former', 'archived'].includes(m.status))
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email ?? null,
        bio: m.bio ?? null,
        companyId: m.companyId,
        companyName: companyName.get(m.companyId),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return res.status(200).json({ companies, members: people })
  } catch (err) {
    console.error('portal directory error:', err)
    return res.status(500).json({ error: 'Could not load the directory.' })
  }
}
