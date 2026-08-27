// Vercel serverless — POST /api/book-tour
// Public endpoint for the "Book a private tour" page. Creates (or updates an
// existing) lead in the CRM with source 'book-tour', which also stops the
// nurture sequence. Requires SUPABASE_SERVICE_ROLE_KEY; RESEND_API_KEY optional.
//
// A website tour is a REQUEST, not a booking. The visitor picks a preferred day
// and time; the lead lands with tourStatus 'pending' and staff confirm it from
// the lead (Confirm & send invite → TourBookingModal), which is what stamps
// 'confirmed' and sends the real calendar invitation.
//
// Why pending matters: tourStatus === 'confirmed' is what puts a tour on the
// admin Calendar, into the CRM upcoming-tours count and onto the lead card. A
// website booking used to skip straight to booked without anyone agreeing to
// the time, and two visitors could pick the same slot.
import { createClient } from '@supabase/supabase-js'
import { LEAD_NOTIFY, fillVars, findEmailTemplate, sendResend } from './_leads.js'
import { sendResendEmail } from './_email.js'
import { brandFrame, bH2, bP, bTable, bSmall } from './_brand.js'

const SUPABASE_URL = process.env.SUPABASE_URL

// How quickly we promise to come back to them. Used in the copy, everywhere.
const CONFIRM_SLA = '1 business day'

// Tour requests land in their own pipeline stage so staff have one place to
// look. Created on first use if it isn't there yet. Mirrors the stage the
// marketing site used to create for itself before it forwarded here.
const TOUR_STAGE = {
  id: 'stage_tour_booked',
  name: 'Tour Booked',
  tone: 'orange',
  sortOrder: 2, // New(0) · Contacted(1) · Tour Booked(2) · Won(3) · Lost(4)
  category: 'in-progress',
}

