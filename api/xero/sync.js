// POST /api/xero/sync — pushes platform invoices to Xero and pulls payment
// status back. Body: { action: 'push' | 'pull', dryRun?: boolean }
//
// HARD GATE: live sync only runs when Settings → Integrations → Xero has
// "Enable Xero sync" turned ON (settings.xero.syncEnabled), and only touches
// invoices whose period starts on/after settings.xero.syncFrom (default
// 2026-09-01). A dry run is allowed while sync is off — it reports what
// WOULD be pushed without writing anything to Xero or the platform.

import { getSupabase, loadConnection, stampConnection, xeroFetch, parseXeroDate } from './_client.js'
import { selectAllRows } from '../_db.js'
import { sendResendEmail } from '../_email.js'
import { brandFrame, bKicker, bH1, bP, bSmall } from '../_brand.js'

// ── account mapping (mirrors src/components/spaces/shared.jsx) ──────────────
const DEFAULT_XERO_ACCOUNTS = {
  deposits:      'Deposit in Advance (810)',
  membershipL45: 'L4&5 Membership Fees - Offices, Hotdesks, Virtual Offices (201)',
  oneOffL45:     'L4&5 Membership Fees - Parking Space & Other (202)',
  bookingL45:    'L4&5 Membership Fees - Meeting Rooms, Event Space & Media Studios (203)',
  orderL45:      'L4&5 Membership Fees - Meeting Rooms, Event Space & Media Studios (203)',
  membershipL2:  'L2 Membership Fees - Offices, Hotdesks, Virtual Offices (201.1)',
  parkingL2:     'L2 Membership Fees - Parking Space & Other (202.2)',
}

// Short code in trailing parens, e.g. "L4&5 … (201)" → "201".
function accountCode(s) {
  const m = String(s || '').match(/\(([^)]+)\)\s*$/)
  return m ? m[1] : ''
}

function lineAccountCode(li, invoice, space, settings) {
  const x = { ...DEFAULT_XERO_ACCOUNTS, ...(settings.xero?.revenueAccounts ?? {}) }
  const name = String(li.revenueAccount ?? '')
  const isL2 = space?.floor === 'l2'

  const direct = accountCode(name)
  if (direct) return direct
  if (invoice.invoiceType === 'deposit' || /deposit/i.test(name)) return accountCode(x.deposits)
  if (/booking|meeting|event|studio/i.test(name)) return accountCode(x.bookingL45)
  // Room/studio BOOKING lines whose revenue account carries no signal (e.g.
  // "Additional Services") — the description does: "Media Studios Booking …".
  if (/booking/i.test(String(li.description ?? ''))) return accountCode(x.bookingL45)
  if (/parking/i.test(name)) return accountCode(isL2 ? x.parkingL2 : x.oneOffL45)
  if (space?.type === 'parking') return accountCode(isL2 ? x.parkingL2 : x.oneOffL45)
  return accountCode(isL2 ? x.membershipL2 : x.membershipL45)
}

