// Who a member contacts when the Wi-Fi is down — stored beside the network
// details in settings.wifi (supportName / supportPhone / supportEmail /
// supportHours), edited under Settings → Wi-Fi. Shown wherever the Wi-Fi
// details are: the app and portal Guides, the getting-started and invite
// emails. Returns null until at least a phone or email is set, so nothing
// half-filled is ever shown.

export function wifiSupport(wifi) {
  const clean = (v) => String(v ?? '').trim()
  const s = {
    name: clean(wifi?.supportName),
    phone: clean(wifi?.supportPhone),
    email: clean(wifi?.supportEmail),
    hours: clean(wifi?.supportHours),
  }
  return s.phone || s.email ? s : null
}

/** tel: link for a typed phone number (spaces/brackets stripped). */
export const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** The support line for an email, as an HTML fragment ('' when not set). */
export function wifiSupportHtml(wifi, { color = '#3a3a3a', font = 'inherit' } = {}) {
  const s = wifiSupport(wifi)
  if (!s) return ''
  const reach = [
    s.phone && `<a href="${esc(telHref(s.phone))}" style="color:${color}">${esc(s.phone)}</a>`,
    s.email && `<a href="mailto:${esc(s.email)}" style="color:${color}">${esc(s.email)}</a>`,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ')
  return `<p style="font-family:${font};font-size:12px;color:${color};line-height:1.6;margin:8px 0 0">Wi-Fi not working? Contact ${s.name ? `<strong>${esc(s.name)}</strong> — ` : ''}${reach}${s.hours ? ` (${esc(s.hours)})` : ''}</p>`
}
