import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useApp } from '../context.js'
import { Screen, BackHeader, Label, EmptyNote } from '../ui.jsx'

// Members directory — the Hexa Space community, grouped by company.
export default function Members() {
  const { data } = useApp()
  const { members, companies } = data
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const active = (companies ?? [])
      .filter((c) => c.businessName)
      .sort((a, b) => (a.businessName || '').localeCompare(b.businessName || ''))
    return active
      .map((c) => {
        const people = (members ?? []).filter((m) => m.companyId === c.id && m.portalAccess !== false)
        return { company: c, people }
      })
      .filter(({ company, people }) => {
        if (people.length === 0) return false
        if (!needle) return true
        return company.businessName.toLowerCase().includes(needle) ||
          people.some((p) => (p.name || '').toLowerCase().includes(needle))
      })
  }, [members, companies, q])

  return (
    <Screen>
      <BackHeader title="Members" fallback="/more" />
      <p className="font-display font-extralight text-[28px] leading-tight text-ink mt-2 mb-6">
        The Hexa Space<br />community.
      </p>

      <label className="flex items-center gap-3 border border-ink/15 bg-paper px-4 min-h-[48px] mb-8">
        <Search size={15} className="text-portal-muted shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members or companies"
          className="flex-1 bg-transparent font-body text-[14px] text-ink outline-none placeholder:text-portal-muted" />
      </label>

      {groups.length === 0 ? (
        <EmptyNote label="No members found." sub={q ? 'Try a different search.' : 'The directory is filling up.'} />
      ) : (
        groups.map(({ company, people }) => (
          <section key={company.id} className="mb-7">
            <Label className="mb-2">{company.businessName}</Label>
            <div className="divide-y divide-ink/5 border-y border-ink/10">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-4 py-3.5">
                  <span className="h-10 w-10 shrink-0 bg-stone text-ink/50 font-heading tracking-label text-[11px] flex items-center justify-center">
                    {(p.name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-[14px] text-ink truncate">{p.name}</span>
                    {p.email && <span className="block hx-prose text-[12px] truncate">{p.email}</span>}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </Screen>
  )
}
