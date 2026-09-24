// Assistant tasks — the admin to-do list behind /assistant.
//
// A task is a small, durable "ticket": one thing an admin has to do, with the
// portal page it gets done on. Tasks come from two places — typed in by hand,
// or transcribed by the assistant out of a rough brain-dump or out of the live
// portal state (overdue invoices, expiring contracts, unanswered requests).
// The shape is deliberately flat so the AI can emit it straight from a tool
// call and the store can write it to Supabase (tasks-schema.sql) unchanged.

import { differenceInDays, parseISO } from 'date-fns'
import { calcAmountDue } from './billing.js'
import { melbourneToday, pendingStudioRequests } from './studio.js'
import { moveOutDate } from './officeAvailability.js'

export const PRIORITIES = ['low', 'normal', 'high', 'urgent']

export const PRIORITY_STYLE = {
  low:    { label: 'Low',    cls: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', cls: 'bg-blue-100 text-blue-700' },
  high:   { label: 'High',   cls: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 font-semibold' },
}

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 }

// Categories double as the board's filter chips. Keep this list short — a long
// taxonomy just makes the AI hesitate between near-identical buckets.
export const CATEGORIES = [
  'billing', 'contracts', 'members', 'facilities', 'bookings', 'growth', 'admin',
]

// Portal routes a task may deep-link to. Allow-listed on purpose: the link is
// written by the model, and an unvalidated one would send a click anywhere.
export const TASK_LINKS = [
  { to: '/billing',           label: 'Billing' },
  { to: '/leases',            label: 'Contracts' },
  { to: '/renewals',          label: 'Renewals' },
  { to: '/companies',         label: 'Companies' },
  { to: '/members',           label: 'Members' },
  { to: '/memberships',       label: 'Memberships' },
  { to: '/fees',              label: 'Fees' },
  { to: '/fobs',              label: 'Fobs & Remotes' },
  { to: '/spaces',            label: 'Spaces' },
  { to: '/pricing-requests',  label: 'Pricing Requests' },
  { to: '/maintenance',       label: 'Maintenance' },
  { to: '/bookings',          label: 'Bookings' },
  { to: '/calendar',          label: 'Calendar' },
  { to: '/studio-requests',   label: 'Studio Requests' },
  { to: '/function-bookings', label: 'Function Bookings' },
  { to: '/event-bookings',    label: 'Event Bookings' },
  { to: '/events',            label: 'Events' },
  { to: '/crm',               label: 'CRM' },
  { to: '/marketing',         label: 'Marketing' },
  { to: '/messages',          label: 'Messages' },
  { to: '/announcements',     label: 'Announcements' },
  { to: '/mail',              label: 'Mail & Deliveries' },
  { to: '/directory',         label: 'Directory' },
  { to: '/food-orders',       label: 'Food Orders' },
  { to: '/contacts',          label: 'Contacts' },
  { to: '/reports',           label: 'Reports' },
  { to: '/templates',         label: 'Templates' },
  { to: '/training',          label: 'Training' },
  { to: '/settings',          label: 'Settings' },
]

const LINK_SET = new Set(TASK_LINKS.map((l) => l.to))

/** The allow-listed route, or '' — never trust a link straight from the model. */
export function safeLink(link) {
  const base = String(link ?? '').split('?')[0].replace(/\/+$/, '') || '/'
  return LINK_SET.has(base) ? base : ''
}

export function linkLabel(link) {
  return TASK_LINKS.find((l) => l.to === safeLink(link))?.label ?? ''
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Fill in a partial task (from the AI or the manual form) to the full shape. */
export function newTask(partial = {}, { createdBy = '' } = {}) {
  const priority = PRIORITIES.includes(partial.priority) ? partial.priority : 'normal'
  const category = CATEGORIES.includes(partial.category) ? partial.category : 'admin'
  return {
    id: partial.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: String(partial.title ?? '').trim().slice(0, 160),
    detail: String(partial.detail ?? '').trim().slice(0, 1200),
    priority,
    category,
    dueDate: ISO_DATE.test(partial.dueDate ?? '') ? partial.dueDate : '',
    link: safeLink(partial.link),
    source: partial.source === 'assistant' ? 'assistant' : 'manual',
    sourceNote: String(partial.sourceNote ?? '').trim().slice(0, 600),
    status: partial.status === 'done' ? 'done' : 'open',
    createdAt: partial.createdAt || new Date().toISOString(),
    createdBy,
    completedAt: partial.completedAt || '',
    completedBy: partial.completedBy || '',
  }
}

/** Overdue first, then by due date, then by priority, then newest. */
export function sortTasks(tasks = [], today = melbourneToday()) {
  const overdue = (t) => Boolean(t.dueDate && t.dueDate < today)
  return [...tasks].sort((a, b) => {
    if (overdue(a) !== overdue(b)) return overdue(a) ? -1 : 1
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }
    const p = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2)
    if (p) return p
    return String(b.createdAt).localeCompare(String(a.createdAt))
  })
}

/** Completed most-recently-first. */
export function sortDone(tasks = []) {
  return [...tasks].sort((a, b) =>
    String(b.completedAt || b.createdAt).localeCompare(String(a.completedAt || a.createdAt)))
}

// ── Briefing ─────────────────────────────────────────────────────────────────
// The snapshot of "what's outstanding in the portal right now" that goes to the
// assistant with every message. It is deliberately COMPACT — names, numbers and
// counts, no full records — so a long chat stays cheap and the model can't
// wander into member data it has no reason to see. Lists are capped; the count
// beside each one tells the model how much it isn't seeing.

const CAP = 12

const daysFrom = (dateStr, today) => {
  try { return differenceInDays(parseISO(dateStr), parseISO(today)) } catch { return null }
}

