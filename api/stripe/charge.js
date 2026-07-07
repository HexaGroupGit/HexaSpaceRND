// POST /api/stripe/charge — charges the amount owing on an invoice against the
// tenant's saved card (off-session). Used by the admin "Charge saved card"
// action; the daily overdue cron calls chargeInvoiceOffSession directly.
// Body: { invoiceId }
import { stripeConfigured, chargeInvoiceOffSession } from '../_stripe.js'
import { applyCors } from '../_cors.js'
import { requireMember, isAdminEmail } from '../_auth.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!stripeConfigured()) return res.status(500).json({ error: 'Stripe not configured.' })

  // Verify the caller: admins may charge any invoice; a member may only charge
  // one belonging to their own company (paying their own bill).
  const auth = await requireMember(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const supabase = auth.sb
  const isAdmin = await isAdminEmail(supabase, auth.user.email)

  const { invoiceId } = req.body ?? {}
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required.' })

  try {
    const { data: invRow } = await supabase.from('invoices').select('data').eq('id', invoiceId).single()
    const invoice = invRow?.data
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' })
    if (!isAdmin && invoice.tenantId !== auth.companyId) {
      return res.status(403).json({ error: 'Not your invoice.' })
    }

    const { data: tRow } = await supabase.from('tenants').select('data').eq('id', invoice.tenantId).single()
    const tenant = tRow?.data
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' })

    const result = await chargeInvoiceOffSession(supabase, invoice, tenant)
    if (!result.ok) return res.status(402).json({ error: result.error, code: result.code })

    return res.status(200).json({ success: true, amount: result.amount, invoice: result.invoice })
  } catch (err) {
    console.error('Stripe charge error:', err)
    return res.status(500).json({ error: err.message })
  }
}
