import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { unreadDmCount } from './memberMessages.js'
import { configureFunctionPricing } from '../../lib/functionBooking.js'

// Loads the member's world for the mobile app. Mirrors PortalApp.jsx fetchData
// (which stays untouched — the app is a separate experience): same tables, same
// member/company resolution, same tenant-scoped JSONB fetches for the big
// tables. Adds mail_items (Home badge + Mail screen) and the global settings
// doc (branded emails, Stripe gate, food ordering config).
export function useMemberData(email) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const loadedFor = useRef(null)

  const load = useCallback(async (force = false) => {
    if (!email) return
    if (!force && loadedFor.current === email) return
    loadedFor.current = email
    setLoading(true)
    try {
      const tables = ['tenants', 'members', 'spaces', 'bookings', 'fees']
      const [results, settings] = await Promise.all([
        Promise.all(tables.map((t) => supabase.from(t).select('data'))),
        // Public settings subset via endpoint — the settings row itself is
        // admin/service-role only and not readable by members after cutover.
        fetch('/api/portal/settings').then((r) => r.json()).then((d) => d.settings ?? {}).catch(() => ({})),
      ])
      configureFunctionPricing(settings.functionSpace)
      const [companies, members, spaces, bookings, fees] =
        results.map((r) => (r.data ?? []).map((row) => row.data))

      const lc = email.toLowerCase()
      const member = members.find((m) => m.email?.toLowerCase() === lc) ?? null
      const company =
        (member && companies.find((c) => c.id === member.companyId)) ??
        companies.find((c) => c.email?.toLowerCase() === lc) ??
        null
      const cid = company?.id

      // Tenant-scoped fetches (JSONB filter → immune to the 1000-row cap).
      const [invRes, leaseRes, mailRes] = cid
        ? await Promise.all([
            supabase.from('invoices').select('data').eq('data->>tenantId', cid),
            supabase.from('leases').select('data').eq('data->>tenantId', cid),
            supabase.from('mail_items').select('data').eq('data->>companyId', cid),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }]
      const invoices = (invRes.data ?? []).map((r) => r.data)
      const leases = (leaseRes.data ?? []).map((r) => r.data)
      const mailItems = (mailRes.data ?? []).map((r) => r.data).filter(Boolean)

      const mine = (rows) => rows.filter((r) =>
        r.tenantId === cid || r.companyId === cid || (member && r.memberId === member.id))

      // Cross-company availability via the sanitized view (no title/company/member);
      // own bookings keep full detail. Robust pre- and post-cutover (see PortalApp).
      const ownBookings = cid ? mine(bookings) : (member ? bookings.filter((b) => b.memberId === member.id) : [])
      const ownIds = new Set(ownBookings.map((b) => b.id))
      const availRes = await supabase.from('booking_availability').select('*')
      const slots = (availRes.data ?? [])
        .filter((s) => !ownIds.has(s.id))
        .map((s) => ({ id: s.id, resourceId: s.resource_id, date: s.date, startTime: s.start_time, endTime: s.end_time, status: s.status }))

      // Unread member-to-member DMs (participant-scoped; 0 if the table isn't set
      // up yet). Drives the notification bell + Members badge.
      const dmUnread = member ? await unreadDmCount(lc) : 0

      setData({
        company, member, members, companies, spaces, fees, settings,
        leases, invoices, mailItems, dmUnread,
        bookings: ownBookings,
        allBookings: [...ownBookings, ...slots], // own (detailed) + others (masked)
      })
    } catch (err) {
      console.error('App fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }, [email])

  useEffect(() => { load() }, [load])

  // Optimistic local patch so screens update without a full refetch.
  const patch = useCallback((fn) => setData((prev) => (prev ? fn(prev) : prev)), [])

  return { data, loading, refresh: () => load(true), patch }
}
