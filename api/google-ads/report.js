// POST /api/google-ads/report — runs a predefined GAQL report against a Google
// Ads account (read-only) and returns normalized metric rows. The foundation
// the negatives / recommendations / KPI / attribution modules read from.
//
// Requires env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
//   GOOGLE_ADS_DEVELOPER_TOKEN, SUPABASE_SERVICE_ROLE_KEY,
//   optional GOOGLE_ADS_API_VERSION (default v18).
//
// Body: { reportType, customerId, loginCustomerId?, dateRange? }
//   reportType: 'campaigns' | 'ad_groups' | 'keywords' | 'search_terms'
//   dateRange:  'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_MONTH' (default LAST_30_DAYS)

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v18'
const GA = `https://googleads.googleapis.com/${API_VERSION}`

const digits = (s) => String(s ?? '').replace(/\D/g, '')
const n = (v) => Number(v || 0)
const round = (v, dp = 2) => { const m = 10 ** dp; return Math.round(v * m) / m }
const DATE_RANGES = ['LAST_7_DAYS', 'LAST_14_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH']

const metrics = (m = {}) => ({
  impressions: n(m.impressions),
  clicks: n(m.clicks),
  ctr: round(n(m.ctr) * 100, 2),
  avgCpc: round(n(m.averageCpc) / 1e6, 2),
  cost: round(n(m.costMicros) / 1e6, 2),
  conversions: round(n(m.conversions), 1),
  costPerConv: round(n(m.costPerConversion) / 1e6, 2),
})

const REPORTS = {
  campaigns: {
    select: 'campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions, metrics.cost_per_conversion',
    from: 'campaign',
    order: 'metrics.cost_micros DESC',
    row: (r) => ({ name: r.campaign?.name, status: r.campaign?.status, ...metrics(r.metrics) }),
  },
  ad_groups: {
    select: 'ad_group.name, campaign.name, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions, metrics.cost_per_conversion',
    from: 'ad_group',
    order: 'metrics.cost_micros DESC',
    row: (r) => ({ name: r.adGroup?.name, campaign: r.campaign?.name, ...metrics(r.metrics) }),
  },
  keywords: {
    select: 'ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions, metrics.cost_per_conversion',
    from: 'keyword_view',
    order: 'metrics.cost_micros DESC',
    row: (r) => ({ name: r.adGroupCriterion?.keyword?.text, matchType: r.adGroupCriterion?.keyword?.matchType, ...metrics(r.metrics) }),
  },
  search_terms: {
    select: 'search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, metrics.conversions',
    from: 'search_term_view',
    order: 'metrics.clicks DESC',
    row: (r) => ({ name: r.searchTermView?.searchTerm, ...metrics(r.metrics) }),
  },
}

async function getAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'Could not refresh Google token')
  return data.access_token
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Admin-only: reads Google Ads metrics for a customerId via Hexa's token.
  const { requireAdmin } = await import('../_auth.js')
  const _a = await requireAdmin(req)
  if (_a.error) return res.status(_a.status).json({ error: _a.error })

  const { reportType, customerId, loginCustomerId, dateRange = 'LAST_30_DAYS' } = req.body ?? {}
  const report = REPORTS[reportType]
  if (!report) return res.status(400).json({ error: 'Invalid reportType' })
  if (!customerId) return res.status(400).json({ error: 'Missing customerId' })
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return res.status(500).json({ error: 'GOOGLE_ADS_DEVELOPER_TOKEN not configured' })
  const range = DATE_RANGES.includes(dateRange) ? dateRange : 'LAST_30_DAYS'

  try {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    const { data: metaRows } = await supabase.from('meta').select('value').eq('key', 'google_ads_refresh_token')
    const refreshToken = metaRows?.[0]?.value
    if (!refreshToken) return res.status(400).json({ error: 'Google Ads not connected' })

    const accessToken = await getAccessToken(refreshToken)
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'Content-Type': 'application/json',
    }
    if (loginCustomerId) headers['login-customer-id'] = digits(loginCustomerId)

    const query = `SELECT ${report.select} FROM ${report.from} WHERE segments.date DURING ${range} ORDER BY ${report.order}`
    const gaRes = await fetch(`${GA}/customers/${digits(customerId)}/googleAds:search`, {
      method: 'POST', headers, body: JSON.stringify({ query, pageSize: 200 }),
    })
    const data = await gaRes.json()
    if (!gaRes.ok) {
      const msg = data?.error?.message || data?.error?.details?.[0]?.errors?.[0]?.message || JSON.stringify(data?.error ?? data)
      return res.status(gaRes.status).json({ error: `Google Ads: ${msg}` })
    }
    const rows = (data.results ?? []).map(report.row)
    return res.status(200).json({ reportType, dateRange: range, rows })
  } catch (err) {
    console.error('google-ads report error:', err)
    return res.status(500).json({ error: err.message ?? 'Report failed' })
  }
}
