// Shared drop-in helper: every drop-in needs a client record so a card has
// somewhere to live (cards are stored per-company). 13 of 116 drop-in members had
// no company at all, which is also why their bookings never raised a fee.
// Creating a lightweight client on first card setup mirrors what the public
// website booking flow already does for walk-ins.

/** Is this company a drop-in — i.e. holds no active membership/lease? */
export async function isDropInCompany(sb, companyId) {
  if (!companyId) return true
  const { data } = await sb.from('leases').select('data').eq('data->>tenantId', companyId)
  return !(data ?? []).some((r) => r.data?.status === 'active')
}

/**
 * The tenant id for this member, creating a minimal client record if they have
 * none. Returns { companyId, created }.
 */
export async function ensureClientForMember(sb, user, existingCompanyId) {
  if (existingCompanyId) return { companyId: existingCompanyId, created: false }

  const { data: mRows } = await sb.from('members').select('id, data').ilike('data->>email', user.email).limit(1)
  const member = mRows?.[0]
  const name = member?.data?.name || member?.data?.billBusinessName || user.email

  const id = `tc_drop_${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()
  const tenant = {
    id,
    businessName: name,
    contactName: member?.data?.name || '',
    email: user.email,
    phone: member?.data?.phone || '',
    status: 'Drop In',
    source: 'drop-in-booking',
    createdAt: now.split('T')[0],
    // No allowance — a drop-in pays per booking.
    monthlyAllowance: 0,
    creditsRemaining: 0,
  }
  const { error } = await sb.from('tenants').upsert({ id, data: tenant, updated_at: now })
  if (error) throw new Error(`Could not create a client record: ${error.message}`)

  // Point the member at it so the next booking finds the same client (and the
  // same saved card) rather than making another one.
  if (member?.id) {
    await sb.from('members').upsert({
      id: member.id,
      data: { ...member.data, companyId: id },
      updated_at: now,
    })
  }
  return { companyId: id, created: true }
}
