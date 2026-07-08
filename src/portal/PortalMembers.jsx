import { useState, useMemo, useEffect } from 'react'
import { authHeaders } from '../lib/apiFetch.js'
import { Search, Mail, Building2, UserPlus, Check } from 'lucide-react'
import { Page, PageHeader, Card, SubTabs, Monogram, Empty } from './ui.jsx'

export default function PortalMembers({ members, companies, company }) {
  const [tab, setTab] = useState('members')
  const [q, setQ] = useState('')

  // Community directory — every ACTIVE company + member across Hexa Space,
  // from the sanitized member-authed endpoint (RLS scopes direct table reads
  // to the member's own company, so the props only cover their own team).
  const [directory, setDirectory] = useState(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/portal/directory', { headers: await authHeaders() })
        const d = res.ok ? await res.json() : null
        if (alive && d?.companies) setDirectory(d)
      } catch { /* fall back to scoped props */ }
    })()
    return () => { alive = false }
  }, [])
  const allMembers = directory?.members ?? members ?? []
  const allCompanies = directory?.companies ?? companies ?? []

  // ── Your team (invite teammates) ──
  const team = useMemo(() => (members || []).filter((m) => company?.id && m.companyId === company.id && m.status !== 'archived'), [members, company])
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ name: '', email: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  async function sendInvite(e) {
    e.preventDefault()
    if (!invite.name.trim() || !invite.email.trim()) { setInviteMsg('Enter a name and email.'); return }
    setInviting(true); setInviteMsg('')
    try {
      const res = await fetch('/api/portal/add-teammate', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ companyId: company.id, name: invite.name.trim(), email: invite.email.trim() }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not invite')
      setInviteMsg(`Invite sent to ${invite.email.trim()} ✓`); setInvite({ name: '', email: '' }); setShowInvite(false)
    } catch (err) { setInviteMsg(err.message) } finally { setInviting(false) }
  }

  const visibleMembers = useMemo(() => {
    const term = q.trim().toLowerCase()
    return [...allMembers]
      .filter(m => !['archived', 'Former'].includes(m.status))
      .filter(m => !term || `${m.name} ${m.email} ${m.companyName || ''}`.toLowerCase().includes(term))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [allMembers, q])

  const visibleCompanies = useMemo(() => {
    const term = q.trim().toLowerCase()
    return [...allCompanies]
      .filter(c => !term || `${c.businessName} ${c.industry || ''}`.toLowerCase().includes(term))
      .sort((a, b) => (a.businessName || '').localeCompare(b.businessName || ''))
  }, [allCompanies, q])

  const nameFor = (id) => allCompanies.find(c => c.id === id)?.businessName

  return (
    <Page>
      <PageHeader kicker="Community" title="Members">
        The people and companies who call Hexa Space home.
      </PageHeader>

      {/* Your team */}
      {company?.id && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-heading uppercase tracking-nav text-[12px] text-ink">Your team · {company.businessName}</div>
              <p className="hx-prose text-[13px] mt-1">Add teammates — they'll get portal access to book rooms and see your company.</p>
            </div>
            <button onClick={() => { setShowInvite((v) => !v); setInviteMsg('') }} className="hx-btn inline-flex items-center gap-2 whitespace-nowrap"><UserPlus size={14} /> Invite teammate</button>
          </div>
          {showInvite && (
            <form onSubmit={sendInvite} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end border-t border-ink/10 pt-4">
              <div><label className="hx-eyebrow block mb-1.5">Name</label><input className="hx-input" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="Full name" /></div>
              <div><label className="hx-eyebrow block mb-1.5">Email</label><input type="email" className="hx-input" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@company.com" /></div>
              <button type="submit" disabled={inviting} className="hx-btn disabled:opacity-50">{inviting ? 'Sending…' : 'Send invite'}</button>
            </form>
          )}
          {inviteMsg && <p className={`mt-3 hx-prose text-[13px] ${inviteMsg.includes('✓') ? 'text-hexa-green' : 'text-red-700'}`}>{inviteMsg}</p>}
          {team.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {team.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-2 border border-ink/10 bg-bone px-3 py-1.5">
                  <span className="hx-prose text-[13px] text-ink">{m.name}</span>
                  {m.portalAccess && <Check size={12} className="text-hexa-green" />}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <SubTabs
          tabs={[
            { key: 'members', label: `Members · ${visibleMembers.length}` },
            { key: 'companies', label: `Companies · ${visibleCompanies.length}` },
          ]}
          active={tab}
          onChange={setTab}
        />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-portal-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="hx-input pl-9 w-64"
          />
        </div>
      </div>

      {tab === 'members' ? (
        visibleMembers.length === 0 ? <Empty label="No members found." /> : (
          <div className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMembers.map(m => (
              <Card key={m.id} className="p-6 flex gap-4 hover:bg-bone transition-colors">
                <Monogram name={m.name} className="h-14 w-14 shrink-0" />
                <div className="min-w-0">
                  <div className="font-heading uppercase tracking-nav text-[12px] text-ink truncate">{m.name}</div>
                  {(m.companyName || nameFor(m.companyId)) && (
                    <div className="hx-prose text-[13px] truncate">{m.companyName || nameFor(m.companyId)}</div>
                  )}
                  {m.bio && <p className="hx-prose text-[13px] mt-2 line-clamp-2">{m.bio}</p>}
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 mt-3 text-hexa-green hover:text-ink transition-colors">
                      <Mail size={13} />
                      <span className="font-heading uppercase tracking-nav text-[10px]">Contact</span>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        visibleCompanies.length === 0 ? <Empty label="No companies found." /> : (
          <div className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCompanies.map(c => (
              <Card key={c.id} className="p-6 flex gap-4 hover:bg-bone transition-colors">
                <Monogram name={c.businessName} className="h-14 w-14 shrink-0" />
                <div className="min-w-0">
                  <div className="font-heading uppercase tracking-nav text-[12px] text-ink truncate">{c.businessName}</div>
                  {c.industry && (
                    <div className="inline-flex items-center gap-1.5 hx-prose text-[13px] mt-1">
                      <Building2 size={12} /> {c.industry}
                    </div>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 mt-3 text-hexa-green hover:text-ink transition-colors">
                      <Mail size={13} />
                      <span className="font-heading uppercase tracking-nav text-[10px]">Contact</span>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </Page>
  )
}
