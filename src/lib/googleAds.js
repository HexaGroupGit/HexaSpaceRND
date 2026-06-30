// Client helpers for the Google Ads integration.

export async function googleAdsStatus() {
  try {
    const res = await fetch('/api/google-ads/status')
    if (!res.ok) return { connected: false, configured: false }
    return res.json()
  } catch {
    return { connected: false, configured: false }
  }
}

// Full-page redirect into the Google consent screen.
export function connectGoogleAds() {
  window.location.href = '/api/google-ads/connect'
}

export async function pushToGoogleAds(body) {
  const res = await fetch('/api/google-ads/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Push failed')
  return data
}

export async function googleAdsReport(body) {
  const res = await fetch('/api/google-ads/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Report failed')
  return data // { reportType, dateRange, rows }
}
