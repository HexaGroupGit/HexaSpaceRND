import { useState, useEffect } from 'react'
import { MonitorPlay, Plus, Trash2, ArrowUp, ArrowDown, Copy, ExternalLink, Check, RefreshCw, Wand2, ImageDown, FileCode2, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { cloneBoard, BOARD_IDS, BOARD_LABELS } from '../lib/directoryData.js'
import { buildDirectoryBoard } from '../lib/directoryAuto.js'
import { layoutOf, sectionRows } from '../lib/directoryHtml.js'
import { downloadBoardPng, downloadBoardHtml } from '../lib/directoryExport.js'

const nowIso = () => new Date().toISOString()

const emptyBoards = () => Object.fromEntries(BOARD_IDS.map((id) => [id, cloneBoard(id)]))

// Where the TVs live. Prefer the real deployment host; fall back to whatever
// origin the admin is browsing from (e.g. localhost during dev).
function publicOrigin() {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return window.location.origin
  return 'https://portal.hexaspace.com.au'
}

export default function Directory() {
  const [level, setLevel] = useState('G')
  const [boards, setBoards] = useState(emptyBoards)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)   // level that was just saved
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState('')  // 'png' | 'html' | ''

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('directory_boards').select('id, data')
      const next = emptyBoards()
      ;(data ?? []).forEach((row) => { if (row.data && next[row.id]) next[row.id] = row.data })
      setBoards(next)
    } catch { /* keep seed */ }
    setLoading(false)
  }

  const board = boards[level]
  const isLobby = layoutOf(board) === 'lobby'
  // The TV-safe standalone page (plain HTML, renders on old Samsung/Tizen
  // browsers that white-screen on the React bundle). /directory/<level> still
  // works too, for previewing on a normal computer.
  const link = `${publicOrigin()}/tv.html?level=${level}`

  function patchBoard(patch) {
    setBoards((prev) => ({ ...prev, [level]: { ...prev[level], ...patch } }))
    setSavedAt(null)
  }

  // ── suite rows (levels 2 / 4 / 5) ──────────────────────────────────────────
  function patchSuite(idx, patch) {
    patchBoard({ suites: board.suites.map((s, i) => (i === idx ? { ...s, ...patch } : s)) })
  }
  function addSuite() {
    const last = board.suites[board.suites.length - 1]
    const nextNum = last ? String((parseInt(last.suite, 10) || board.suites.length) + 1) : '1'
    patchBoard({ suites: [...board.suites, { suite: nextNum, name: '' }] })
  }
  function removeSuite(idx) {
    patchBoard({ suites: board.suites.filter((_, i) => i !== idx) })
  }
  function moveSuite(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= board.suites.length) return
    const suites = [...board.suites]
    ;[suites[idx], suites[j]] = [suites[j], suites[idx]]
    patchBoard({ suites })
  }

  // ── floor sections (ground board) ──────────────────────────────────────────
  const sections = board.sections ?? []
  function patchSections(next) { patchBoard({ sections: next }) }
  function patchSection(idx, patch) {
    patchSections(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  function moveSection(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= sections.length) return
    const next = [...sections]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    patchSections(next)
  }
  function addSection() {
    patchSections([...sections, { floor: '', rows: [{ suite: '', name: '' }] }])
  }
  function removeSection(idx) { patchSections(sections.filter((_, i) => i !== idx)) }
  function patchRow(si, ri, patch) {
    const rows = (sections[si].rows ?? []).map((r, i) => (i === ri ? { ...r, ...patch } : r))
    patchSection(si, { rows })
  }
  function addRow(si) {
    patchSection(si, { rows: [...(sections[si].rows ?? []), { suite: '', name: '' }] })
  }
  function removeRow(si, ri) {
    patchSection(si, { rows: (sections[si].rows ?? []).filter((_, i) => i !== ri) })
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const { error } = await supabase
        .from('directory_boards')
        .upsert({ id: level, data: board, updated_at: nowIso() })
      if (error) throw error
      setSavedAt(level)
    } catch (e) {
      setError(e?.message || 'Could not save. Has the directory_boards table been created in Supabase?')
    }
    setSaving(false)
  }

  function copyLink() {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  // Exports render exactly what's in the editor right now — including edits you
  // haven't saved yet — so what you see is what lands in the file.
  async function exportBoard(kind) {
    setExporting(kind)
    setError('')
    try {
      if (kind === 'png') await downloadBoardPng(board, boards)
      else downloadBoardHtml(board, boards)
    } catch (e) {
      setError(e?.message || 'Could not build the export.')
    }
    setExporting('')
  }

  // Pull live occupancy into the editor: suites from active office contracts,
  // community from VO/desk memberships. Existing display text is kept where
  // the occupant hasn't changed. Nothing is saved until you hit Save.
  async function fillFromLive() {
    setSyncing(true)
    setError('')
    try {
      const [t, l, s] = await Promise.all(
        ['tenants', 'leases', 'spaces'].map((tb) => supabase.from(tb).select('data'))
      )
      const live = {
        tenants: (t.data ?? []).map((r) => r.data),
        leases: (l.data ?? []).map((r) => r.data),
        spaces: (s.data ?? []).map((r) => r.data),
      }
      patchBoard(buildDirectoryBoard(level, board, live))
    } catch (e) {
      setError(e?.message || 'Could not load live data.')
    }
    setSyncing(false)
  }

  const communityText = (board.community || []).join('\n')

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><MonitorPlay size={22} /> Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit the lobby boards. Names here are what shows on the screen — set a clean display
            name (drop the "Pty Ltd" if you like). Hit <span className="font-medium text-foreground">Save &amp; Generate</span>,
            paste the link into the TV once, and it updates itself whenever you edit. For screens with no
            internet, download the board as a PNG or a standalone HTML file instead.
          </p>
        </div>
        <button onClick={load} className="p-2 text-muted-foreground hover:text-foreground border border-border rounded-md" title="Reload"><RefreshCw size={15} /></button>
      </div>

      {/* board toggle */}
      <div className="flex items-center gap-1 mb-5 border-b border-border">
        {BOARD_IDS.map((lv) => (
          <button
            key={lv}
            onClick={() => { setLevel(lv); setCopied(false) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${level === lv ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {BOARD_LABELS[lv]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
      ) : (
        <>
          {isLobby && (
            <div className="border border-border rounded-lg bg-card p-4 mb-6">
              <div className="text-sm text-foreground font-medium">Ground floor — building board</div>
              <p className="text-xs text-muted-foreground mt-1">
                The whole East Commercial Lobby on one board: every floor, plus the community members
                (dedicated desks, flexible desks and virtual offices). The Hexa floors read their suites
                straight from the Level 2, 4 and 5 boards above — edit a suite there and it changes here too.
                There's no internet on the lower floors, so this board is meant to be
                <span className="font-medium text-foreground"> downloaded</span> rather than linked.
              </p>
            </div>
          )}

          {/* downloads */}
          <div className="border border-border rounded-lg bg-card p-4 mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Offline copies — {BOARD_LABELS[level]}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => exportBoard('png')}
                disabled={!!exporting}
                className="flex items-center gap-1.5 border border-input rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
              >
                <ImageDown size={14} /> {exporting === 'png' ? 'Rendering…' : 'Download PNG'}
              </button>
              <button
                onClick={() => exportBoard('html')}
                disabled={!!exporting}
                className="flex items-center gap-1.5 border border-input rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
              >
                <FileCode2 size={14} /> {exporting === 'html' ? 'Building…' : 'Download HTML'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              PNG for printing or a photo frame — always 1510 × 2644px, the panel size. The HTML file is fully self-contained — copy it to a USB stick
              or the screen's local storage, open it, and it scales itself to the display with no internet at all.
              Both use what's in the editor right now, so download after you've made your edits. Neither updates
              itself — re-download whenever the board changes.
            </p>
          </div>

          {/* link card */}
          <div className="border border-border rounded-lg bg-card p-4 mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Link2 size={13} /> Live TV link — {BOARD_LABELS[level]}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="flex-1 min-w-0 truncate text-sm bg-muted/60 rounded px-3 py-2 text-foreground">{link}</code>
              <button onClick={copyLink} className="flex items-center gap-1.5 border border-input rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50">
                {copied ? <><Check size={14} className="text-green-600" /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
              <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 border border-input rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50">
                <ExternalLink size={14} /> Open display
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This link never changes. Editing and re-saving refreshes the board on any TV already showing it
              (within ~30s){isLobby ? ' — but only on a screen that can reach the internet.' : '.'}
            </p>
          </div>

          {/* live-data sync */}
          <div className="border border-border rounded-lg bg-card p-4 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <label className="flex items-start gap-2.5 text-sm cursor-pointer min-w-0">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!board.autoSync}
                  onChange={(e) => patchBoard({ autoSync: e.target.checked })}
                />
                <span>
                  <span className="font-medium text-foreground">Auto-update this board from live data</span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    {isLobby ? (
                      <>
                        Refreshes the community list every morning with the daily reconcile (virtual office &amp;
                        desk memberships). The floor sections below stay exactly as you set them, and the Hexa
                        floors follow the level boards on their own. Remember to re-download after a change.
                      </>
                    ) : (
                      <>
                        Refreshes every morning with the daily reconcile: suites from active office contracts,
                        community members from virtual office &amp; desk memberships. Your polished display names
                        (bilingual lines, shared-suite pairings) are kept while the occupant stays the same.
                      </>
                    )}
                  </span>
                </span>
              </label>
              <button
                onClick={fillFromLive}
                disabled={syncing}
                className="flex items-center gap-1.5 text-sm border border-input rounded-md px-3 py-2 font-medium hover:bg-muted/50 disabled:opacity-50 shrink-0"
              >
                <Wand2 size={14} /> {syncing ? 'Loading…' : 'Refresh from live data now'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              The refresh fills the editor below — review it, fix anything odd, then Save. Tip: run this once and
              compare against the current board before ticking auto-update; differences usually mean a contract on
              the platform needs correcting.
            </p>
          </div>

          {isLobby ? (
            /* floor sections editor */
            <div className="space-y-4 mb-6">
              {sections.map((sec, si) => {
                const linked = !!sec.source
                const rows = sectionRows(sec, boards)
                return (
                  <div key={si} className="border border-border rounded-lg bg-card overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                      <input
                        value={sec.floor ?? ''}
                        onChange={(e) => patchSection(si, { floor: e.target.value })}
                        placeholder="4F"
                        className="w-16 border border-border rounded px-2 py-1.5 text-sm font-semibold bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex-1 min-w-0 grid gap-1.5">
                        <input
                          value={sec.heading ?? ''}
                          onChange={(e) => patchSection(si, { heading: e.target.value })}
                          placeholder="Heading (optional) — e.g. HEXA SPACE L4 Reception"
                          className="w-full border border-border rounded px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <input
                          value={sec.subheading ?? ''}
                          onChange={(e) => patchSection(si, { subheading: e.target.value })}
                          placeholder="Second line (optional) — e.g. 六合空间前台"
                          className="w-full border border-border rounded px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveSection(si, -1)} disabled={si === 0} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move up"><ArrowUp size={14} /></button>
                        <button onClick={() => moveSection(si, 1)} disabled={si === sections.length - 1} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move down"><ArrowDown size={14} /></button>
                        <button onClick={() => removeSection(si)} className="p-1.5 text-muted-foreground hover:text-red-600" title="Remove floor"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {linked ? (
                      <div className="px-4 py-3">
                        <div className="text-xs text-muted-foreground mb-2">
                          Suites come from the <span className="font-medium text-foreground">{BOARD_LABELS[sec.source] || `Level ${sec.source}`}</span> board
                          ({rows.length} {rows.length === 1 ? 'suite' : 'suites'}) — edit them on that tab.
                        </div>
                        <div className="text-sm text-foreground/80 space-y-0.5 max-h-44 overflow-y-auto pr-1">
                          {rows.length === 0 && <div className="text-muted-foreground">Nothing on that board yet.</div>}
                          {rows.map((r, ri) => (
                            <div key={ri} className="flex gap-3">
                              <span className="w-16 shrink-0 text-muted-foreground">{r.suite}</span>
                              <span className="min-w-0">{String(r.name || '').split('\n').join(' · ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {(sec.rows ?? []).map((r, ri) => (
                          <div key={ri} className="flex items-start gap-3 px-4 py-2.5 border-b border-border/60">
                            <input
                              value={r.suite ?? ''}
                              onChange={(e) => patchRow(si, ri, { suite: e.target.value })}
                              placeholder="Suite"
                              className="w-24 border border-border rounded px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <textarea
                              value={r.name ?? ''}
                              onChange={(e) => patchRow(si, ri, { name: e.target.value })}
                              rows={r.name?.includes('\n') ? 2 : 1}
                              placeholder="Business name"
                              className="flex-1 border border-border rounded px-2.5 py-1.5 text-sm bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button onClick={() => removeRow(si, ri)} className="p-1.5 mt-0.5 text-muted-foreground hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
                          </div>
                        ))}
                        <div className="px-4 py-3">
                          <button onClick={() => addRow(si)} className="flex items-center gap-1.5 text-sm text-foreground border border-input rounded-md px-3 py-1.5 font-medium hover:bg-muted/50">
                            <Plus size={14} /> Add business
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={addSection} className="flex items-center gap-1.5 text-sm text-foreground border border-input rounded-md px-3 py-1.5 font-medium hover:bg-muted/50">
                  <Plus size={14} /> Add floor
                </button>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Split into two columns after
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, sections.length)}
                    value={board.columnSplitAfter ?? Math.ceil(sections.length / 2)}
                    onChange={(e) => patchBoard({ columnSplitAfter: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-16 border border-border rounded px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  floors
                </label>
              </div>
            </div>
          ) : (
            /* suites editor */
            <div className="border border-border rounded-lg bg-card overflow-hidden mb-6">
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground uppercase border-b border-border font-medium">
                <div className="w-20">Suite</div>
                <div className="flex-1">Business name shown on board</div>
                <div className="w-24 text-right">Order</div>
              </div>
              {board.suites.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border/60 last:border-0">
                  <input
                    value={s.suite}
                    onChange={(e) => patchSuite(i, { suite: e.target.value })}
                    className="w-16 border border-border rounded px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <textarea
                    value={s.name}
                    onChange={(e) => patchSuite(i, { name: e.target.value })}
                    rows={s.name?.includes('\n') ? 2 : 1}
                    placeholder="Display name (Enter for a second line, e.g. a Chinese name)"
                    className="flex-1 border border-border rounded px-2.5 py-1.5 text-sm bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex items-center gap-1 pt-0.5">
                    <button onClick={() => moveSuite(i, -1)} disabled={i === 0} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move up"><ArrowUp size={14} /></button>
                    <button onClick={() => moveSuite(i, 1)} disabled={i === board.suites.length - 1} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" title="Move down"><ArrowDown size={14} /></button>
                    <button onClick={() => removeSuite(i)} className="p-1.5 text-muted-foreground hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3">
                <button onClick={addSuite} className="flex items-center gap-1.5 text-sm text-foreground border border-input rounded-md px-3 py-1.5 font-medium hover:bg-muted/50">
                  <Plus size={14} /> Add suite
                </button>
              </div>
            </div>
          )}

          {/* community members */}
          <div className="border border-border rounded-lg bg-card p-4 mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!board.showCommunity}
                onChange={(e) => patchBoard({ showCommunity: e.target.checked })}
              />
              Show a “{board.communityHeading || 'Community Members'}” list under the {isLobby ? 'floors' : 'suites'}
            </label>
            {board.showCommunity && (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Dedicated desks, flexible desks and virtual offices — one business per line. They’re laid out
                  into {isLobby ? 'four' : 'three'} columns automatically.
                </p>
                <textarea
                  value={communityText}
                  onChange={(e) => patchBoard({ community: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
                  rows={12}
                  className="w-full border border-border rounded px-3 py-2 text-sm bg-background font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="text-xs text-muted-foreground mt-1">{(board.community || []).length} businesses</div>
              </>
            )}
          </div>

          {/* save bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save & Generate'}
            </button>
            {savedAt === level && !error && (
              <span className="flex items-center gap-1.5 text-sm text-green-600"><Check size={15} /> Saved — the TV will update within ~30s.</span>
            )}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </>
      )}
    </div>
  )
}
