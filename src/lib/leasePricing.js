// Contract step pricing — the ONE place a step's discount is applied.
//
// A pricing step stores `listPrice` (RRP) and `discount` (a label like '10%').
// Everything that turns a step into money — the payment schedule (and therefore
// the bill run), the licence-agreement document, the contract detail view and
// the saved lease.monthlyRent — must charge the DISCOUNTED amount, not list.

export function discountPct(discount) {
  const n = Number(String(discount ?? '').replace('%', '').trim())
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 0
}

export function discountedPrice(listPrice, discount) {
  const lp = Number(listPrice ?? 0)
  return Math.round(lp * (1 - discountPct(discount) / 100) * 100) / 100
}

// A step's effective monthly charge (list × qty, less its discount).
export function stepMonthly(step) {
  const gross = Number(step?.listPrice ?? 0) * Number(step?.qty ?? 1)
  return Math.round(gross * (1 - discountPct(step?.discount) / 100) * 100) / 100
}
