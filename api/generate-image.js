// Vercel serverless function — POST /api/generate-image
// Generates a marketing image via OpenAI gpt-image-1 and returns base64 PNG.
// Requires env var: OPENAI_API_KEY.
//
// Body: { prompt: string, size?: '1024x1024' | '1536x1024' | '1024x1536' }

const ALLOWED_SIZES = ['1024x1024', '1536x1024', '1024x1536']

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  const { prompt, size = '1536x1024' } = req.body ?? {}
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Missing prompt' })
  const imageSize = ALLOWED_SIZES.includes(size) ? size : '1536x1024'

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: imageSize, n: 1 }),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error('OpenAI image error:', data)
      return res.status(response.status).json({ error: data?.error?.message ?? 'Image generation failed' })
    }
    const b64 = data?.data?.[0]?.b64_json
    if (!b64) return res.status(502).json({ error: 'No image returned' })
    return res.status(200).json({ b64 })
  } catch (err) {
    console.error('generate-image error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