function invoiceTotal(inv) {
  return (inv.lineItems ?? []).reduce((sum, li) => {
    const net = Number(li.unitPrice ?? 0) * Number(li.qty ?? 1) * (1 - Number(li.discountPct ?? 0) / 100)
    return sum + net
  }, 0)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function loadTable(supabase, table) {
  const rows = await selectAllRows(supabase, table)
  return rows.map((r) => r.data)
}

async function saveRow(supabase, table, id, data) {
  const { error } = await supabase.from(table).upsert({ id, data, updated_at: new Date().toISOString() })
  if (error) throw new Error(`${table}/${id}: ${error.message}`)
}

// Find-or-create the Xero contact for a tenant; caches ContactID on the tenant.
async function ensureContact(supabase, tenant, dryRun) {
  if (tenant.xeroContactId) return tenant.xeroContactId
  if (dryRun) return null

  const term = encodeURIComponent(tenant.businessName ?? tenant.contactName ?? tenant.email ?? '')
  const found = await xeroFetch(supabase, `/Contacts?searchTerm=${term}`)
  let contact = (found.json?.Contacts ?? []).find(
    (c) =>
      c.Name?.toLowerCase() === (tenant.businessName ?? '').toLowerCase() ||
      (tenant.email && c.EmailAddress?.toLowerCase() === tenant.email.toLowerCase())
  )

  if (!contact) {
    const created = await xeroFetch(supabase, '/Contacts', {
      method: 'POST',
      body: {
        Contacts: [{
          Name: tenant.businessName ?? tenant.contactName ?? tenant.email,
          FirstName: (tenant.contactName ?? '').split(' ')[0] || undefined,
          LastName: (tenant.contactName ?? '').split(' ').slice(1).join(' ') || undefined,
          EmailAddress: tenant.email || undefined,
          TaxNumber: tenant.abn || undefined,
        }],
      },
    })
    contact = created.json?.Contacts?.[0]
    if (!created.ok || !contact?.ContactID) {
      throw new Error(`Contact create failed for ${tenant.businessName}: ${JSON.stringify(created.json?.Elements?.[0]?.ValidationErrors ?? created.json)}`)
    }
  }

  tenant.xeroContactId = contact.ContactID
  await saveRow(supabase, 'tenants', tenant.id, tenant)
  return contact.ContactID
}

export default async function handler(req, res) {
  // GET = a scheduled cron; POST = the Settings UI actions.
  // Two crons hit this route (see vercel.json): ?action=push sends newly raised
  // invoices to Xero, restates edited ones and voids cancelled ones; the
  // default pull marks platform invoices paid once Xero reconciles them.
  // The push runs earlier in the hour so the pull that follows can settle
  // anything it just created.
  const isCron = req.method === 'GET'
  if (req.method !== 'POST' && !isCron) return res.status(405).json({ error: 'Method not allowed' })

  // Cron (GET, Bearer CRON_SECRET) or a verified admin (POST from Settings) only.
  const { requireCronOrAdmin } = await import('../_auth.js')
  const _g = await requireCronOrAdmin(req)
  if (!_g.ok) return res.status(_g.status).json({ error: _g.error })

  const { action = 'push', dryRun = false } = isCron
    ? { action: req.query?.action === 'push' ? 'push' : 'pull', dryRun: false }
    : (req.body ?? {})

  try {
    const supabase = getSupabase()
    const conn = await loadConnection(supabase)
    if (!conn?.refreshToken) {
      // The cron must not register as a failure while Xero simply isn't connected.
      if (isCron) return res.status(200).json({ skipped: 'Xero is not connected.' })
      return res.status(400).json({ error: 'Xero is not connected.' })
    }

    const { data: settRow } = await supabase.from('settings').select('data').eq('id', 'global').single()
    const settings = settRow?.data ?? {}
    const syncEnabled = settings.xero?.syncEnabled === true
    // Pull (payment status flowing BACK from Xero) can be enabled on its own,
    // ahead of the push go-live — it only ever marks platform invoices paid.
    const pullEnabled = syncEnabled || settings.xero?.pullEnabled === true
    const syncFrom = settings.xero?.syncFrom || '2026-09-01'

    if (!dryRun && action === 'pull' && !pullEnabled) {
      const msg = 'Xero pull is switched OFF in Settings — enable "Xero sync" or "Pull payments only" first.'
      return res.status(isCron ? 200 : 403).json(isCron ? { skipped: msg } : { error: msg })
    }
    if (!dryRun && action !== 'pull' && !syncEnabled) {
      // Same as the pull above: a cron must not register as a failure just
      // because sync is still switched off.
      const msg = `Xero sync is switched OFF in Settings (planned go-live ${syncFrom}). Run a dry run to preview, or enable sync first.`
      return res.status(isCron ? 200 : 403).json(isCron ? { skipped: msg } : { error: msg })
    }

    const [invoices, tenants, leases, spaces] = await Promise.all([
      loadTable(supabase, 'invoices'),
      loadTable(supabase, 'tenants'),
      loadTable(supabase, 'leases'),
      loadTable(supabase, 'spaces'),
    ])

    // ── PULL: mark platform invoices paid when they're paid in Xero ─────────
    if (action === 'pull') {
      // Overdue counts too — an unpaid invoice flips to 'overdue' after its
      // due date, and those are exactly the ones that get paid late.
      const candidates = invoices.filter((i) => i.xeroInvoiceId && ['pending', 'overdue'].includes(i.status))
      const paidMarked = [], partial = [], voidedInXero = [], receipts = [], linkedByNumber = []
      // invoice.id → its OWN twin's ContactID, recorded from the fetch below.
      // Never map tenant → contact: one tenant's invoices can be linked to
      // different Xero contacts (e.g. INV-2956 moved You Hao → Top 1 Care),
      // and a tenant-level map would compare against the wrong balance.
      const twinContact = new Map()
      const partialTwins = new Set() // invoice.ids whose twin is partially paid

      // Unpaid invoices with NO Xero link (migration/backfill gaps) are
      // invisible to the ID-based pull — try to adopt the Xero twin by invoice
      // number first. Xero raises its own INV-#### invoices with no platform
      // twin, so a number match only counts as the twin when it's an ACCREC
      // sales invoice AND the totals agree.
      const unlinked = invoices.filter((i) => !i.xeroInvoiceId && ['pending', 'overdue'].includes(i.status) && i.number)
      for (const batch of chunk(unlinked, 40)) {
        const nums = batch.map((i) => encodeURIComponent(i.number)).join(',')
        const r = await xeroFetch(supabase, `/Invoices?InvoiceNumbers=${nums}`)
        if (!r.ok) break // linking is best-effort; the ID-based pull below still runs
        for (const xi of r.json?.Invoices ?? []) {
          if (xi.Type !== 'ACCREC' || xi.Status === 'VOIDED' || xi.Status === 'DELETED') continue
          const inv = batch.find((i) => String(i.number).trim() === String(xi.InvoiceNumber).trim() && !i.xeroInvoiceId)
          if (!inv) continue
          const ownTotal = Math.round(invoiceTotal(inv) * (inv.vatEnabled !== false ? 1.1 : 1) * 100) / 100
          if (Math.abs(Number(xi.Total) - ownTotal) > 0.05) continue // same number, different invoice
          inv.xeroInvoiceId = xi.InvoiceID
          if (!dryRun) await saveRow(supabase, 'invoices', inv.id, inv)
          linkedByNumber.push({ number: inv.number })
          candidates.push(inv) // now visible to the paid check below
        }
      }

      for (const batch of chunk(candidates, 40)) {
        const ids = batch.map((i) => i.xeroInvoiceId).join(',')
        const r = await xeroFetch(supabase, `/Invoices?IDs=${ids}`)
        if (!r.ok) throw new Error(`Xero invoice fetch failed: ${JSON.stringify(r.json)}`)

        for (const xi of r.json?.Invoices ?? []) {
          const inv = batch.find((i) => i.xeroInvoiceId === xi.InvoiceID)
          if (!inv) continue
          if (xi.Contact?.ContactID) twinContact.set(inv.id, xi.Contact.ContactID)
          if (xi.Status === 'PAID') {
            // Several platform invoices can share one combined Xero invoice
            // (migrated office+parking) — record each invoice's OWN total,
            // not the combined AmountPaid. Count ALL invoices sharing the
            // link (an already-paid group-mate still means "combined").
            const shared = invoices.filter((c) => c.xeroInvoiceId === xi.InvoiceID && c.status !== 'voided').length > 1
            const ownTotal = Math.round(invoiceTotal(inv) * (inv.vatEnabled !== false ? 1.1 : 1) * 100) / 100
            if (!dryRun) {
              inv.payments = [
                ...(inv.payments ?? []),
                {
                  id: `pay_xero_${xi.InvoiceID.slice(0, 8)}_${inv.id.slice(-4)}`,
                  amount: shared ? ownTotal : xi.AmountPaid,
                  date: parseXeroDate(xi.FullyPaidOnDate) ?? new Date().toISOString().split('T')[0],
                  method: 'xero',
                  reference: 'Synced from Xero',
                },
              ]
              inv.status = 'paid'
              await saveRow(supabase, 'invoices', inv.id, inv)
              receipts.push({ inv, amount: shared ? ownTotal : xi.AmountPaid })
            }
            paidMarked.push({ number: inv.number, amount: shared ? ownTotal : xi.AmountPaid })
          } else if (xi.Status === 'VOIDED' || xi.Status === 'DELETED') {
            voidedInXero.push({ number: inv.number }) // reported, never auto-voided here
          } else if (Number(xi.AmountPaid) > 0) {
            partial.push({ number: inv.number, paid: xi.AmountPaid, due: xi.AmountDue })
            partialTwins.add(inv.id)
          }
        }
      }

      // ── Contact-level balance sync ───────────────────────────────────────
      // Payments in Xero don't always land on the invoice the portal has open
      // (July's rent reconciled against June's Xero invoice, credit notes,
      // write-offs). Per contact, Xero's outstanding AR is the truth for WHAT
      // is owed even when the invoice-level twin check above can't see it:
      //  - Xero balance BELOW the portal's open total → settle portal invoices
      //    oldest-first until they agree (never partially — stop at the first
      //    invoice that doesn't fit; a partial is a reconciliation question).
      //  - Xero balance ABOVE the portal's → Xero knows about debt the portal
      //    doesn't (e.g. a Xero-only invoice) — report + ops alert.
      // Only Xero-linked invoices are counted/settled: platform-only invoices
      // (never pushed) have no Xero side and must stay untouched.
      const settledByBalance = [], contactOwesMore = []
      const ownTotal = (i) => Math.round(invoiceTotal(i) * (i.vatEnabled !== false ? 1.1 : 1) * 100) / 100
      const justPaid = new Set(paidMarked.map((p) => p.number))
      const voidedNums = new Set(voidedInXero.map((v) => v.number))

      const byContact = new Map()
      for (const inv of invoices) {
        if (!inv.xeroInvoiceId || !['pending', 'overdue'].includes(inv.status)) continue
        if (justPaid.has(inv.number) || voidedNums.has(inv.number)) continue
        const cid = twinContact.get(inv.id)
        if (!cid) continue
        if (!byContact.has(cid)) byContact.set(cid, [])
        byContact.get(cid).push(inv)
      }

      for (const batch of chunk([...byContact.keys()], 40)) {
        // page=1 matters: Xero only includes Balances on paginated reads.
        const r = await xeroFetch(supabase, `/Contacts?IDs=${batch.join(',')}&page=1`)
        if (!r.ok) break // best-effort — balance sync just waits for the next run
        for (const c of r.json?.Contacts ?? []) {
          const open = byContact.get(c.ContactID)
          const xeroOut = Number(c.Balances?.AccountsReceivable?.Outstanding)
          if (!open || !Number.isFinite(xeroOut)) continue
          const platformOut = Math.round(open.reduce((s, i) => s + ownTotal(i), 0) * 100) / 100
          if (xeroOut > platformOut + 0.05) {
            contactOwesMore.push({ contact: c.Name, xeroOutstanding: xeroOut, platformOutstanding: platformOut })
            continue
          }
          let excess = Math.round((platformOut - xeroOut) * 100) / 100
          if (excess <= 0.05) continue
          // A partially-paid twin shifts the contact balance by the paid
          // portion, which can fake an "excess" that would settle a genuinely
          // unpaid OLDER invoice. Partial payments are a reconciliation
          // question — leave the whole contact to the human.
          if (open.some((i) => partialTwins.has(i.id))) continue
          open.sort((a, b) => String(a.issueDate ?? '').localeCompare(String(b.issueDate ?? '')))
          for (const inv of open) {
            const total = ownTotal(inv)
            if (total > excess + 0.05) break
            excess = Math.round((excess - total) * 100) / 100
            if (!dryRun) {
              inv.payments = [
                ...(inv.payments ?? []),
                {
                  id: `pay_xero_bal_${inv.id.slice(-6)}`,
                  amount: total,
                  date: new Date().toISOString().split('T')[0],
                  method: 'xero',
                  reference: 'Settled from Xero contact balance (payment was reconciled against a different invoice in Xero)',
                },
              ]
              inv.status = 'paid'
              await saveRow(supabase, 'invoices', inv.id, inv)
              receipts.push({ inv, amount: total })
            }
            settledByBalance.push({ number: inv.number, contact: c.Name, amount: total })
          }
        }
      }

      // Payment receipt to each tenant's billing contact (goes through the
      // central email guard — safe mode redirects until deliberately lifted).
      const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
      const fromEmail = settings?.emails?.fromEmail || 'noreply@hexaspace.com.au'
      for (const { inv, amount } of receipts) {
        const tenant = tenants.find((t) => t.id === inv.tenantId)
        if (!tenant?.email) continue
        const inner =
          bKicker('Payment Receipt') +
          bH1(`$${Number(amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD`) +
          bP(`Hi ${tenant.contactName || tenant.businessName},`) +
          bP(`We've received your payment for invoice <strong>${inv.number}</strong>. Thank you — no further action is needed.`) +
          bSmall(`This is an automated receipt from ${fromName}. Questions about your account? Just reply to this email.`)
        await sendResendEmail({
          from: `${fromName} <${fromEmail}>`,
          to: tenant.email,
          subject: `Payment receipt — ${inv.number} (${fromName})`,
          html: brandFrame(inner, { footerLabel: 'Accounts' }),
        }).catch(() => {})
      }

      // Ops alert (eric@ + info@): always when the balance sync settled
      // something (auditable action), and when the owes-more set CHANGES —
      // never re-sent every 6h for a known standing mismatch.
      const owesMoreFingerprint = JSON.stringify(
        contactOwesMore.map((o) => `${o.contact}:${o.xeroOutstanding}:${o.platformOutstanding}`).sort()
      )
      const owesMoreChanged = owesMoreFingerprint !== (conn.lastOwesMoreAlert ?? '[]')
      if (!dryRun && (settledByBalance.length || (owesMoreChanged && contactOwesMore.length))) {
        const inner =
          bKicker('Xero balance sync') +
          bH1('Contact balances need a look') +
          (settledByBalance.length
            ? bP(`<strong>Auto-settled on the portal</strong> (paid in Xero at contact level, against a different invoice):<br/>${settledByBalance.map((s) => `${s.number} — ${s.contact} — $${s.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`).join('<br/>')}`)
            : '') +
          (contactOwesMore.length
            ? bP(`<strong>Xero says these contacts owe MORE than the portal shows</strong> (likely a Xero-only invoice — the portal is under-reporting):<br/>${contactOwesMore.map((o) => `${o.contact} — Xero $${o.xeroOutstanding.toLocaleString('en-AU', { minimumFractionDigits: 2 })} vs portal $${o.platformOutstanding.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`).join('<br/>')}`)
            : '') +
          bSmall('Automated report from the 6-hourly Xero payment pull.')
        for (const to of ['eric@hexaspace.com.au', 'info@hexaspace.com.au']) {
          await sendResendEmail({
            from: `${fromName} <${fromEmail}>`,
            to,
            subject: `Xero balance sync — ${settledByBalance.length} settled, ${contactOwesMore.length} under-reported`,
            html: brandFrame(inner, { footerLabel: 'Accounts' }),
          }).catch(() => {})
        }
      }

      // stampConnection, NOT saveConnection({...conn}): getAccessToken rotated
      // the refresh token during this run — writing the stale conn back would
      // re-install the consumed token and kill the connection (forced reconnect).
      if (!dryRun) await stampConnection(supabase, { lastPull: new Date().toISOString(), lastOwesMoreAlert: owesMoreFingerprint })
      return res.status(200).json({ action, dryRun, checked: candidates.length, paidMarked, receipted: receipts.length, partial, voidedInXero, linkedByNumber, settledByBalance, contactOwesMore })
    }

    // ── PUSH: send unsynced invoices to Xero ─────────────────────────────────
    const gateDate = (i) => i.periodStart ?? i.issueDate ?? ''
    // Invoices RAISED on the platform after the OfficeRND cutover exist in no
    // other system — they must reach Xero even though their period predates the
    // syncFrom go-live (that gate only keeps MIGRATED history out). Without
    // this, a July-raised invoice has nothing in Xero to reconcile its bank
    // payment against.
    const NEW_INVOICE_PUSH_FROM = '2026-07-01'
    const eligible = [], creditNotes = [], skipped = []
    for (const i of invoices) {
      if (i.status === 'voided' || i.xeroSync) continue
      if (!['pending', 'paid', 'overdue'].includes(i.status)) continue
      if (gateDate(i) < syncFrom && (i.issueDate ?? '') < NEW_INVOICE_PUSH_FROM) { continue } // pre-go-live history stays out of Xero
      const total = invoiceTotal(i)
      // A refund is a NEGATIVE-total invoice here; Xero models it as a CreditNote,
      // not an Invoice. These used to be skipped and raised by hand.
      if (total < 0) {
        if (i.xeroCreditNoteId || i.xeroInvoiceId) continue
        creditNotes.push(i)
        continue
      }
      // Already linked to a Xero invoice (migration backfill or the pull's
      // number-adoption) — pushing again would create a duplicate.
      if (i.xeroInvoiceId) continue
      eligible.push(i)
    }

    const taxRate = settings.billingRules?.taxEnabled !== false
    const results = { pushed: [], linked: [], restated: [], voided: [], errors: [], skipped }

    // Xero UPSERTS POST /Invoices by InvoiceNumber — if the number already
    // exists there (an earlier push that never got xeroInvoiceId stamped back,
    // or an invoice Xero raised itself from its own INV-#### sequence), the
    // push becomes an UPDATE of that invoice, and Xero rejects updates to paid
    // ones ("status AUTHORISED cannot be applied … has payments allocated").
    // Check first: a same-number ACCREC with the same total is OUR invoice
    // already in Xero — adopt it as synced instead of pushing. A same-number
    // invoice with a different total belongs to someone else — never push
    // onto it.
    const adopted = new Set(), taken = new Set()
    for (const batch of chunk(eligible, 40)) {
      const nums = batch.map((i) => encodeURIComponent(i.number)).join(',')
      const r = await xeroFetch(supabase, `/Invoices?InvoiceNumbers=${nums}`)
      if (!r.ok) break // best-effort — a collision then surfaces as a push validation error
      for (const xi of r.json?.Invoices ?? []) {
        if (xi.Status === 'VOIDED' || xi.Status === 'DELETED') continue
        const inv = batch.find((i) => String(i.number).trim() === String(xi.InvoiceNumber).trim())
        if (!inv) continue
        const ownTotal = Math.round(invoiceTotal(inv) * (inv.vatEnabled !== false ? 1.1 : 1) * 100) / 100
        if (xi.Type === 'ACCREC' && Math.abs(Number(xi.Total) - ownTotal) <= 0.05) {
          adopted.add(inv.number)
          results.linked.push({ number: inv.number, xeroInvoiceId: xi.InvoiceID })
          if (!dryRun) {
            inv.xeroInvoiceId = xi.InvoiceID
            inv.xeroSync = true
            inv.xeroSyncedAt = new Date().toISOString()
            await saveRow(supabase, 'invoices', inv.id, inv)
          }
        } else {
          taken.add(inv.number)
          skipped.push({ number: inv.number, reason: `number already used in Xero by a different invoice (${xi.Contact?.Name ?? '?'} $${xi.Total}) — renumber before pushing` })
        }
      }
    }
    const toPush = eligible.filter((i) => !adopted.has(i.number) && !taken.has(i.number))

    // The Xero ACCREC payload for one platform invoice. Shared by the create
    // path and the restate path below, so an edited invoice lands in Xero
    // exactly as a freshly pushed one would.
    const buildInvoicePayload = async (inv) => {
      const tenant = tenants.find((t) => t.id === inv.tenantId)
      if (!tenant) throw new Error('No tenant on platform')
      const lease = leases.find((l) => l.id === inv.leaseId)
      const space = spaces.find((s) => s.id === lease?.spaceId)
      const contactId = await ensureContact(supabase, tenant, dryRun)

      // Security deposits are never a taxable supply while held — force
      // GST-exempt regardless of the invoice's vatEnabled flag.
      const taxType = inv.invoiceType === 'deposit' ? 'EXEMPTOUTPUT'
        : (taxRate && inv.vatEnabled !== false ? 'OUTPUT' : 'EXEMPTOUTPUT')
      return {
        Type: 'ACCREC',
        Contact: dryRun ? { Name: tenant.businessName } : { ContactID: contactId },
        InvoiceNumber: inv.number,
        Reference: lease?.contractNumber ?? '',
        Date: inv.issueDate,
        DueDate: inv.dueDate,
        Status: 'AUTHORISED',
        LineAmountTypes: 'Exclusive',
        CurrencyCode: 'AUD',
        LineItems: (inv.lineItems ?? []).map((li) => ({
          Description: li.description,
          Quantity: Number(li.qty ?? 1),
          UnitAmount: Number(li.unitPrice ?? 0),
          DiscountRate: Number(li.discountPct ?? 0) || undefined,
          AccountCode: lineAccountCode(li, inv, space, settings),
          TaxType: taxType,
        })),
      }
    }

    // Build payloads (and resolve contacts) invoice by invoice.
    const payloads = []
    for (const inv of toPush) {
      try {
        payloads.push({ inv, xero: await buildInvoicePayload(inv) })
      } catch (err) {
        results.errors.push({ number: inv.number, error: err.message })
      }
    }

    // ── RESTATE: amounts edited on the platform AFTER the first sync ─────────
    // The create path skips anything already carrying a xeroInvoiceId, so
    // without this an edit made in the portal never reaches Xero and the two
    // sides quietly disagree (Xero keeps whatever it held on the day it was
    // linked). Xero's POST /Invoices updates in place when the payload carries
    // an InvoiceID, but it refuses once money is allocated against the invoice —
    // those surface as a conflict to settle with a credit note by hand.
    const restatable = invoices.filter((i) =>
      i.xeroInvoiceId && !i.xeroCreditNoteId &&
      ['pending', 'paid', 'overdue'].includes(i.status) &&
      !(gateDate(i) < syncFrom && (i.issueDate ?? '') < NEW_INVOICE_PUSH_FROM))
    const restates = []
    for (const batch of chunk(restatable, 40)) {
      const r = await xeroFetch(supabase, `/Invoices?IDs=${batch.map((i) => i.xeroInvoiceId).join(',')}`)
      if (!r.ok) break // best-effort: a stale amount is better than a failed run
      for (const xi of r.json?.Invoices ?? []) {
        const inv = batch.find((i) => i.xeroInvoiceId === xi.InvoiceID)
        if (!inv) continue
        const ours = Math.round(invoiceTotal(inv) * (inv.vatEnabled !== false ? 1.1 : 1) * 100) / 100
        const theirs = Number(xi.Total ?? 0)
        if (Math.abs(theirs - ours) <= 0.05) continue
        // We already sent Xero exactly this figure and it still reads back
        // different — that is per-line GST rounding, not a real edit. Without
        // this the hourly cron would re-POST the same invoice forever.
        if (inv.xeroRestatedTotal != null && Math.abs(Number(inv.xeroRestatedTotal) - ours) <= 0.005) continue
        const paid = Number(xi.AmountPaid ?? 0)
        if (paid > 0 || ['VOIDED', 'DELETED', 'PAID'].includes(xi.Status)) {
          skipped.push({
            number: inv.number,
            reason: `amount changed here ($${theirs.toFixed(2)} → $${ours.toFixed(2)}) but Xero's copy is ${xi.Status}` +
              `${paid > 0 ? ` with $${paid.toFixed(2)} paid` : ''} — raise a credit note instead`,
          })
          continue
        }
        restates.push({ inv, was: theirs, now: ours })
      }
    }

    // ── VOID: invoices cancelled here that are still live in Xero ────────────
    // The eligibility loop drops voided invoices entirely, so a void done in
    // the portal never reached Xero — leaving a cancelled invoice sitting in
    // the books as revenue owed. Xero only accepts a void while nothing is
    // allocated against the invoice; once it is paid the correction has to be
    // a credit note, so those are reported rather than attempted.
    const voidable = invoices.filter((i) =>
      i.status === 'voided' && i.xeroInvoiceId && !i.xeroVoidedAt &&
      !(gateDate(i) < syncFrom && (i.issueDate ?? '') < NEW_INVOICE_PUSH_FROM))
    const voids = []
    for (const batch of chunk(voidable, 40)) {
      const r = await xeroFetch(supabase, `/Invoices?IDs=${batch.map((i) => i.xeroInvoiceId).join(',')}`)
      if (!r.ok) break // best-effort, same as the restate scan
      for (const xi of r.json?.Invoices ?? []) {
        const inv = batch.find((i) => i.xeroInvoiceId === xi.InvoiceID)
        if (!inv) continue
        // Already gone in Xero — record that locally so we stop re-checking it.
        if (['VOIDED', 'DELETED'].includes(xi.Status)) {
          if (!dryRun) {
            inv.xeroVoidedAt = new Date().toISOString()
            await saveRow(supabase, 'invoices', inv.id, inv)
          }
          continue
        }
        const paid = Number(xi.AmountPaid ?? 0)
        if (paid > 0 || xi.Status === 'PAID') {
          skipped.push({
            number: inv.number,
            reason: `voided here but Xero's copy is ${xi.Status}` +
              `${paid > 0 ? ` with $${paid.toFixed(2)} paid` : ''} — raise a credit note instead`,
          })
          continue
        }
        voids.push({ inv, amount: Number(xi.Total ?? 0) })
      }
    }

    if (dryRun) {
      return res.status(200).json({
        action, dryRun: true, syncEnabled, syncFrom,
        wouldPush: payloads.map((p) => ({
          number: p.inv.number,
          tenant: p.xero.Contact.Name ?? p.inv.tenantId,
          total: Math.round(invoiceTotal(p.inv) * 100) / 100,
          accounts: [...new Set(p.xero.LineItems.map((l) => l.AccountCode))],
        })),
        wouldPushCreditNotes: creditNotes.map((i) => ({
          number: i.number,
          reference: i.reference ?? '',
          amount: Math.abs(Math.round(invoiceTotal(i) * 100) / 100),
          allocateAgainst: invoices.find((x) => x.id === i.creditNoteForId)?.number ?? '(standing credit)',
        })),
        wouldLink: results.linked,
        wouldRestate: restates.map((r) => ({ number: r.inv.number, was: r.was, now: r.now })),
        wouldVoid: voids.map((v) => ({ number: v.inv.number, amount: v.amount })),
        skipped, errors: results.errors,
      })
    }

    // Live push, batched. SummarizeErrors=false → per-invoice validation results.
    for (const batch of chunk(payloads, 40)) {
      const r = await xeroFetch(supabase, '/Invoices?SummarizeErrors=false', {
        method: 'POST',
        body: { Invoices: batch.map((p) => p.xero) },
      })
      const returned = r.json?.Invoices ?? []
      for (let idx = 0; idx < batch.length; idx++) {
        const { inv } = batch[idx]
        const xi = returned[idx]
        const validationErrors = xi?.ValidationErrors ?? []
        if (xi?.InvoiceID && validationErrors.length === 0) {
          inv.xeroSync = true
          inv.xeroInvoiceId = xi.InvoiceID
          inv.xeroSyncedAt = new Date().toISOString()
          await saveRow(supabase, 'invoices', inv.id, inv)
          results.pushed.push({ number: inv.number, xeroInvoiceId: xi.InvoiceID })
        } else {
          results.errors.push({
            number: inv.number,
            error: validationErrors.map((e) => e.Message).join('; ') || `Xero rejected the batch (HTTP ${r.status})`,
          })
        }
      }
    }

    // ── RESTATE: replace the Xero copy of invoices edited since they synced ──
    for (const batch of chunk(restates, 40)) {
      const payload = []
      for (const { inv } of batch) {
        try {
          payload.push({ inv, xero: { ...(await buildInvoicePayload(inv)), InvoiceID: inv.xeroInvoiceId } })
        } catch (err) {
          results.errors.push({ number: inv.number, error: err.message })
        }
      }
      if (!payload.length) continue

      const r = await xeroFetch(supabase, '/Invoices?SummarizeErrors=false', {
        method: 'POST',
        body: { Invoices: payload.map((p) => p.xero) },
      })
      const returned = r.json?.Invoices ?? []
      for (let idx = 0; idx < payload.length; idx++) {
        const { inv } = payload[idx]
        const xi = returned[idx]
        const validationErrors = xi?.ValidationErrors ?? []
        if (xi?.InvoiceID && validationErrors.length === 0) {
          const meta = restates.find((x) => x.inv.id === inv.id)
          inv.xeroSyncedAt = new Date().toISOString()
          // The figure we sent, so the scan above can tell a genuine later edit
          // from Xero's own rounding of the same amount.
          inv.xeroRestatedTotal = meta?.now
          await saveRow(supabase, 'invoices', inv.id, inv)
          results.restated.push({ number: inv.number, was: meta?.was, now: meta?.now })
        } else {
          results.errors.push({
            number: inv.number,
            error: validationErrors.map((e) => e.Message).join('; ') || `Xero rejected the restate (HTTP ${r.status})`,
          })
        }
      }
    }

    // ── VOID: cancel the Xero copy of invoices voided here ───────────────────
    // One at a time: Xero's batch endpoint reports a rejected void as a
    // validation error on the whole payload, and a void that fails must not
    // take the others down with it.
    for (const { inv, amount } of voids) {
      const r = await xeroFetch(supabase, `/Invoices/${inv.xeroInvoiceId}`, {
        method: 'POST',
        body: { InvoiceID: inv.xeroInvoiceId, Status: 'VOIDED' },
      })
      const xi = r.json?.Invoices?.[0]
      if (r.ok && xi?.Status === 'VOIDED') {
        inv.xeroVoidedAt = new Date().toISOString()
        await saveRow(supabase, 'invoices', inv.id, inv)
        results.voided.push({ number: inv.number, amount })
      } else {
        results.errors.push({
          number: inv.number,
          error: (xi?.ValidationErrors ?? []).map((e) => e.Message).join('; ') ||
            `Xero rejected the void (HTTP ${r.status})`,
        })
      }
    }

    // ── PUSH: credit notes (deposit / bond refunds) as ACCRECCREDIT ──────────
    // Xero carries the sign in the document TYPE, so line amounts must be
    // POSITIVE here even though ours are negative. Where the original invoice
    // still has an amount owing we allocate the credit against it so the two net
    // off; if it was already paid the credit stays on the contact as a standing
    // credit and the cash going back out is recorded separately.
    for (const batch of chunk(creditNotes, 40)) {
      const payload = []
      for (const inv of batch) {
        const tenant = tenants.find((t) => t.id === inv.tenantId)
        if (!tenant) { results.errors.push({ number: inv.number, error: 'No tenant on platform' }); continue }
        let contactId = null
        try { contactId = await ensureContact(supabase, tenant, false) } catch (err) {
          results.errors.push({ number: inv.number, error: err.message }); continue
        }
        const lease = leases.find((l) => l.id === inv.leaseId)
        const space = spaces.find((s) => s.id === lease?.spaceId)
        // A held deposit was never a taxable supply, so returning it isn't either.
        const isDeposit = /deposit|bond/i.test(`${inv.invoiceType ?? ''} ${inv.reference ?? ''}`)
        const taxType = isDeposit ? 'EXEMPTOUTPUT'
          : (taxRate && inv.vatEnabled !== false ? 'OUTPUT' : 'EXEMPTOUTPUT')
        payload.push({
          inv,
          xero: {
            Type: 'ACCRECCREDIT',
            Contact: { ContactID: contactId },
            CreditNoteNumber: inv.number,
            Reference: inv.reference ?? '',
            Date: inv.issueDate,
            Status: 'AUTHORISED',
            LineAmountTypes: 'Exclusive',
            CurrencyCode: 'AUD',
            LineItems: (inv.lineItems ?? []).map((li) => ({
              Description: li.description,
              Quantity: Number(li.qty ?? 1),
              UnitAmount: Math.abs(Number(li.unitPrice ?? 0)),
              AccountCode: lineAccountCode(li, inv, space, settings),
              TaxType: taxType,
            })),
          },
        })
      }
      if (!payload.length) continue

      const r = await xeroFetch(supabase, '/CreditNotes?SummarizeErrors=false', {
        method: 'POST',
        body: { CreditNotes: payload.map((p) => p.xero) },
      })
      const returned = r.json?.CreditNotes ?? []
      for (let idx = 0; idx < payload.length; idx++) {
        const { inv } = payload[idx]
        const xc = returned[idx]
        const validationErrors = xc?.ValidationErrors ?? []
        if (!xc?.CreditNoteID || validationErrors.length) {
          results.errors.push({
            number: inv.number,
            error: validationErrors.map((e) => e.Message).join('; ') || `Xero rejected the credit note (HTTP ${r.status})`,
          })
          continue
        }
        inv.xeroSync = true
        inv.xeroCreditNoteId = xc.CreditNoteID
        inv.xeroSyncedAt = new Date().toISOString()

        // Allocate against the invoice it credits, if that invoice still owes.
        const target = invoices.find((x) => x.id === inv.creditNoteForId)
        if (target?.xeroInvoiceId) {
          const t = await xeroFetch(supabase, `/Invoices/${target.xeroInvoiceId}`)
          const due = Number(t.json?.Invoices?.[0]?.AmountDue ?? 0)
          const credit = Math.abs(Math.round(invoiceTotal(inv) * 100) / 100)
          const amount = Math.min(due, credit)
          if (amount > 0) {
            const a = await xeroFetch(supabase, `/CreditNotes/${xc.CreditNoteID}/Allocations`, {
              method: 'PUT',
              body: { Allocations: [{ Invoice: { InvoiceID: target.xeroInvoiceId }, Amount: amount }] },
            })
            if (a.ok) {
              inv.xeroAllocatedTo = target.number
              inv.xeroAllocatedAmount = amount
              results.creditNotesAllocated = results.creditNotesAllocated ?? []
              results.creditNotesAllocated.push({ number: inv.number, against: target.number, amount })
            } else {
              results.errors.push({ number: inv.number, error: `credit note created but allocation failed (HTTP ${a.status})` })
            }
          } else {
            inv.xeroAllocationNote = `${target.number} had nothing owing — left as a standing credit`
          }
        }
        await saveRow(supabase, 'invoices', inv.id, inv)
        results.creditNotesPushed = results.creditNotesPushed ?? []
        results.creditNotesPushed.push({ number: inv.number, xeroCreditNoteId: xc.CreditNoteID })
      }
    }

    await stampConnection(supabase, { lastPush: new Date().toISOString() })
    return res.status(200).json({ action, dryRun: false, ...results })
  } catch (err) {
    console.error('Xero sync error:', err)
    return res.status(500).json({ error: err.message })
  }
}
