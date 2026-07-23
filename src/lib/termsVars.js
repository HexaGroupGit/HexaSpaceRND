// Placeholder substitution for contract T&C / House Rules content.
// Currently one variable: {{cpiPct}} — the renewal/CPI increase percentage
// from Settings → Billing Rules (renewalCpiPct, default 4 to match the
// long-standing clause 7(j) wording). Keeping the number in ONE place means
// the licence agreement text and the renewal-contract price bump can never
// drift apart. Applied at every render site: admin preview + PDF
// (ContractDetail), and the public e-sign page (filled server-side in
// api/sign/load.js).
export const renewalCpiPct = (settings) => {
  const n = Number(settings?.billingRules?.renewalCpiPct)
  return Number.isFinite(n) && n >= 0 ? n : 4
}

export function fillTermsVars(html, settings) {
  return String(html ?? '').replaceAll('{{cpiPct}}', String(renewalCpiPct(settings)))
}
