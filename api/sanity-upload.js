// Vercel serverless function — POST /api/sanity-upload
// Uploads a base64 image to the website's Sanity asset store and returns the
// asset id + CDN url. The client resizes/compresses before sending so the
// request stays under Vercel's body limit.
// Requires env var: SANITY_WRITE_TOKEN.
//
// Body: { data: <base64 (no data: prefix)>, contentType: 'image/jpeg', filename? }
// Returns: { assetId, url }

const PROJECT_ID = 'w4zxsbqi'
const DATASET = 'production'
const API_VER = 'v2021-06-07'

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.SANITY_WRITE_TOKEN
  if (!token) return res.status(500).json({ error: 'SANITY_WRITE_TOKEN not configured' })

  const { data, contentType = 'image/jpeg', filename = 'photo.jpg' } = req.body ?? {}
  if (!data) return res.status(400).json({ error: 'Missing image data' })

  try {
    const buffer = Buffer.from(data, 'base64')
    const url = `https://${PROJECT_ID}.api.sanity.io/${API_VER}/assets/images/${DATASET}?filename=${encodeURIComponent(filename)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: buffer,
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('Sanity asset upload error:', json)
      return res.status(response.status).json({ error: json?.error?.description ?? json?.message ?? 'Upload failed' })
    }
    return res.status(200).json({ assetId: json.document._id, url: json.document.url })
  } catch (err) {
    console.error('sanity-upload error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
