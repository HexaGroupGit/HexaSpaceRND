import { isLiveMember, pickMemberRecord } from '../src/lib/memberAccess.js'
import { isDropInCompany } from './_dropin.js'

// Check the company being billed, not whichever company happens to be the
// caller's first member row. The portal's company switcher uses the same member
// selection rules; permission at one company never grants access to another.
export async function canManageCompanyBilling(sb, email, companyId, { allowDropIn = false } = {}) {
  if (!email || !companyId) return false
  const address = email.trim().toLowerCase()
  const { data, error } = await sb.from('members').select('data')
    .eq('data->>companyId', companyId).ilike('data->>email', address)
  if (error) throw error
  // ilike treats underscores as wildcards, so verify exact email equality too.
  const rows = (data || []).map((row) => row.data).filter((member) => member?.email?.trim().toLowerCase() === address)
  if (rows.length) {
    const member = pickMemberRecord(rows)
    if (!isLiveMember(member)) return false
    if (member.billingPerson || member.contactPerson) return true
    return allowDropIn && await isDropInCompany(sb, companyId)
  }
  // A company-email login with no member row is the company owner.
  const { data: company, error: companyError } = await sb.from('tenants').select('data').eq('id', companyId).maybeSingle()
  if (companyError) throw companyError
  return !!company?.data?.email && company.data.email.trim().toLowerCase() === address
}
