// Crypto-strength URL-safe token for public links (proposals, e-sign).
// Never falls back to guessable values like ids + timestamps.
export function randomToken() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
