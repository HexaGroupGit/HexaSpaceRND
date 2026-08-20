// Bank details for a security-deposit refund.
//
// POST /api/refund-bank-details
//   { token, action: 'load' }            → { clientName, amount, reference, saved }
//   { token, action: 'save', bank: {…} } → stores the account on the credit note
//   { invoiceId, action: 'request' }     → ADMIN: mints a token and emails the client
//
// Public + token-gated, same shape as /api/directory-name. The token lives on the
// credit note, so a link only ever exposes one refund.
//
// WHY this exists: the refund email already told clients "the refund will be
// processed to your nominated account", but nothing ever asked for an account or
// stored one — so it was chased by phone and lived outside the system.
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { applyCors } from './_cors.js'
import { sendResendEmail } from './_email.js'
import { brandFrame, bKicker, bH1, bP, bBtn, bSmall } from './_brand.js'
import { requireAdmin } from './_auth.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const money = (v) => `$${Number(v || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
const amountOf = (inv) => Math.abs((inv.lineItems ?? []).reduce(
  (s, li) => s + Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100), 0))

// Who the refund belongs to. Credit notes reach here from two directions: a
// function/drop-in refund stamps clientName/clientEmail on itself, while one
// raised against a member's invoice carries only tenantId — so fall back to the
// company record, then to its billing person, the way invoice emails do.
async function refundRecipient(sb, credit) {
  const name = credit.clientName ?? ''
  const email = credit.clientEmail ?? ''
  if (name && email) return { name, email }
  if (!credit.tenantId) return { name, email }

  const { data: tRow } = await sb.from('tenants').select('data').eq('id', credit.tenantId).single()
  const tenant = tRow?.data
  if (!tenant) return { name, email }

  let fallbackEmail = tenant.email ?? ''
  let fallbackName = tenant.businessName || tenant.contactName || ''
  if (!fallbackEmail) {
    const { data: mRows } = await sb.from('members').select('data').eq('data->>companyId', credit.tenantId)
    const mine = (mRows ?? []).map((r) => r.data).filter((m) => m?.email)
    const m = mine.find((x) => x.billingPerson) ?? mine.find((x) => x.contactPerson) ?? mine[0]
    if (m) { fallbackEmail = m.email; fallbackName = fallbackName || m.name || '' }
  }
  return { name: name || fallbackName, email: email || fallbackEmail }
}

