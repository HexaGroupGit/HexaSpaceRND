// Client helpers — call the /api/ads-generate serverless function.

async function adsGenerate(body) {
  const res = await fetch('/api/ads-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Generation failed')
  }
  return res.json()
}

export async function generateAdResearch(payload) {
  const { text } = await adsGenerate({ ...payload, action: 'research' })
  return text
}

export async function generateAdCampaign(payload) {
  const { campaign } = await adsGenerate({ ...payload, action: 'campaign' })
  return campaign
}

export async function generateKeywords(payload) {
  const { keywords } = await adsGenerate({ ...payload, action: 'keywords' })
  return keywords
}
