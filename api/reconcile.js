// GET/POST /api/reconcile — daily lifecycle housekeeping (Vercel cron, ~6:30am
// Melbourne). The admin app only reconciles state when someone loads it; this
// cron closes the gaps in between:
//
//   1. Commencement flips — a paid-up (gate-met) contract whose start date has
//      arrived flips its space reserved → occupied.
//   2. Onboarding catch-up — gate-met leases never onboarded (e.g. the deposit
//      was marked paid via Stripe webhook or Xero pull while no admin had the
//      app open) get the welcome email + portal invite. Salto is skipped
//      entirely (not configured).
//   3. Vacate-date expiry — active leases whose served notice's vacateDate has
//      passed are set to expired with needsOffboard: true; the admin app runs
//      the full offboarding cascade (free spaces, parking, bond refund) on next
//      load. The flag keeps legacy ended leases out of the cascade.
//   4. Bond-refund SLA — approved refunds older than 45 days with no payout
//      recorded are flagged (T&C promises refund within 60 days).
//
// ?dryRun=1 reports what WOULD happen without writing or emailing anything.
// One admin digest email is sent when anything was done or found.

import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from './_email.js'
import { brandFrame, bKicker, bH1, bH2, bPanel, bBtn, SANS, INK, MUTE } from './_brand.js'
import {
  requiresAccessGate, accessGateMet, shouldOnboard, requiresCardOnFile,
  renderOnboardingTemplate, resolveOnboardingCopy, onboardingEmailHtml,
} from '../src/lib/onboarding.js'
import { invitePortalUser } from './_invite.js'

const SUPABASE_URL = process.env.SUPABASE_URL

function pickPrimaryContact(tenant, members) {
  const mine = (members ?? []).filter((m) => m.companyId === tenant?.id)
  return mine.find((m) => m.contactPerson) ?? mine.find((m) => m.billingPerson) ?? mine[0] ?? null
}