// Australian BSB is 6 digits (usually shown 000-000); account numbers run 5-10.
function validateBank(b) {
  const name = String(b?.accountName ?? '').trim()
  const bsb = String(b?.bsb ?? '').replace(/[^\d]/g, '')
  const acc = String(b?.accountNumber ?? '').replace(/[^\d]/g, '')
  if (name.length < 2) return 'Please enter the account name.'
  if (bsb.length !== 6) return 'BSB must be 6 digits.'
  if (acc.length < 5 || acc.length > 10) return 'Account number must be between 5 and 10 digits.'
  return null
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured.' })
  const sb = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  const { token, action = 'load', bank, invoiceId } = req.body ?? {}

  try {
    // ── ADMIN: mint a token and email the client ──────────────────────────────
    if (action === 'request') {
      const auth = await requireAdmin(req)
      if (auth.error) return res.status(auth.status).json({ error: auth.error })
      if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required.' })

      const { data: row } = await sb.from('invoices').select('data').eq('id', invoiceId).single()
      const credit = row?.data
      if (!credit) return res.status(404).json({ error: 'Refund not found.' })

      // Who to ask. A function/drop-in refund carries the client on the credit
      // note itself; a credit note raised against a member's invoice carries
      // only tenantId, so fall back to the company and then to whoever handles
      // its billing — the same order the invoice emails use.
      const who = await refundRecipient(sb, credit)
      const to = who.email
      if (!to) return res.status(400).json({ error: 'No email on file for this client — add one on their profile first.' })

      const refundToken = credit.refundBankToken || randomBytes(18).toString('hex')
      const nowIso = new Date().toISOString()
      await sb.from('invoices').upsert({
        id: invoiceId,
        data: { ...credit, refundBankToken: refundToken, refundBankRequestedAt: nowIso },
        updated_at: nowIso,
      })

      const { data: sRow } = await sb.from('settings').select('data').eq('id', 'global').single()
      const settings = sRow?.data ?? {}
      const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
      const fromEmail = settings?.emails?.fromEmail || 'noreply@hexaspace.com.au'
      const portal = (settings?.portalUrl || 'https://portal.hexaspace.com.au').replace(/\/+$/, '')
      const link = `${portal}/refund-details/${refundToken}`
      const amount = amountOf(credit)

      // Deposits (function security deposits, lease bonds) get the wording that
      // fits them; anything else credited back reads as a plain refund.
      const isDeposit = /deposit|bond/i.test(`${credit.invoiceType ?? ''} ${credit.reference ?? ''}`)
      const what = isDeposit ? 'security deposit' : 'refund'
      const inner = bKicker(isDeposit ? 'Security deposit refund' : 'Refund') +
        bH1(`We’re returning ${money(amount)}`) +
        bP(`Hi ${who.name || 'there'},`) +
        bP(`Your ${what} of <strong>${money(amount)}</strong> is ready to come back to you. We just need the account it should go to.`) +
        bBtn('Enter your bank details', link) +
        bSmall(`The link is private to your refund. If the button doesn’t work, copy this:<br><a href="${link}" style="word-break:break-all">${link}</a>`) +
        bSmall('We never ask for a card number, password or ID for a refund — only your BSB and account number.')

      const r = await sendResendEmail({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        replyTo: settings?.emails?.replyTo,
        subject: `Your ${money(amount)} ${what} — where should we send it?`,
        html: brandFrame(inner, { footerLabel: isDeposit ? 'Security Deposit' : 'Refund' }),
      })
      return res.status(r.ok || r.skipped ? 200 : 500).json({ sent: !!(r.ok || r.skipped), link })
    }

    // ── PUBLIC: token-gated load / save ───────────────────────────────────────
    if (!token || String(token).length < 12) return res.status(404).json({ error: 'This link is not valid.' })
    const { data: rows } = await sb.from('invoices').select('id, data').eq('data->>refundBankToken', String(token)).limit(1)
    const found = rows?.[0]
    if (!found) return res.status(404).json({ error: 'This link is not valid.' })
    const credit = found.data

    if (action === 'load') {
      return res.status(200).json({
        clientName: credit.clientName ?? '',
        amount: amountOf(credit),
        reference: credit.reference ?? credit.number ?? '',
        alreadyPaid: !!credit.refundedAt,
        saved: credit.refundBank
          ? { accountName: credit.refundBank.accountName, bsb: credit.refundBank.bsb, accountNumber: `••••${String(credit.refundBank.accountNumber).slice(-3)}` }
          : null,
      })
    }

    if (action === 'save') {
      if (credit.refundedAt) return res.status(400).json({ error: 'This refund has already been paid.' })
      const bad = validateBank(bank)
      if (bad) return res.status(400).json({ error: bad })
      const nowIso = new Date().toISOString()
      const clean = {
        accountName: String(bank.accountName).trim(),
        bsb: String(bank.bsb).replace(/[^\d]/g, ''),
        accountNumber: String(bank.accountNumber).replace(/[^\d]/g, ''),
        submittedAt: nowIso,
      }
      await sb.from('invoices').upsert({
        id: found.id,
        data: { ...credit, refundBank: clean, refundBankReceivedAt: nowIso },
        updated_at: nowIso,
      })
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action.' })
  } catch (err) {
    console.error('refund-bank-details error:', err)
    return res.status(500).json({ error: err.message })
  }
}
