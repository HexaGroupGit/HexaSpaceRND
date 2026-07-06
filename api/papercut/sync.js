// POST /api/papercut/sync
// Ingests a period's PaperCut MF print charges (pushed by the on-prem connector,
// scripts/papercut-connector) and lands them as PaperCut-type Fee rows. The
// month-end bill run then folds each company's unbilled fees onto its invoice
// (see src/store/useStore.js and src/lib/billingEngine.js) — no change needed there.
//
// Why push, not pull: PaperCut MF's XML-RPC API binds to 127.0.0.1 at Box Hill and
// this handler runs on Vercel. The connector runs on the LAN, calls XML-RPC locally,
// and POSTs the result here. See docs/papercut-integration.md.
//
// Auth: shared secret in PAPERCUT_SYNC_TOKEN (Authorization: Bearer <token>).
// Idempotent: fee id is deterministic per (memberId, period), so re-running a
// period upserts in place instead of double-charging.
//
// SCAFFOLD: with PAPERCUT_SYNC_TOKEN unset OR SUPABASE_SERVICE_ROLE_KEY unset this
// returns a MOCK preview of what it *would* write, so the connector can be smoke-
// tested end-to-end before go-live.

import { createClient } from '@supabase/supabase-js'
import { selectAllRows } from '../_db.js'
import { applyCors } from '../_cors.js'

const SUPABASE_URL = process.env.SUPABASE_URL

// Deterministic id → an upsert key, so a re-synced period overwrites rather than
// duplicating. Slug the period so ids stay filesystem/URL-safe (e.g. 2026-07).
const feeId = (memberId, period) => `f_pc_${period}_${memberId}`.replace(/[^a-zA-Z0-9_-]/g, '')

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.PAPERCUT_SYNC_TOKEN
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const { period, usage } = req.body ?? {}
  // period: 'YYYY-MM' billing month. usage: [{ email, pages, jobs, amount }]
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({ error: 'period is required as "YYYY-MM".' })
  }
  if (!Array.isArray(usage)) {
    return res.status(400).json({ error: 'usage must be an array of { email, pages, jobs, amount }.' })
  }

  // ── AUTH ────────────────────────────────────────────────────────────────────
  // Only enforced when a token is configured; unset token → mock mode below.
  if (token) {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (bearer !== token) return res.status(401).json({ error: 'Invalid PaperCut sync token.' })
  }

  const periodDate = `${period}-01` // fee.date: first of the billing month (DD/MM display handled in UI)

  // ── MOCK MODE ────────────────────────────────────────────────────────────────
  // No token or no DB key → don't write; echo the normalised charges so the
  // connector author can confirm the payload shape and totals.
  if (!token || !serviceKey) {
    const preview = usage
      .filter((u) => u?.email && Number(u.amount) > 0)
      .map((u) => ({ email: String(u.email).toLowerCase(), amount: Number(u.amount), pages: u.pages ?? null, jobs: u.jobs ?? null }))
    return res.status(200).json({
      mock: true,
      period,
      wouldWrite: preview.length,
      totalAud: Math.round(preview.reduce((s, u) => s + u.amount, 0) * 100) / 100,
      preview,
      note: 'PaperCut sync not configured — mock preview only. Set PAPERCUT_SYNC_TOKEN and SUPABASE_SERVICE_ROLE_KEY to go live.',
    })
  }

  // ── LIVE MODE ────────────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let members, tenants
  try {
    const [mRows, tRows] = await Promise.all([
      selectAllRows(supabase, 'members'),
      selectAllRows(supabase, 'tenants'),
    ])
    members = mRows.map((r) => r.data)
    tenants = tRows.map((r) => r.data)
  } catch (err) {
    console.error('PaperCut sync load error:', err)
    return res.status(500).json({ error: 'Failed to load members.' })
  }

  const byEmail = new Map(members.filter((m) => m?.email).map((m) => [m.email.toLowerCase(), m]))
  const nowIso = new Date().toISOString()

  const written = [], unmatched = [], skipped = []

  for (const row of usage) {
    const email = String(row?.email || '').toLowerCase()
    const amount = Math.round((Number(row?.amount) || 0) * 100) / 100
    if (!email) { skipped.push({ reason: 'no email', row }); continue }
    if (amount <= 0) { skipped.push({ email, reason: 'zero charge' }); continue }

    const member = byEmail.get(email)
    if (!member) { unmatched.push(email); continue } // no member → surface, don't guess

    const company = tenants.find((t) => t.id === member.companyId)
    const id = feeId(member.id, period)
    const monthLabel = new Date(periodDate + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

    const fee = {
      id,
      name: `PaperCut printing — ${monthLabel}`,
      type: 'PaperCut',
      memberId: member.id,
      companyId: member.companyId || '',
      date: periodDate,
      price: amount,
      status: 'Not Paid',           // → bill run picks it up (isBillableFee: companyId + price>0 + not Paid/Waived/Invoiced)
      notes: `Printing above $30 monthly allowance${row.balance != null ? ` · PaperCut balance $${row.balance}` : ''} · synced from PaperCut MF`,
      source: 'papercut-sync',
      period,
      createdAt: new Date().toISOString().split('T')[0],
    }

    // Upsert on the deterministic id. If a prior sync of this period already flipped
    // the fee to Invoiced/Paid, DON'T resurrect it as Not Paid — skip to avoid
    // re-billing a period that's already on an invoice.
    const { data: existingRow } = await supabase.from('fees').select('data').eq('id', id).maybeSingle()
    const existing = existingRow?.data
    if (existing && ['Invoiced', 'Paid'].includes(existing.status)) {
      skipped.push({ email, reason: `already ${existing.status}` })
      continue
    }

    const { error } = await supabase
      .from('fees')
      .upsert({ id, data: fee, updated_at: nowIso }, { onConflict: 'id' })
    if (error) { skipped.push({ email, reason: error.message }); continue }
    written.push({ email, company: company?.businessName ?? null, amount })
  }

  return res.status(200).json({
    ok: true,
    period,
    written: written.length,
    unmatched,           // emails with no matching member — reconcile these manually
    skipped: skipped.length,
    skippedDetail: skipped,
    totalAud: Math.round(written.reduce((s, w) => s + w.amount, 0) * 100) / 100,
  })
}