async function loadTable(supabase, table) {
  const { data, error } = await supabase.from(table).select('id, data')
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []).map((r) => ({ ...r.data, id: r.data?.id ?? r.id }))
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  // Cron or verified admin only — mutates lease/space state + sends onboarding.
  const { requireCronOrAdmin } = await import('./_auth.js')
  const _g = await requireCronOrAdmin(req)
  if (!_g.ok) return res.status(_g.status).json({ error: _g.error })

  const dryRun = req.query?.dryRun === '1' || req.body?.dryRun === true

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set.' })
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const resendKey = process.env.RESEND_API_KEY

  const saveRow = async (table, id, data) => {
    if (dryRun) return
    const { error } = await supabase.from(table).upsert({ id, data, updated_at: new Date().toISOString() })
    if (error) throw new Error(`${table}/${id}: ${error.message}`)
  }

  try {
    const [leases, invoices, spaces, tenants, members, settRows, tmplRows] = await Promise.all([
      loadTable(supabase, 'leases'),
      loadTable(supabase, 'invoices'),
      loadTable(supabase, 'spaces'),
      loadTable(supabase, 'tenants'),
      loadTable(supabase, 'members'),
      supabase.from('settings').select('data').eq('id', 'global').single(),
      supabase.from('templates').select('data'),
    ])
    const settings = settRows?.data?.data ?? {}
    const templates = (tmplRows?.data ?? []).map((r) => r.data)

    const today = new Date()
    const todayISO = today.toISOString().split('T')[0]
    const out = { occupied: [], onboarded: [], onboardedSuppressed: [], expired: [], bondOverdue: [], errors: [] }

    // ── 1. Commencement flips (reserved → occupied only; never demote) ──────
    const flippedLeaseIds = new Set()
    for (const lease of leases) {
      if (lease.status !== 'active') continue
      if (!requiresAccessGate(lease) || !accessGateMet(lease, invoices, tenants.find((t) => t.id === lease.tenantId))) continue
      if (lease.startDate && lease.startDate > todayISO) continue
      const space = spaces.find((s) => s.id === lease.spaceId)
      if (!space || space.status !== 'reserved') continue
      if (space.occupantTenantId && space.occupantTenantId !== lease.tenantId) continue
      try {
        await saveRow('spaces', space.id, { ...space, status: 'occupied' })
        space.status = 'occupied'
        flippedLeaseIds.add(lease.id)
        out.occupied.push(`${space.unitNumber ?? space.id} → occupied (${lease.contractNumber ?? lease.id})`)
      } catch (e) { out.errors.push(e.message) }
    }

    // ── 2. Onboarding catch-up (gate met, never onboarded) ──────────────────
    for (const lease of leases) {
      const tenant = tenants.find((t) => t.id === lease.tenantId)
      if (!shouldOnboard(lease, invoices, tenant)) continue
      const space = spaces.find((s) => s.id === lease.spaceId)
      const label = `${tenant?.businessName ?? lease.tenantId} (${lease.contractNumber ?? lease.id})`
      try {
        // Mirror the in-app rule: a space that was ALREADY occupied before the
        // gate cleared means the tenant moved in long ago — stamp, don't email.
        // (Freshly cron-flipped spaces in step 1 record their leases in
        // out.occupied, so they still onboard normally below.)
        if (space?.status === 'occupied' && !flippedLeaseIds.has(lease.id)) {
          await saveRow('leases', lease.id, { ...lease, onboardedAt: lease.activatedAt ?? new Date().toISOString() })
          out.onboardedSuppressed.push(label)
          continue
        }
        const primary = pickPrimaryContact(tenant, members)
        const email = primary?.email || tenant?.email
        if (!email) continue // retries daily until a contact email exists

        if (!dryRun) {
          // Stamp first so a crash can't double-send tomorrow.
          await saveRow('leases', lease.id, { ...lease, onboardedAt: new Date().toISOString(), activatedAt: lease.activatedAt ?? new Date().toISOString() })

          // Welcome email — editable template first, built-in fallback. No Salto.
          if (resendKey) {
            const onbTpl = templates.find((t) => t.category === 'email' && t.emailType === 'onboarding' && t.content)
            const rendered = onbTpl
              ? renderOnboardingTemplate({ template: onbTpl, lease, tenant, space, settings, saltoLink: null })
              : { subject: resolveOnboardingCopy({ lease, tenant, space, settings }).subject, html: onboardingEmailHtml({ lease, tenant, space, settings, saltoLink: null }) }
            await sendResendEmail({
              from: 'Hexa Space <info@hexaspace.com.au>',
              to: [email], subject: rendered.subject, html: rendered.html,
            }).catch((e) => out.errors.push(`onboarding email ${label}: ${e.message}`))
          }

          // Portal invite (Supabase auth user + set-password email)
          const inv = await invitePortalUser({ email })
          if (!inv.ok) out.errors.push(`portal invite ${label}: ${inv.error}`)
          else if (primary) await saveRow('members', primary.id, { ...primary, portalAccess: true })
        }
        out.onboarded.push(`${label} → ${email}`)
      } catch (e) { out.errors.push(`onboard ${label}: ${e.message}`) }
    }

    // ── 2b. Card-on-file chaser ──────────────────────────────────────────────
    // Card-required memberships (VO/desk) whose client has SIGNED but never
    // completed the Stripe card step: onboarding is held (see accessGateMet),
    // so chase them — first nudge 24h after signing, then every 2 days, up to
    // 5 reminders. The link re-opens their signing page, which shows the
    // "verify your payment card" step until a card is on file.
    out.cardReminders = []
    const H24 = 24 * 3600 * 1000
    for (const lease of leases) {
      if (!requiresCardOnFile(lease)) continue
      if (['expired', 'cancelled', 'terminated'].includes(String(lease.status))) continue
      const signedAt = lease.tenantSignedAt || lease.signedAt
      const hasSigned = signedAt || ['e_signed', 'manually_signed'].includes(String(lease.signatureStatus))
      if (!hasSigned) continue
      const tenant = tenants.find((t) => t.id === lease.tenantId)
      if (!tenant || tenant.stripePaymentMethodId) continue
      if (!lease.eSignMemberLink) continue // no signing page to send them back to
      if (signedAt && Date.now() - new Date(signedAt).getTime() < H24) continue
      if (lease.cardReminderAt && Date.now() - new Date(lease.cardReminderAt).getTime() < 2 * H24) continue
      if ((lease.cardRemindersSent ?? 0) >= 5) continue

      const primary = pickPrimaryContact(tenant, members)
      const email = tenant.email || primary?.email
      const label = `${tenant.businessName ?? lease.tenantId} (${lease.contractNumber ?? lease.id})`
      if (!email) continue
      try {
        if (!dryRun) {
          await saveRow('leases', lease.id, {
            ...lease,
            cardReminderAt: new Date().toISOString(),
            cardRemindersSent: (lease.cardRemindersSent ?? 0) + 1,
          })
          if (resendKey) {
            const inner =
              bKicker('One Step Left') +
              bH1('Register your payment card 💳') +
              `<p style="font-family:${SANS};font-size:14px;line-height:1.7;color:${MUTE};margin:0 0 12px">Hi ${tenant.contactName ?? primary?.name ?? 'there'}, thanks for signing <strong style="color:${INK}">${lease.contractNumber ?? 'your agreement'}</strong>. As set out in its payment authority, your membership needs a payment card securely on file with Stripe before we can complete your onboarding — it's only ever charged for amounts owing under the agreement (e.g. overdue invoices).</p>` +
              bBtn('Verify your card — takes a minute', lease.eSignMemberLink) +
              `<p style="font-family:${SANS};font-size:12px;color:${MUTE};margin:14px 0 0">Card details are held by Stripe — Hexa Space never sees the number. Your access and welcome pack follow as soon as it's done.</p>`
            await sendResendEmail({
              from: 'Hexa Space <info@hexaspace.com.au>',
              to: [email],
              subject: `One step left — register your card for ${lease.contractNumber ?? 'your membership'}`,
              html: brandFrame(inner, { footerLabel: 'Memberships' }),
            }).catch((e) => out.errors.push(`card reminder ${label}: ${e.message}`))
          }
        }
        out.cardReminders.push(`${label} → ${email} (#${(lease.cardRemindersSent ?? 0) + 1})`)
      } catch (e) { out.errors.push(`card reminder ${label}: ${e.message}`) }
    }

    // ── 3. Vacate-date expiry (notice served, date passed) ──────────────────
    for (const lease of leases) {
      if (lease.status !== 'active' || !lease.noticeGiven || !lease.vacateDate) continue
      if (lease.vacateDate > todayISO) continue
      try {
        await saveRow('leases', lease.id, { ...lease, status: 'expired', needsOffboard: true })
        const tenant = tenants.find((t) => t.id === lease.tenantId)
        out.expired.push(`${tenant?.businessName ?? lease.tenantId} (${lease.contractNumber ?? lease.id}) — vacate date ${lease.vacateDate}`)
      } catch (e) { out.errors.push(e.message) }
    }

    // ── 4. Bond-refund SLA (approved > 45 days, no payout recorded) ─────────
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 45)
    for (const inv of invoices) {
      if (inv.invoiceType !== 'bond_refund' || inv.approvalStatus !== 'approved') continue
      if (inv.status === 'paid' || inv.refundedAt) continue
      if (!inv.approvedAt || new Date(inv.approvedAt) > cutoff) continue
      const tenant = tenants.find((t) => t.id === inv.tenantId)
      out.bondOverdue.push(`${inv.number ?? inv.id} — ${tenant?.businessName ?? inv.tenantId} (approved ${String(inv.approvedAt).split('T')[0]}; T&C promises refund within 60 days)`)
    }

    // ── 5. Salto access sweep (safety net) ──────────────────────────────────
    // The offboard cascade fires revoke zaps from the ADMIN APP; if nobody
    // opened it (or a zap call failed silently), an ex-member keeps door
    // access. This sweep catches stragglers server-side: any member still
    // flagged saltoAccess whose company holds no live contract — or who is
    // Former/archived — gets the remove_user zap re-fired and the flag
    // cleared. With no webhook configured they're listed for manual removal.
    out.saltoSwept = []
    const liveCompanyIds = new Set(
      leases.filter((l) => ['active', 'pending'].includes(String(l.status))).map((l) => l.tenantId)
    )
    const revokeHook = process.env.SALTO_REVOKE_WEBHOOK
    for (const m of members) {
      if (m.saltoAccess !== true) continue
      const memberGone = ['Former', 'archived'].includes(String(m.status))
      const companyGone = !m.companyId || !liveCompanyIds.has(m.companyId)
      if (!memberGone && !companyGone) continue
      const label = `${m.name ?? m.email ?? m.id} (${tenants.find((t) => t.id === m.companyId)?.businessName ?? 'no company'}) — ${memberGone ? 'member removed' : 'no live contract'}`
      if (!revokeHook) { out.saltoSwept.push(`${label} — NO WEBHOOK, remove manually in KS`); continue }
      try {
        if (!dryRun) {
          const r = await fetch(revokeHook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove_user', email: m.email ?? null, saltoUserId: m.saltoUserId ?? null, source: 'hexaspace-platform-sweep' }),
          })
          if (!r.ok) throw new Error(`revoke hook ${r.status}`)
          await saveRow('members', m.id, { ...m, saltoAccess: false, saltoSweptAt: new Date().toISOString() })
        }
        out.saltoSwept.push(label)
      } catch (e) { out.errors.push(`salto sweep ${label}: ${e.message}`) }
    }

    // ── Admin digest (only when something happened or needs attention) ──────
    const anything = out.occupied.length + out.onboarded.length + out.expired.length + out.bondOverdue.length + out.saltoSwept.length + (out.cardReminders?.length ?? 0) + out.errors.length > 0
    if (anything && resendKey && !dryRun) {
      const list = (items) => bPanel(items.map((i) => `<div style="font-family:${SANS};font-size:13px;color:${INK};padding:4px 0">${i}</div>`).join(''))
      const section = (title, items) => items.length ? bH2(title) + list(items) : ''
      const inner =
        bKicker('Daily Reconcile') +
        bH1(todayISO) +
        section(`✓ ${out.occupied.length} space(s) flipped to occupied`, out.occupied) +
        section(`✓ ${out.onboarded.length} member(s) onboarded`, out.onboarded) +
        section(`— ${out.onboardedSuppressed.length} onboarding(s) suppressed (already moved in)`, out.onboardedSuppressed) +
        section(`⚠ ${out.expired.length} lease(s) expired on served notice`, out.expired) +
        section(`⚠ ${out.bondOverdue.length} bond refund(s) overdue`, out.bondOverdue) +
        section(`🔑 ${out.saltoSwept.length} door access revocation(s) swept`, out.saltoSwept) +
        section(`💳 ${(out.cardReminders ?? []).length} card-on-file reminder(s) sent`, out.cardReminders ?? []) +
        section(`✗ ${out.errors.length} error(s)`, out.errors) +
        bBtn('Open the admin portal', 'https://portal.hexaspace.com.au')
      const adminTo = [...new Set(['info@hexaspace.com.au', settings?.emails?.notificationEmail].filter(Boolean).map((e) => e.toLowerCase()))]
      await sendResendEmail({
        from: 'Hexa Space <info@hexaspace.com.au>',
        to: adminTo,
        subject: `Daily reconcile — ${todayISO}`,
        html: brandFrame(inner, { footerLabel: 'Operations' }),
      }).catch(() => {})
    }

    return res.status(200).json({ dryRun, date: todayISO, ...out })
  } catch (err) {
    console.error('reconcile error:', err)
    return res.status(500).json({ error: err.message })
  }
}
