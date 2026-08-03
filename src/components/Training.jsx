import { useState, useMemo, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { format, parseISO, differenceInDays } from 'date-fns'
import { Search, ArrowLeft, Pencil, PencilLine, Check, AlertTriangle, FileText, ExternalLink, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getSession } from '../lib/auth.js'
import RichTextEditor from './RichTextEditor.jsx'

// Training — the SOP library. Content is seeded from docs/sops/**.md by
// scripts/seed-sops.mjs; it can also be edited in place here. Acknowledgements
// are version-stamped, so republishing an SOP re-opens everyone's sign-off
// rather than leaving a stale one in place.

const CATEGORY_ORDER = [
  'start-here', 'operations', 'companies-members', 'contracts', 'billing',
  'spaces-access', 'bookings', 'front-of-house', 'growth', 'system-administration',
]
const CATEGORY_LABEL = {
  'start-here': 'Start here',
  operations: 'Running the space',
  'companies-members': 'Companies & members',
  contracts: 'Contracts',
  billing: 'Billing',
  'spaces-access': 'Spaces & access',
  bookings: 'Bookings',
  'front-of-house': 'Front of house',
  growth: 'Growth',
  'system-administration': 'System administration',
}
const catLabel = (c) => CATEGORY_LABEL[c] ?? c
const catRank = (c) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? 99 : i }

const REVIEW_WARN_DAYS = 60