async function ensureTourStage(supabase, stages) {
  if (stages.some((s) => s?.id === TOUR_STAGE.id)) return TOUR_STAGE.id
  try {
    await supabase.from('lead_pipeline_stages').upsert({
      id: TOUR_STAGE.id, data: TOUR_STAGE, updated_at: new Date().toISOString(),
    })
    return TOUR_STAGE.id
  } catch (e) {
    console.error('tour stage ensure failed (falling back to New):', e)
    return null
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, phone, businessName, enquiryType, preferredDate, preferredTime, message, website } = req.body ?? {}
  if (website) return res.status(200).json({ success: true }) // honeypot
  if (!email && !phone) return res.status(400).json({ error: 'Email or phone required' })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(500).json({ error: 'Not configured' })
  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  try {
    const [{ data: stageRows }, { data: leadRows }] = await Promise.all([
      supabase.from('lead_pipeline_stages').select('data'),
      supabase.from('leads').select('id, data'),
    ])
    const stages = (stageRows ?? []).map((r) => r.data)
    const newStage = stages.find((s) => s.category === 'new')
    const tourStageId = (await ensureTourStage(supabase, stages)) ?? newStage?.id ?? 'stage_new'
    const now = new Date().toISOString()
    const today = now.split('T')[0]
    const tourNote = `Tour requested${preferredDate ? ` for ${preferredDate}${preferredTime ? ` ${preferredTime}` : ''}` : ''}${message ? ` — ${message}` : ''} — awaiting confirmation`

    // Update an existing lead with the same email (so we don't duplicate and the
    // nurture flow stops), otherwise create a fresh one.
    const existing = email ? (leadRows ?? []).find((r) => (r.data?.email || '').toLowerCase() === email.toLowerCase()) : null

    // Double-submit guard. The endpoint is public and unauthenticated, so a
    // double-clicked button (or someone leaning on it) would otherwise re-notify
    // the whole leasing team every time. Same address inside the window = treat
    // it as the same request and do nothing, reporting success so the visitor
    // still sees their confirmation screen.
    const REPEAT_WINDOW_MS = 5 * 60 * 1000
    const lastAsk = Date.parse(existing?.data?.tourRequestedAt ?? '')
    if (existing && !Number.isNaN(lastAsk) && Date.now() - lastAsk < REPEAT_WINDOW_MS) {
      return res.status(200).json({ success: true, duplicate: true })
    }

    let id, lead
    if (existing) {
      id = existing.id
      lead = {
        ...existing.data,
        phone: existing.data.phone || phone || '',
        businessName: existing.data.businessName || businessName || '',
        enquiryType: enquiryType || existing.data.enquiryType || null,
        source: 'book-tour',
        // Their PREFERRED time, not an agreed one — staff confirm from the lead.
        // Never downgrade a tour already confirmed: a second form submission
        // must not silently un-confirm a booked inspection.
        tourStatus: existing.data.tourStatus === 'confirmed' ? 'confirmed' : 'pending',
        stageId: existing.data.tourStatus === 'confirmed' ? existing.data.stageId : tourStageId,
        tourRequestedAt: now,
        tourDate: preferredDate || existing.data.tourDate || '',
        tourTime: preferredTime || existing.data.tourTime || '',
        notes: [existing.data.notes, tourNote].filter(Boolean).join('\n'),
        read: false,
        nurture: { ...(existing.data.nurture || {}), done: true, lastAt: today },
      }
    } else {
      id = `lead${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      lead = {
        id, name: name ?? '', businessName: businessName ?? '', email: email ?? '', phone: phone ?? '',
        spaceId: '', source: 'book-tour', stageId: tourStageId, value: 0,
        notes: tourNote, tenantId: null, type: 'enquiry', read: false,
        enquiryType: enquiryType ?? null, tourStatus: 'pending', tourRequestedAt: now,
        tourDate: preferredDate ?? '', tourTime: preferredTime ?? '',
        createdAt: today, stageEnteredAt: today,
        nurture: { step: 99, done: true, lastAt: today }, // booked → no nurture
      }
    }

    const { error } = await supabase.from('leads').upsert({ id, data: lead, updated_at: now })
    if (error) { console.error('book-tour insert error:', error); return res.status(500).json({ error: 'Could not save request' }) }

    // Awaited — Vercel kills unawaited sends once the response goes out.
    const sends = await Promise.allSettled([
      notifyAdmin(supabase, lead),
      sendTourAcknowledgement(supabase, lead),
    ])
    sends.forEach((r) => { if (r.status === 'rejected') console.error('book-tour email:', r.reason) })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('book-tour error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function notifyAdmin(supabase, lead) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return
  const { data: settRows } = await supabase.from('settings').select('data').eq('id', 'global')
  const settings = settRows?.[0]?.data ?? {}
  const to = [...new Set([...LEAD_NOTIFY, settings?.emails?.notificationEmail].filter(Boolean).map((e) => e.toLowerCase()))]
  if (!to.length) return
  const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
  const fromEmail = settings?.emails?.fromEmail || 'noreply@hexaspace.com.au'
  const html = brandFrame(
    bH2('Tour request — needs confirming 🗓️') +
    bTable([
      ['Name', `${lead.name || '—'}${lead.businessName ? ` (${lead.businessName})` : ''}`],
      ['Email', lead.email || '—'],
      ['Phone', lead.phone || '—'],
      ['Interested in', lead.enquiryType || '—'],
      ['Preferred', `${lead.tourDate || '—'} ${lead.tourTime || ''}`],
    ]) +
    bP('This is the time they <strong>asked for</strong> — nothing is confirmed yet and they have been told we will come back within ' + CONFIRM_SLA + '.') +
    bSmall('Open the lead in Leads &amp; Enquiries → Tour and hit <strong>Confirm &amp; send invite</strong> — that is what sends the calendar invitation and puts the tour on the admin calendar. Their requested time comes through pre-filled, so change it there if the slot does not work.'),
    { footerLabel: 'Book a Tour' }
  )
  const when = [lead.tourDate, lead.tourTime].filter(Boolean).join(' ')
  await sendResendEmail({
    from: `${fromName} <${fromEmail}>`,
    to,
    replyTo: lead.email || undefined,
    subject: `Tour request — ${lead.name || lead.email}${when ? ` (${when})` : ''}`,
    html,
  })
}

// Acknowledgement to the enquirer. Deliberately NOT a confirmation: they have
// asked for a time, and staff still have to agree to it. Uses the editable
// "tour_request_received" template when one exists, otherwise the inline copy
// below, so this works on a fresh install with no templates set up.
async function sendTourAcknowledgement(supabase, lead) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey || !lead.email) return
  const [{ data: settRows }, { data: tmplRows }] = await Promise.all([
    supabase.from('settings').select('data').eq('id', 'global'),
    supabase.from('templates').select('data'),
  ])
  const settings = settRows?.[0]?.data ?? {}
  const templates = (tmplRows ?? []).map((r) => r.data)
  const fromName = settings?.emails?.fromName || settings?.company?.name || 'Hexa Space'
  const fromEmail = settings?.emails?.fromEmail || 'noreply@hexaspace.com.au'
  const replyTo = settings?.emails?.replyTo || settings?.emails?.notificationEmail
  const company = settings?.company?.name || 'Hexa Space'
  const website = settings?.company?.website || 'hexaspace.com.au'

  const requested = lead.tourDate
    ? `${lead.tourDate}${lead.tourTime ? ` at ${lead.tourTime}` : ''}`
    : ''
  const firstName = String(lead.name || '').trim().split(/\s+/)[0] || 'there'
  const vars = {
    company, website, name: lead.name || 'there', firstName,
    requested, tourDate: lead.tourDate || '', tourTime: lead.tourTime || '',
    confirmSla: CONFIRM_SLA,
  }

  const tpl = findEmailTemplate(templates, 'tour_request_received')
  if (tpl) {
    await sendResend(resendKey, {
      fromName, fromEmail, to: lead.email,
      subject: fillVars(tpl.subject, vars), html: fillVars(tpl.content, vars), replyTo,
    })
    return
  }

  const html = brandFrame(
    bH2('Thanks — we have your tour request') +
    bP(`Hi ${firstName},`) +
    bP(`Thanks for asking to come and see the space${requested ? `. You asked for <strong>${requested}</strong>` : ''}. We will check that against the team's diary and confirm by email within <strong>${CONFIRM_SLA}</strong>.`) +
    bP('Once it is confirmed you will get a calendar invitation with the address, how to find us on the day, and where to park — so there is nothing else you need to do right now.') +
    bSmall(`If your plans change, just reply to this email and we will sort out another time. — ${company}`),
    { footerLabel: 'Book a Tour' },
  )
  await sendResendEmail({
    from: `${fromName} <${fromEmail}>`,
    to: [lead.email],
    replyTo,
    subject: `We have your tour request${requested ? ` — ${requested}` : ''}`,
    html,
  })
}
