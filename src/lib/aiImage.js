// Client helpers — AI image generation + saving the result to Sanity.

export async function generateImage(prompt, size = '1536x1024') {
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Image generation failed')
  return data.b64 // base64 PNG (no data: prefix)
}

// Push a generated base64 image to Sanity's asset store (reuses /api/sanity-upload).
export async function saveImageToSanity(b64, filename = 'ai-image.png') {
  const res = await fetch('/api/sanity-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: b64, contentType: 'image/png', filename }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Upload failed')
  return data // { assetId, url }
}
