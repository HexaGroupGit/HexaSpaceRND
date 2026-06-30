const PROJECT_ID = 'w4zxsbqi'
const DATASET    = 'production'
const API_VER    = '2021-06-07'

const BASE = `https://${PROJECT_ID}.api.sanity.io/v${API_VER}/data/query/${DATASET}`

export function sanityImageUrl(asset, width = 900) {
  if (!asset?._ref) return null
  const clean = asset._ref
    .replace(/^image-/, '')
    .replace(/-(\w+)$/, '.$1')
  return `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${clean}?w=${width}&auto=format&fit=crop`
}

// Convert Sanity Portable Text blocks to plain text
export function ptToText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter(b => b._type === 'block')
    .map(b => (b.children ?? []).map(c => c.text ?? '').join(''))
    .filter(t => t.trim())
    .join(' ')
    .trim()
}

// ── Listing sync (App → Sanity) ───────────────────────────────────────────────
// Pushes a space to the website's `unit` doc via the /api/sanity-sync serverless
// function (which holds the write token). Fire-and-forget friendly: callers can
// .catch() to avoid blocking the UI.

async function listingSync(action, space) {
  const res = await fetch('/api/sanity-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, space }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Listing sync failed')
  }
  return res.json()
}

// Create/refresh the unit on the website (status mirrors space.status:
// vacant→available, occupied→leased, reserved→under-offer).
export function publishListing(space) {
  return listingSync('sync', space)
}

// Hard-remove the unit document from the website.
export function deleteListing(space) {
  return listingSync('delete', space)
}

// Resize/compress an image File in the browser, then upload it to Sanity via
// /api/sanity-upload. Returns { assetId, url } to store on space.photos.
export async function uploadListingImage(file, maxDim = 1600, quality = 0.82) {
  const base64 = await resizeToBase64(file, maxDim, quality)
  const res = await fetch('/api/sanity-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64, contentType: 'image/jpeg', filename: file.name ?? 'photo.jpg' }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Image upload failed')
  }
  return res.json()
}

function resizeToBase64(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => { img.src = reader.result }
    img.onerror = reject
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl.split(',')[1]) // strip the data: prefix
    }
    reader.readAsDataURL(file)
  })
}

export async function fetchSanityEvents() {
  const query = encodeURIComponent(
    '*[_type == "event"] | order(date asc) {_id, title, date, endDate, summary, tagline, location, locationAddress, slug, coverImage, rsvpEnabled, rsvpClosingDate}'
  )
  try {
    const res = await fetch(`${BASE}?query=${query}`)
    if (!res.ok) return []
    const { result } = await res.json()
    return (result ?? []).map(e => ({
      id: e._id,
      title: e.title,
      slug: e.slug?.current ?? null,
      date: e.date ? e.date.split('T')[0] : null,
      startsAt: e.date ?? null,
      endsAt: e.endDate ?? null,
      endDate: e.endDate,
      time: e.date ? new Date(e.date).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }) : null,
      location: [e.location, e.locationAddress].filter(Boolean).join(' — '),
      description: e.summary ?? e.tagline ?? '',
      imageUrl: sanityImageUrl(e.coverImage?.asset ? e.coverImage : null),
      link: e.slug?.current ? `https://www.hexahub.com.au/events/${e.slug.current}` : 'https://www.hexahub.com.au/events',
      rsvpEnabled: e.rsvpEnabled,
      source: 'sanity',
    }))
  } catch {
    return []
  }
}
