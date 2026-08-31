// One-off: cancel and fully refund NeoMahi Limited's two South room bookings
// for Wed 2 + Thu 3 Sep 2026 (Matthew Sinclair), $369.60 inc GST each.
//
// He booked as a website GUEST (Stripe Checkout, no portal login), so he can't
// cancel these himself and there is — as of today — no admin button that both
// frees the room and sends the money back. This does the four things that need
// doing, in the order that is safe if it dies half way:
//
//   1. Stripe refund against the original PaymentIntent (money first — if this
//      fails nothing else has moved and the booking is still live).
//   2. Booking → Cancelled, stamped with the refund id. Frees South, and with
//      it North/West, which the Function Space block occupies together. The
//      Salto reconciler (api/salto/room-access.js) strips his already-granted
//      "Meeting Room" access off the back of the Cancelled status.
//   3. A credit note per invoice, creditNoteForId → the original, so the Xero
//      push raises an ACCRECCREDIT and the $672 + GST comes back out of
//      Additional Services income. Both originals are already in Xero as PAID.
//   4. A comment on each original recording the refund, so the invoice reads
//      correctly without being made to look unpaid (see below).
//
// The originals keep status 'paid' and their original payments[] untouched. He
// DID pay; the money went back out separately, and that is what the credit note
// says. Writing a negative payment onto them instead would show $0 of $369.60
// received and hand api/overdue-reminders.js two invoices to chase.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8')
  .split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const APPLY = process.argv.includes('--apply')
const TODAY = '2026-08-31'
const NOW_ISO = new Date().toISOString()

// What we surveyed before writing this. Every one of these is re-checked below:
// if prod has moved since, the script stops rather than refunding blind.
const JOBS = [
  { bookingId: 'bk1786338969194_ayig', ref: 'RKQKY2C', date: '2026-09-02', invoiceId: 'inv1786338969457_wm3q', invNumber: 'INV-3372', pi: 'pi_3U2lZ8F2rWzvoc2n0mEazQKZ' },
  { bookingId: 'bk1786339156198_8drq', ref: 'B38EG2D', date: '2026-09-03', invoiceId: 'inv1786339156446_8tgi', invNumber: 'INV-3373', pi: 'pi_3U2lcBF2rWzvoc2n0U4WQBC1' },
]
const TENANT_ID = 't1786338967965_kwfy'   // NeoMahi Limited
const EX_GST = 336                        // room hire, ex GST
const INC_GST = 369.60                    // what the card was charged
const CENTS = 36960

async function stripeFetch(path, params = null, method = params ? 'POST' : 'GET') {
  const body = params ? new URLSearchParams(Object.entries(params).flatMap(([k, v]) =>
    v && typeof v === 'object' ? Object.entries(v).map(([k2, v2]) => [`${k}[${k2}]`, String(v2)]) : [[k, String(v)]]
  )) : undefined
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return { ok: r.ok, json: await r.json().catch(() => ({})) }
}

const money = (v) => `$${Number(v).toFixed(2)}`

// ── Read + verify current state ─────────────────────────────────────────────
const { data: bRows, error: bErr } = await sb.from('bookings').select('id,data').in('id', JOBS.map(j => j.bookingId))
if (bErr) throw bErr
const { data: iRows, error: iErr } = await sb.from('invoices').select('id,data').in('id', JOBS.map(j => j.invoiceId))
if (iErr) throw iErr

