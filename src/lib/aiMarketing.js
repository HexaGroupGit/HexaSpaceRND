// Client helper — calls the /api/marketing-generate serverless function.

export async function generateMarketing(payload) {
  const res = await fetch('/api/marketing-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Generation failed')
  }
  const { text } = await res.json()
  return text
}
