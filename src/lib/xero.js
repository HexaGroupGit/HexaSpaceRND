import { authHeaders } from './apiFetch.js'
// Client helpers for the Xero integration.

export async function xeroStatus() {
  try {
    const res = await fetch('/api/xero/status')
    if (!res.ok) return { connected: false, configured: false }
    return res.json()
  } catch {
    return { connected: false, configured: false }
  }
}

// Full-page redirect into the Xero consent screen.
export function connectXero() {
  window.location.href = '/api/xero/connect'
}

export async function disconnectXero() {
  const res = await fetch('/api/xero/disconnect', { method: 'POST', headers: await authHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Disconnect failed')
  return data
}

// action: 'push' | 'pull'; dryRun previews without writing anywhere.
export async function xeroSync(action, { dryRun = false } = {}) {
  const res = await fetch('/api/xero/sync', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action, dryRun }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Sync failed')
  return data
}