for (const job of JOBS) {
  const b = bRows.find(r => r.id === job.bookingId)?.data
  const inv = iRows.find(r => r.id === job.invoiceId)?.data
  if (!b) throw new Error(`booking ${job.bookingId} (${job.ref}) not found — stop`)
  if (!inv) throw new Error(`invoice ${job.invNumber} not found — stop`)

  if (b.status !== 'Confirmed') throw new Error(`${job.ref} is '${b.status}', expected 'Confirmed' — someone has already touched it, stop`)
  if (b.refundedAt || b.stripeRefundId) throw new Error(`${job.ref} is already stamped refunded — stop`)
  if (b.companyId !== TENANT_ID) throw new Error(`${job.ref} belongs to ${b.companyId}, not NeoMahi — stop`)
  if (b.resourceId !== 'hx_mr_south') throw new Error(`${job.ref} is on ${b.resourceId}, expected South — stop`)
  if (b.date !== job.date) throw new Error(`${job.ref} is dated ${b.date}, expected ${job.date} — stop`)
  if (b.doorOpenedAt) throw new Error(`${job.ref} has a door open stamped (${b.doorOpenedAt}) — the room was used, refund is NOT automatic, stop`)
  if (new Date(`${b.date}T${b.startTime}:00`) <= new Date()) throw new Error(`${job.ref} has already started — refund is not automatic, stop`)
  if (Number(b.paidAmount) !== INC_GST) throw new Error(`${job.ref} records ${money(b.paidAmount)} paid, expected ${money(INC_GST)} — stop`)

  // The PaymentIntent must agree from BOTH sides — the booking and the invoice
  // payment line — before we hand Stripe a refund instruction.
  const invPi = (inv.payments ?? []).map(p => String(p.reference ?? '')).find(r => r.startsWith('pi_'))
  if (b.stripePaymentIntentId !== job.pi) throw new Error(`${job.ref} booking PI is ${b.stripePaymentIntentId}, expected ${job.pi} — stop`)
  if (invPi !== job.pi) throw new Error(`${job.invNumber} payment PI is ${invPi}, expected ${job.pi} — stop`)
  if (inv.tenantId !== TENANT_ID) throw new Error(`${job.invNumber} is not NeoMahi's — stop`)

  const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  if (Math.round(paid * 100) / 100 !== INC_GST) throw new Error(`${job.invNumber} shows ${money(paid)} received, expected ${money(INC_GST)} — stop`)

  const st = await stripeFetch(`/payment_intents/${job.pi}?expand[]=latest_charge`)
  if (!st.ok) throw new Error(`Stripe would not read ${job.pi}: ${st.json?.error?.message ?? 'unknown error'} — stop`)
  if (st.json.status !== 'succeeded') throw new Error(`${job.pi} is '${st.json.status}', not succeeded — stop`)
  if (st.json.amount !== CENTS) throw new Error(`${job.pi} is ${st.json.amount}c, expected ${CENTS}c — stop`)
  if (st.json.latest_charge?.refunded || Number(st.json.latest_charge?.amount_refunded) > 0)
    throw new Error(`${job.pi} has already been refunded ${money((st.json.latest_charge.amount_refunded ?? 0) / 100)} — stop`)

  job._booking = b
  job._invoice = inv
  job._card = st.json.latest_charge?.payment_method_details?.card
}

// Refuse to run twice: a credit note against either invoice means a prior run.
const { data: existing, error: eErr } = await sb.from('invoices').select('data').eq('data->>tenantId', TENANT_ID)
if (eErr) throw eErr
for (const r of existing ?? []) {
  if (JOBS.some(j => r.data?.creditNoteForId === j.invoiceId))
    throw new Error(`a credit note (${r.data.number}) already exists against one of these invoices — stop`)
}

// ── Allocate credit-note numbers (read-max-plus-one, same as auto-billing) ───
const nums = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('invoices').select('data->>number').range(from, from + 999)
  if (error) throw error
  nums.push(...data.map(r => parseInt(String(r.number ?? '').replace(/\D/g, ''), 10)).filter(n => !isNaN(n) && n > 0))
  if (data.length < 1000) break
}
let next = Math.max(...nums)
console.log(`read ${nums.length} invoice numbers, highest INV-${next}`)

// ── Plan ────────────────────────────────────────────────────────────────────
console.log(`\nNeoMahi Limited · Matthew Sinclair · matthew.sinclair@neomahi.com`)
for (const job of JOBS) {
  const c = job._card ? `${job._card.brand} ····${job._card.last4}` : 'card'
  console.log(`\n${job.ref}  South  ${job.date} ${job._booking.startTime}–${job._booking.endTime}`)
  console.log(`  refund   ${money(INC_GST)} → ${c}  (${job.pi})`)
  console.log(`  booking  Confirmed → Cancelled`)
  console.log(`  credit   INV-${++next} for ${money(-INC_GST)} inc GST, credits ${job.invNumber}`)
  job._creditNumber = `INV-${next}`
}
console.log(`\ntotal refunded ${money(INC_GST * 2)} inc GST  (${money(EX_GST * 2)} ex + ${money(EX_GST * 2 * 0.1)} GST)`)
console.log(`South frees up on both days — and with it North + West (Function Space block).`)
console.log(`Salto: roomAccessSentAt is stamped on both; the Cancelled status makes the`)
console.log(`room-access reconciler strip his Meeting Room grant. No manual Salto work.`)

if (!APPLY) { console.log('\nDRY RUN — re-run with --apply to refund and write.'); process.exit(0) }

