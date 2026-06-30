// Client helper — read a PDF file, send to /api/parse-pricelist, return units.

export async function parsePriceList(file) {
  const base64 = await fileToBase64(file)
  const res = await fetch('/api/parse-pricelist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64 }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Parse failed')
  return data.units ?? []
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(String(reader.result).split(',')[1]) // strip data: prefix
    reader.readAsDataURL(file)
  })
}