export function buildBriefing(store = {}, today = melbourneToday()) {
  const {
    invoices = [], leases = [], tenants = [], spaces = [], maintenance = [],
    bookings = [], pricingRequests = [], leads = [], tasks = [], members = [],
  } = store

  const company = (id) => tenants.find((t) => t.id === id)?.businessName ?? 'Unknown company'
  const active = leases.filter((l) => l.status === 'active')

  const overdue = invoices
    .filter((i) => i.status === 'overdue')
    .map((i) => ({
      number: i.number,
      company: company(i.tenantId),
      due: i.dueDate,
      daysOverdue: i.dueDate ? -(daysFrom(i.dueDate, today) ?? 0) : null,
      amountDue: Math.round(calcAmountDue(i)),
    }))
    .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))

  const unsent = invoices.filter((i) =>
    i.status !== 'voided' && i.status !== 'paid' && i.sentStatus !== 'sent')

  const expiring = active
    .filter((l) => !l.noticeGiven && !l.terminationScheduledFor && !l.vacateDate && !l.renewalDeclined && l.endDate)
    .map((l) => ({ lease: l, days: daysFrom(l.endDate, today) }))
    .filter((x) => x.days !== null && x.days >= 0 && x.days <= 60)
    .sort((a, b) => a.days - b.days)
    .map(({ lease: l, days }) => ({
      company: company(l.tenantId),
      endDate: l.endDate,
      daysLeft: days,
      monthlyRent: Number(l.monthlyRent ?? 0),
    }))

  const pendingRenewal = active
    .filter((l) => l.pendingRenewalApproval)
    .map((l) => ({ company: company(l.tenantId), newEndDate: l.endDate }))

  const awaitingCountersign = leases
    .filter((l) => l.signatureStatus === 'out_for_signature' && l.tenantSignedAt)
    .map((l) => ({ company: company(l.tenantId), signedAt: String(l.tenantSignedAt).slice(0, 10) }))

  const movingOut = active
    .map((l) => ({ lease: l, out: moveOutDate(l) }))
    .filter((x) => x.out && (daysFrom(x.out, today) ?? 999) >= 0 && (daysFrom(x.out, today) ?? 999) <= 60)
    .map(({ lease: l, out }) => ({
      company: company(l.tenantId),
      movesOut: out,
      space: spaces.find((s) => s.id === l.spaceId)?.unitNumber ?? '',
    }))

  const openIssues = maintenance
    .filter((m) => m.status !== 'resolved')
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2))
    .map((m) => ({
      title: m.title,
      priority: m.priority,
      space: spaces.find((s) => s.id === m.spaceId)?.unitNumber ?? '',
      reported: m.reportedDate ?? '',
      assignee: m.assignee ?? '',
    }))

  const studio = pendingStudioRequests(bookings, spaces).map((b) => ({
    date: b.date,
    time: b.startTime ?? '',
    requestedBy: b.studio?.contact?.name ?? members.find((m) => m.id === b.memberId)?.name ?? '',
    company: b.companyId ? company(b.companyId) : '',
    requestedAt: String(b.studio?.requestedAt ?? b.createdAt ?? '').slice(0, 10),
  }))

  const pricing = pricingRequests
    .filter((r) => r.status === 'pending')
    .map((r) => ({ space: spaces.find((s) => s.id === r.spaceId)?.unitNumber ?? '', proposed: r.proposedRate ?? r.rate ?? null }))

  const unreadLeads = leads.filter((l) => !l.read)
  const vacant = spaces.filter((s) => s.status === 'vacant')

  const openTasks = tasks.filter((t) => t.status !== 'done')

  return {
    today,
    // Tasks already on the board — so the assistant adds what's missing instead
    // of re-raising the same ticket every time you open the chat.
    openTasks: sortTasks(openTasks, today).slice(0, 40).map((t) => ({
      id: t.id, title: t.title, priority: t.priority, category: t.category, dueDate: t.dueDate,
    })),
    openTaskCount: openTasks.length,
    doneLast7Days: tasks.filter((t) =>
      t.status === 'done' && t.completedAt && (daysFrom(String(t.completedAt).slice(0, 10), today) ?? -99) >= -7).length,
    money: {
      overdueCount: overdue.length,
      overdueTotal: Math.round(overdue.reduce((s, i) => s + i.amountDue, 0)),
      overdueInvoices: overdue.slice(0, CAP),
      unsentInvoiceCount: unsent.length,
      unsentInvoices: unsent.slice(0, CAP).map((i) => ({ number: i.number, company: company(i.tenantId), issued: i.issueDate })),
    },
    contracts: {
      activeCount: active.length,
      expiringCount: expiring.length,
      expiringSoon: expiring.slice(0, CAP),
      pendingRenewalApproval: pendingRenewal.slice(0, CAP),
      awaitingCountersign: awaitingCountersign.slice(0, CAP),
      movingOutSoon: movingOut.slice(0, CAP),
    },
    facilities: {
      openIssueCount: openIssues.length,
      openIssues: openIssues.slice(0, CAP),
      vacantSpaceCount: vacant.length,
      vacantSpaces: vacant.slice(0, CAP).map((s) => ({ unit: s.unitNumber, type: s.type, rate: s.monthlyRate })),
    },
    requests: {
      pendingStudioCount: studio.length,
      pendingStudio: studio.slice(0, CAP),
      pendingPricingCount: pricing.length,
      pendingPricing: pricing.slice(0, CAP),
    },
    growth: {
      unreadEnquiryCount: unreadLeads.length,
      unreadEnquiries: unreadLeads.slice(0, CAP).map((l) => ({
        name: l.name ?? '', business: l.businessName ?? '', source: l.source ?? '', received: l.createdAt ?? '',
      })),
    },
  }
}
