// Shared server-side helpers for lead-nurture emails (used by form-submit.js and
// lead-nurture.js). Underscore prefix = not exposed as an API route.
// NOTE: never import ../src/lib/sendEmail.js here — it pulls in the browser
// Supabase client (import.meta.env) and breaks in the serverless runtime.

export function fillVars(str, vars) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? (vars[k] ?? '') : m))
}

// Which brochure applies: private office vs desk/virtual office.
export function leadTypeFor(lead, space) {
  const t = `${lead?.enquiryType || ''} ${lead?.interest || ''} ${space?.type || ''} ${space?.unitNumber || ''}`.toLowerCase()
  if (/\boffice\b|private/.test(t) && !/virtual/.test(t)) return 'lead_office'
  return 'lead_desk'
}

export function findEmailTemplate(templates, emailType) {
  return (templates || []).find((t) => t?.category === 'email' && t?.emailType === emailType && t?.content) || null
}

// The book-a-tour form lives on the marketing website (www.hexaspace.com.au).
// Default the tour link there; override with settings.leads.tourUrl.
export function tourUrlFor(settings) {
  if (settings?.leads?.tourUrl) return settings.leads.tourUrl
  let site = (settings?.company?.website || 'hexaspace.com.au').replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!site.startsWith('www.')) site = `www.${site}`
  return `https://${site}/book-a-tour`
}

export function renderLead(template, { lead, membershipType, settings, tourLink, officeOptions }) {
  const name = settings?.company?.name || 'Hexa Space'
  const website = settings?.company?.website || 'hexaspace.com.au'
  const vars = {
    company: name,
    name: lead?.name || lead?.contactName || 'there',
    membershipType: membershipType || lead?.enquiryType || lead?.interest || 'membership',
    tourLink: tourLink || tourUrlFor(settings),
    officeOptions: officeOptions || '',
    website,
  }
  return { subject: fillVars(template?.subject || '', vars), html: fillVars(template?.content || '', vars) }
}

// Routes through the central safe-mode guard. `resendKey` is kept for signature
// compatibility but the guard reads RESEND_API_KEY itself. Returns a fetch-like
// object exposing `.ok`.
export async function sendResend(resendKey, { fromName, fromEmail, to, subject, html, replyTo }) {
  const { sendResendEmail } = await import('./_email.js')
  const r = await sendResendEmail({ from: `${fromName} <${fromEmail}>`, to, subject, html, replyTo })
  return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 500) }
}

// Days between two yyyy-mm-dd (or ISO) dates.
export function daysBetween(fromDate, toDate = new Date()) {
  const a = new Date(fromDate); const b = new Date(toDate)
  if (isNaN(a) || isNaN(b)) return 0
  return Math.floor((b - a) / 86400000)
}