export default function Training() {
  const { sops = [], updateSop } = useOutletContext()
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [me, setMe] = useState('')
  const [acks, setAcks] = useState([])

  useEffect(() => { getSession().then((s) => setMe((s?.user?.email ?? '').toLowerCase())) }, [])
  useEffect(() => { loadAcks() }, [])
  async function loadAcks() {
    const { data } = await supabase.from('sop_acks').select('data')
    setAcks((data ?? []).map((r) => r.data).filter(Boolean))
  }

  const counts = useMemo(() => {
    const c = {}
    for (const s of sops) c[s.category] = (c[s.category] ?? 0) + 1
    return c
  }, [sops])

  const categories = useMemo(
    () => [...new Set(sops.map((s) => s.category))].sort((a, b) => catRank(a) - catRank(b)),
    [sops],
  )

  const q = search.trim().toLowerCase()
  const rows = useMemo(() => sops
    .filter((s) => (category === 'all' || s.category === category))
    .filter((s) => !q || `${s.title} ${s.slug} ${s.searchText ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => catRank(a.category) - catRank(b.category) || (a.title || '').localeCompare(b.title || '')),
  [sops, category, q])

  const open = sops.find((s) => s.id === openId) ?? null

  // Acknowledged by ME, at the SOP's CURRENT version.
  const ackedByMe = (sop) => acks.some((a) =>
    a.sopId === sop.id && Number(a.version) === Number(sop.version ?? 1) &&
    String(a.personEmail ?? '').toLowerCase() === me)
  const ackCount = (sop) => acks.filter((a) =>
    a.sopId === sop.id && Number(a.version) === Number(sop.version ?? 1)).length

  const reviewState = (sop) => {
    if (!sop.reviewDue) return null
    const days = differenceInDays(parseISO(sop.reviewDue), new Date())
    if (days < 0) return { label: 'Review overdue', cls: 'bg-red-100 text-red-700' }
    if (days <= REVIEW_WARN_DAYS) return { label: `Review in ${days}d`, cls: 'bg-amber-100 text-amber-700' }
    return null
  }

  async function acknowledge(sop) {
    if (!me) { alert('Could not identify you — reload and try again.'); return }
    const version = Number(sop.version ?? 1)
    const id = `${sop.id}:${me}:${version}`
    const row = {
      id,
      data: { id, sopId: sop.id, sopSlug: sop.slug, version, personEmail: me, ackedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('sop_acks').upsert(row)
    if (error) { alert(`Could not record that: ${error.message}`); return }
    setAcks((prev) => [...prev.filter((a) => a.id !== id), row.data])
  }

  function startEdit() { setDraft(open?.content ?? ''); setEditing(true) }
  function saveEdit() {
    // A content change is a new version — that re-opens everyone's acknowledgement.
    updateSop(open.id, {
      content: draft,
      searchText: draft.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(),
      version: Number(open.version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    })
    setEditing(false)
  }

  // ── Reader ────────────────────────────────────────────────────────────────
  if (open) {
    const review = reviewState(open)
    const acked = ackedByMe(open)
    return (
      <div className="p-8 max-w-4xl">
        <button
          onClick={() => { setOpenId(null); setEditing(false) }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={15} /> Training
        </button>

        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-2xl font-bold text-foreground">{open.title}</h1>
          {!editing && (
            <button
              onClick={startEdit}
              className="shrink-0 flex items-center gap-1.5 text-xs border border-input rounded px-3 py-1.5 hover:bg-muted/50 text-foreground"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5 text-xs">
          <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{catLabel(open.category)}</span>
          <span className="text-muted-foreground">v{open.version ?? 1}</span>
          {open.route && (
            <a href={open.route} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
              <ExternalLink size={11} /> {open.route}
            </a>
          )}
          {(open.audience ?? []).map((a) => (
            <span key={a} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 capitalize">{a}</span>
          ))}
          {review && <span className={`px-2 py-0.5 rounded font-semibold ${review.cls}`}>{review.label}</span>}
          {open.hasTodo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
              <AlertTriangle size={11} /> Unverified step
            </span>
          )}
          {open.needsInput && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
              <PencilLine size={11} /> {open.openGaps || ''} needs input
            </span>
          )}
        </div>

        {open.needsInput && !editing && (
          <div className="mb-5 border border-blue-200 bg-blue-50 rounded-md px-4 py-3 text-sm text-blue-900">
            This procedure is scaffolded but not finished. The bits only you can answer — equipment
            models, timings, contacts — are marked <strong>NEEDS INPUT</strong> below. Fill them in with
            <strong> Edit</strong>, or in <code className="text-[11px]">{open.sourceFile}</code> and re-seed.
          </div>
        )}

        {open.hasTodo && !editing && (
          <div className="mb-5 border border-amber-200 bg-amber-50 rounded-md px-4 py-3 text-sm text-amber-900">
            This procedure contains a step that could not be confirmed against the system. It is marked
            <strong> TODO(verify)</strong> in the text below — check with Eric before relying on that part.
          </div>
        )}

        {editing ? (
          <>
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Content</span>
                <span className="text-xs text-muted-foreground">Saving bumps to v{Number(open.version ?? 1) + 1} and re-opens acknowledgements</span>
              </div>
              <RichTextEditor content={draft} onChange={setDraft} minHeight={420} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm border border-input rounded text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90">Save changes</button>
            </div>
          </>
        ) : (
          <>
            <article
              className="sop-body bg-card border border-border rounded-xl shadow-sm px-8 py-7 text-sm text-foreground"
              dangerouslySetInnerHTML={{ __html: open.content ?? '' }}
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-xl px-5 py-4">
              <div className="text-xs text-muted-foreground">
                <ShieldCheck size={13} className="inline mr-1.5 -mt-0.5" />
                {ackCount(open)} {ackCount(open) === 1 ? 'person has' : 'people have'} confirmed they've read v{open.version ?? 1}
                {open.sourceFile && <> · source <code className="text-[11px]">{open.sourceFile}</code></>}
              </div>
              {acked ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                  <Check size={15} /> You've read this version
                </span>
              ) : (
                <button
                  onClick={() => acknowledge(open)}
                  className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded hover:bg-primary/90"
                >
                  Mark as read
                </button>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Library ───────────────────────────────────────────────────────────────
  const unread = sops.filter((s) => !ackedByMe(s)).length
  const needsReview = sops.filter((s) => reviewState(s)).length
  const gapCount = sops.filter((s) => s.needsInput).length

  return (
    <div className="p-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Training</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {sops.length} standard operating procedures
          {me && unread > 0 && <> · <span className="text-amber-700 font-medium">{unread} you haven't confirmed</span></>}
          {needsReview > 0 && <> · {needsReview} due for review</>}
          {gapCount > 0 && <> · <span className="text-blue-700 font-medium">{gapCount} awaiting your input</span></>}
        </p>
      </div>

      {sops.length === 0 ? (
        <div className="bg-card border border-dashed border-input rounded-xl p-10 text-center">
          <FileText size={22} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-foreground font-medium">No procedures loaded yet.</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Run <code>sops-schema.sql</code> in Supabase, then <code>node scripts/seed-sops.mjs</code> to load them from <code>docs/sops/</code>.
          </p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* Categories */}
          <aside className="w-56 shrink-0">
            <div className="relative mb-3">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search procedures…"
                className="w-full pl-8 pr-3 py-2 border border-input rounded-md text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <nav className="space-y-0.5">
              <button
                onClick={() => setCategory('all')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm ${category === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                All <span className="text-xs opacity-70">{sops.length}</span>
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm text-left ${category === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
                >
                  <span className="truncate">{catLabel(c)}</span>
                  <span className="text-xs opacity-70 ml-2">{counts[c]}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* List */}
          <div className="flex-1 min-w-0">
            {rows.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
                Nothing matches “{search}”.
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden divide-y divide-border">
                {rows.map((s) => {
                  const review = reviewState(s)
                  const acked = ackedByMe(s)
                  return (
                    <button
                      key={s.id}
                      onClick={() => setOpenId(s.id)}
                      className="w-full text-left px-5 py-3.5 hover:bg-muted/50 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{s.title}</span>
                          {s.hasTodo && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              <AlertTriangle size={9} /> Unverified
                            </span>
                          )}
                          {s.needsInput && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                              <PencilLine size={9} /> Needs input
                            </span>
                          )}
                          {review && (
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${review.cls}`}>{review.label}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {category === 'all' && <>{catLabel(s.category)} · </>}
                          v{s.version ?? 1}
                          {s.route && <> · {s.route}</>}
                        </div>
                      </div>
                      {me && (
                        acked
                          ? <span className="shrink-0 inline-flex items-center gap-1 text-xs text-green-700"><Check size={12} /> Read</span>
                          : <span className="shrink-0 text-xs text-muted-foreground">Not read</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
