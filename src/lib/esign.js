import { supabase } from './supabase.js'
import { sendEmail, eSignEmailHtml, renderEsignTemplate, PORTAL_URL } from './sendEmail.js'

// Create the e-sign request for a lease and email the client their signing
// link. Shared by ContractDetail's "Send for e-signature" action and the
// renewal flows (a renewal auto-sends so it can't sit unsigned by mistake).
// Returns the lease updates that were applied.
export async function sendLeaseForSigning({ lease, tenant, settings, templates, updateLease }) {
  const token = crypto.randomUUID()
  const memberLink = `${PORTAL_URL}/sign/${token}`
  const adminLink = `${window.location.origin}/sign/${token}?admin=1`

  const { error } = await supabase.from('esign_requests').insert({
    token,
    lease_id: lease.id,
    tenant_id: lease.tenantId,
    status: 'pending',
  })
  if (error) throw error

  const updates = {
    signatureStatus: 'out_for_signature',
    eSignAdminLink: adminLink,
    eSignMemberLink: memberLink,
    eSignSentAt: new Date().toISOString(),
  }
  updateLease?.(lease.id, updates)

  if (tenant?.email) {
    try {
      const mergedLease = { ...lease, ...updates }
      // Prefer the editable Templates → Emails → E-signature request template.
      const esignTpl = (templates ?? []).find((t) => t.category === 'email' && t.emailType === 'esign' && t.content)
      let subject, html
      if (esignTpl) {
        ({ subject, html } = renderEsignTemplate({ template: esignTpl, lease: mergedLease, tenant, settings, signLink: memberLink }))
      } else {
        subject = `Please sign: ${lease.contractNumber ?? 'Licence Agreement'} — ${settings?.contracts?.eSignName ?? settings?.company?.name ?? 'Hexa Space'}`
        html = eSignEmailHtml({ lease: mergedLease, tenant, settings })
      }
      await sendEmail({ to: tenant.email, subject, html, settings, tenantId: tenant?.id, emailType: 'esign' })
    } catch (e) {
      console.error('E-sign email failed:', e) // lease status already updated
    }
  }
  return updates
}

// A freshly created renewal should go straight out for signature.
export function shouldAutoSendForSigning(lease) {
  return lease?.contractType === 'Renewal'
    && !['manually_signed', 'e_signed', 'out_for_signature'].includes(lease?.signatureStatus)
}
