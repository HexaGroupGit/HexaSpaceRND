// Pricing approval — staff propose a rent for a space, a manager signs it off.
//
// WHY: front-of-house staff quote offices, but a discount off the list rate is a
// commercial decision. A request captures what's being offered and why; a
// manager records an explicit decision WITH reasoning, so months later you can
// see who approved a rate and on what basis.

/** Managers who may approve. Overridable via Settings → pricingApproval.managers. */
export const PRICING_MANAGERS = [
  'eric@hexaspace.com.au',
  'jzrealestate@outlook.com',
  'william@hexa.com.au',
]

/** Decisions needed before a request counts as approved. */
export const APPROVALS_REQUIRED = 1

export const STATUSES = ['pending', 'approved', 'declined', 'withdrawn']

const norm = (e) => String(e ?? '').trim().toLowerCase()
const same = (a, b) => !!norm(a) && norm(a) === norm(b)

export function managerList(settings) {
  const custom = settings?.pricingApproval?.managers
  return (Array.isArray(custom) && custom.length ? custom : PRICING_MANAGERS).map(norm)
}

export function isPricingManager(email, settings) {
  return managerList(settings).includes(norm(email))
}

export function approvalsRequired(settings) {
  const n = Number(settings?.pricingApproval?.approvalsRequired)
  return Number.isFinite(n) && n > 0 ? n : APPROVALS_REQUIRED
}

export const decisionsFor = (req) => req?.decisions ?? []
export const approvalsOf = (req) => decisionsFor(req).filter((d) => d.decision === 'approved')
export const declinesOf = (req) => decisionsFor(req).filter((d) => d.decision === 'declined')

/** Has this request cleared the bar? */
export function isApproved(req, settings) {
  return approvalsOf(req).length >= approvalsRequired(settings)
}

/**
 * May `email` record a decision on `req`? Returns { ok, why }.
 * A requester can never approve their own request even if they are a manager —
 * the whole point of the gate is a second pair of eyes.
 */
export function canDecide(req, email, settings) {
  if (!req) return { ok: false, why: 'No request selected.' }
  if (req.status !== 'pending') return { ok: false, why: `This request is already ${req.status}.` }
  if (!isPricingManager(email, settings)) return { ok: false, why: 'Only a pricing manager can approve or decline.' }
  if (same(req.requestedBy, email)) return { ok: false, why: 'You raised this request — it needs a different manager to sign off.' }
  if (decisionsFor(req).some((d) => same(d.by, email))) return { ok: false, why: 'You have already recorded a decision on this request.' }
  return { ok: true, why: '' }
}

/** Discount the proposal represents against the list rate, as a percentage. */
export function discountPct(req) {
  const list = Number(req?.listRent ?? 0)
  const proposed = Number(req?.proposedRent ?? 0)
  if (!list || proposed >= list) return 0
  return Math.round(((list - proposed) / list) * 1000) / 10
}

/** Total value given away over the term (discount + rent-free months), ex GST. */
export function concessionValue(req) {
  const list = Number(req?.listRent ?? 0)
  const proposed = Number(req?.proposedRent ?? 0)
  const months = Number(req?.termMonths ?? 0)
  const free = Number(req?.rentFreeMonths ?? 0)
  if (!months) return 0
  const payable = Math.max(0, months - free)
  const full = list * months
  const actual = proposed * payable
  return Math.round((full - actual) * 100) / 100
}

/** Applying a decision to a request — pure, so the caller just persists it. */
export function applyDecision(req, { decision, by, reasoning, settings }) {
  const entry = { decision, by: norm(by), reasoning: String(reasoning ?? '').trim(), at: new Date().toISOString() }
  const decisions = [...decisionsFor(req), entry]
  const next = { ...req, decisions, updatedAt: entry.at }
  if (decision === 'declined') {
    next.status = 'declined'
    next.closedAt = entry.at
  } else if (approvalsOf(next).length >= approvalsRequired(settings)) {
    next.status = 'approved'
    next.approvedAt = entry.at
    next.approvedBy = entry.by
    next.closedAt = entry.at
  }
  return next
}

/** Shown to the approver next to the decision box — the "what to check" guide. */
export const APPROVER_GUIDE = [
  'Does the proposed rate hold up against the list rate and what comparable spaces in the building are actually paying?',
  'Is the term long enough to justify the concession? A discount on a short term costs more per month than it looks.',
  'Are the rent-free months modelled as a rentFreeMonths count — never as a $0 rent, which never expires and rolls into the renewal.',
  'Does the total concession value below look right for the covenant of this client?',
  'If you are declining, say what rate or term WOULD be acceptable, so the request can come back once rather than three times.',
]

/** Guidance shown to staff on the request form. */
export const REQUESTER_GUIDE = [
  'Quote the list rate first — only raise a request if the client needs something below it.',
  'Enter rent ex GST, per month, the same basis as a contract.',
  'Say what you are trying to win: competing offer, term length, expansion, a space that has sat vacant.',
  'A manager other than you must approve. You will see their reasoning here once they do.',
]