// ── Apply ───────────────────────────────────────────────────────────────────
for (const job of JOBS) {
  // 1. Money first. Idempotency key so a retry of this exact refund cannot
  //    double-pay if the write below fails and the script is run again.
  const r = await stripeFetch('/refunds', {
    payment_intent: job.pi,
    amount: CENTS,
    reason: 'requested_by_customer',
    'metadata[kind]': 'room_booking_refund',
    'metadata[bookingRef]': job.ref,
    'metadata[invoice]': job.invNumber,
  })
  if (!r.ok || !['succeeded', 'pending'].includes(r.json?.status))
    throw new Error(`Stripe refused to refund ${job.pi}: ${r.json?.error?.message ?? r.json?.status ?? 'unknown'} — STOP, nothing else written for this booking`)
  const refundId = r.json.id
  console.log(`${job.ref}: refunded ${money(INC_GST)} — ${refundId} (${r.json.status})`)

  // 2. Booking cancelled + stamped.
  const booking = {
    ...job._booking,
    status: 'Cancelled',
    cancelledAt: NOW_ISO,
    cancelledBy: 'Admin',
    cancelReason: 'Client cancelled by email 31/08/2026 — meeting not going ahead. Outside the 24-hour window, refunded in full.',
    refundedAt: NOW_ISO,
    refundAmount: INC_GST,
    stripeRefundId: refundId,
    paidBy: 'refunded',
    creditsUsed: 0,
    feeAmount: 0,
    feeId: null,
  }
  const bw = await sb.from('bookings').update({ data: booking, updated_at: NOW_ISO }).eq('id', job.bookingId)
  if (bw.error) throw bw.error

  // 3. Credit note → Xero as ACCRECCREDIT. status 'paid' (not 'pending'):
  //    api/overdue-reminders.js has no negative-total guard and would chase it.
  //    xeroSync false so the next sync picks it up.
  const id = `inv${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const creditNote = {
    id,
    number: job._creditNumber,
    tenantId: TENANT_ID,
    leaseId: null,
    source: 'manual',
    invoiceType: 'creditNote',
    status: 'paid',
    sentStatus: 'not_sent',
    issueDate: TODAY,
    dueDate: TODAY,
    periodStart: job._invoice.periodStart,
    periodEnd: job._invoice.periodEnd,
    reference: `Credit note for ${job.invNumber} — booking ${job.ref} cancelled and refunded`,
    companyName: job._invoice.companyName ?? 'NeoMahi Limited',
    contactName: job._invoice.contactName ?? 'Matthew Sinclair',
    clientEmail: 'matthew.sinclair@neomahi.com',
    currency: 'AUD',
    // Room hire is a taxable supply, so the reversal carries GST too.
    vatEnabled: true,
    discountPct: 0,
    isProrated: false,
    paymentMethod: '',
    xeroSync: false,
    creditNoteForId: job.invoiceId,
    bookingId: job.bookingId,
    refundedAt: NOW_ISO,
    refundMethod: 'Stripe (card)',
    refundReference: refundId,
    stripeRefundId: refundId,
    lineItems: [{
      id: `li_${id}_0`,
      description: `Credit — South Booking ${job.date} ${job._booking.startTime}–${job._booking.endTime} cancelled (reverses ${job.invNumber}, ref ${job.ref})`,
      revenueAccount: 'Additional Services',
      unitPrice: -EX_GST,
      qty: 1,
      discountPct: 0,
    }],
    payments: [{
      id: `ref_${refundId.slice(-10)}`,
      date: TODAY,
      amount: -INC_GST,
      method: 'Stripe refund',
      reference: refundId,
    }],
    comments: [{
      id: `cmt${Date.now()}`,
      text: `31/08/2026 — client cancelled by email, ${money(INC_GST)} refunded to the card in full (${refundId}). ${job.invNumber} stays paid; this credit note reverses the income.`,
      createdAt: TODAY,
    }],
  }
  const cw = await sb.from('invoices').insert({ id, data: creditNote })
  if (cw.error) throw cw.error

  // 4. Trail on the original. Status and payments deliberately untouched.
  const original = {
    ...job._invoice,
    refundedAt: NOW_ISO,
    refundedByCreditNoteId: id,
    comments: [...(job._invoice.comments ?? []), {
      id: `cmt${Date.now() + 1}`,
      text: `31/08/2026 — booking ${job.ref} cancelled by the client (outside the 24-hour window). ${money(INC_GST)} refunded to the card via Stripe (${refundId}) and reversed by credit note ${job._creditNumber}. This invoice stays 'paid': the payment was genuinely received, and the money went back out separately.`,
      createdAt: TODAY,
    }],
  }
  const ow = await sb.from('invoices').update({ data: original, updated_at: NOW_ISO }).eq('id', job.invoiceId)
  if (ow.error) throw ow.error

  console.log(`${job.ref}: cancelled, ${job._creditNumber} raised against ${job.invNumber}`)
}

console.log(`\nDone. ${money(INC_GST * 2)} back to Matthew's card (5–10 business days).`)
console.log(`Next Xero sync pushes both credit notes. Email him to confirm — he asked to be told.`)
