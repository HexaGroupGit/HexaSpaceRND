// Paid-media calculators (ported from the claude-ads /ads math rubric).
// All pure functions — no network. Inputs are plain numbers.

export function computeAdsMath({
  monthlyBudget = 0,
  cpc = 3.5,            // avg cost per click ($)
  ctr = 2,             // click-through rate (%) — informational
  convRate = 4,        // landing → lead conversion rate (%)
  closeRate = 20,      // lead → signed lease (%)
  leaseValue = 0,      // monthly rent of the unit ($) = value of one win
  leaseMonths = 12,    // contract length, for LTV
}) {
  const budget = num(monthlyBudget)
  const _cpc = Math.max(num(cpc), 0.01)
  const clicks = budget / _cpc
  const leads = clicks * (num(convRate) / 100)
  const wins = leads * (num(closeRate) / 100)
  const cpl = leads > 0 ? budget / leads : 0           // cost per lead
  const cpa = wins > 0 ? budget / wins : 0             // cost per acquisition (signed lease)
  const ltv = num(leaseValue) * num(leaseMonths)
  const revenue = wins * ltv
  const roas = budget > 0 ? revenue / budget : 0
  const ltvCac = cpa > 0 ? ltv / cpa : 0
  // Break-even: spend at which one win pays back the full LTV
  const breakEvenWins = ltv > 0 ? budget / ltv : 0

  return {
    clicks: round(clicks),
    leads: round(leads, 1),
    wins: round(wins, 1),
    cpl: round(cpl, 2),
    cpa: round(cpa, 2),
    ltv: round(ltv, 0),
    revenue: round(revenue, 0),
    roas: round(roas, 2),
    ltvCac: round(ltvCac, 1),
    breakEvenWins: round(breakEvenWins, 2),
  }
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function round(v, dp = 0) { const m = 10 ** dp; return Math.round(v * m) / m }
