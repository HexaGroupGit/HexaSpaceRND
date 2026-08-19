import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Sparkles, Loader2, Download, AlertCircle, Copy, Check, RefreshCw } from 'lucide-react'
import { authHeaders } from '../lib/apiFetch.js'
import { renderPost } from '../../public/marketing/podcast-render.js'
import { RATIOS, W, LOGO_W, LOGO_B } from '../../public/marketing/carousel-render.js'

// Post Studio — a brief goes to Claude, the copy comes back shaped like the
// canvas template, and every post is drawn here in the browser. Editing a field
// re-renders instantly (no second API call), so the admin can tune wording,
// swap the photo or move the crop before downloading the PNGs.

// The shoot library. `key` is what Claude picks from; `src` is what we draw.
const PHOTOS = [
  { key: 'private-office',  src: '/proposal/private-office.jpg',  label: 'Private suite, corner window' },
  { key: 'open-plan',       src: '/proposal/dd-3159.jpg',         label: 'Open plan with planter bays' },
  { key: 'booths',          src: '/proposal/dd-3188.jpg',         label: 'Open plan booths and pods' },
  { key: 'reception',       src: '/proposal/reception.jpg',       label: 'Reception and concierge' },
  { key: 'lounge',          src: '/proposal/gallery-2.jpg',       label: 'Member lounge, round mirror' },
  { key: 'lounge-sofa',     src: '/proposal/lounge-main.jpg',     label: 'Lounge, leather sofa' },
  { key: 'boardroom',       src: '/proposal/meeting-room.jpg',    label: 'Meeting room, boardroom' },
  { key: 'tearoom',         src: '/proposal/room-east.jpg',       label: 'East, Chinese tearoom' },
  { key: 'members-working', src: '/proposal/comm-4.jpg',          label: 'Members at work (portrait)' },
  { key: 'event-space',     src: '/proposal/event-space.jpg',     label: 'Function and event space' },
  { key: 'media-studio',    src: '/proposal/media-1.jpg',         label: 'Media studio' },
  { key: 'podcast-mic',     src: '/marketing/podcast/mic.jpg',    label: 'Podcast mic (portrait)' },
  { key: 'podcast-desk',    src: '/marketing/podcast/desk.jpg',   label: 'Podcast mixing console' },
  { key: 'podcast-camera',  src: '/marketing/podcast/camera.jpg', label: 'Camera, teleprompter, monitor' },
]
const srcFor = (key) => PHOTOS.find((p) => p.key === key)?.src ?? PHOTOS[0].src

const FIELDS = [
  ['tag',    'Olive pill'],
  ['corner', 'Top-right label'],
  ['title',  'Headline (Enter for a line break)'],
  ['lede',   'Sub-line'],
  ['spec',   'Accent strip'],
  ['cta',    'Call to action'],
  ['foot',   'Address'],
]

const inp = 'w-full border border-input rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
const lab = 'block text-[11px] font-medium text-muted-foreground mb-1'

// ── One post: its own canvas, redrawn whenever its copy changes ──────────────
function PostCard({ post, index, ratio, lang, images, onChange }) {
  const cvRef = useRef(null)

  const draw = useCallback(() => {
    const cv = cvRef.current
    if (!cv) return
    const H = RATIOS[ratio]
    cv.width = W
    cv.height = H
    renderPost(cv.getContext('2d'), { ...post, img: srcFor(post.photo) }, images, { H, lang })
  }, [post, ratio, lang, images])

  useEffect(() => { draw() }, [draw])

  function download() {
    const cv = cvRef.current
    if (!cv) return
    cv.toBlob((blob) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `hexa-post_${lang}_${W}x${RATIOS[ratio]}_0${index + 1}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    }, 'image/png')
  }

  const set = (k) => (e) => onChange({ ...post, [k]: e.target.value })

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col lg:flex-row">
      <div className="lg:w-[300px] shrink-0 bg-muted/40 p-4 flex items-start justify-center">
        <canvas ref={cvRef} className="w-full max-w-[260px] h-auto shadow-md rounded" />
      </div>

      <div className="flex-1 p-4 space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {String(index + 1).padStart(2, '0')} · {post.angle || 'Post'}
          </span>
          <button onClick={download} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded px-3 py-1.5 hover:bg-primary/90">
            <Download size={12} /> PNG
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {FIELDS.map(([k, label]) => (
            <div key={k} className={k === 'title' || k === 'lede' ? 'col-span-2' : ''}>
              <label className={lab}>{label}</label>
              {k === 'title' || k === 'lede' ? (
                <textarea rows={2} className={inp} value={post[k] ?? ''} onChange={set(k)} />
              ) : (
                <input className={inp} value={post[k] ?? ''} onChange={set(k)} />
              )}
            </div>
          ))}
          <div className="col-span-2">
            <label className={lab}>Photo</label>
            <select className={inp} value={post.photo} onChange={set('photo')}>
              {PHOTOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lab}>Crop &#8597; {post.focus}</label>
            <input type="range" min={0} max={100} value={post.focus} className="w-full accent-primary"
              onChange={(e) => onChange({ ...post, focus: Number(e.target.value) })} />
          </div>
          <div>
            <label className={lab}>Darkness {post.scrim}</label>
            <input type="range" min={40} max={100} value={post.scrim} className="w-full accent-primary"
              onChange={(e) => onChange({ ...post, scrim: Number(e.target.value) })} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PostStudio({ store }) {
  const { spaces = [], leases = [] } = store ?? {}

  const [brief, setBrief] = useState('')
  const [count, setCount] = useState(3)
  const [lang, setLang] = useState('en')
  const [ratio, setRatio] = useState('45')
  const [posts, setPosts] = useState([])
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [images, setImages] = useState({})
  const [ready, setReady] = useState(false)

  // Fonts + photos load once; the renderer needs them present before drawing.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // The admin app registers the OTFs under these names (src/index.css);
        // the engine's font stacks list them right after the Hx* aliases.
        await Promise.all([
          document.fonts.load('200 100px "Big Daily Short"'),
          document.fonts.load('600 20px "Rework Micro"'),
          document.fonts.load('300 26px "GT America"'),
        ])
      } catch { /* fonts are best-effort — the stack falls back */ }
      const srcs = [...PHOTOS.map((p) => p.src), LOGO_W, LOGO_B]
      const loaded = {}
      await Promise.all(srcs.map((src) => new Promise((done) => {
        const im = new Image()
        im.onload = () => { loaded[src] = im; done() }
        im.onerror = () => done()
        im.src = src
      })))
      if (alive) { setImages(loaded); setReady(true) }
    })()
    return () => { alive = false }
  }, [])

  // Live vacancy, so a brief like "push what's available" gets real suites.
  const context = useMemo(() => {
    const held = new Set(leases.filter((l) => l.status === 'active').map((l) => l.spaceId))
    const vacant = spaces.filter((s) => s.type === 'office' && !held.has(s.id))
    if (!vacant.length) return ''
    const label = { l2: 'Level 2', l4: 'Level 4', l5: 'Level 5' }
    return `Vacant private offices right now:\n${vacant.slice(0, 12)
      .map((s) => `  ${s.unitNumber} — ${label[s.floor] ?? s.floor ?? '?'}, ${s.pax ?? '?'} desks, $${s.monthlyRate}/mo ex GST`)
      .join('\n')}`
  }, [spaces, leases])

  async function generate() {
    if (!brief.trim()) { setErr('Tell me what the posts are about.'); return }
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/social-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          brief, count, lang, context,
          photos: PHOTOS.map(({ key, label }) => ({ key, label })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setPosts((data.posts ?? []).map((p) => ({
        ...p,
        photo: PHOTOS.some((x) => x.key === p.photo) ? p.photo : PHOTOS[0].key,
        focus: 50,
        scrim: 80,
      })))
      setCaption(data.caption ?? '')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Sequential so the browser doesn't drop all but the first download.
  async function downloadAll() {
    const canvases = document.querySelectorAll('[data-poststudio] canvas')
    for (let i = 0; i < canvases.length; i++) {
      await new Promise((done) => canvases[i].toBlob((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `hexa-post_${lang}_${W}x${RATIOS[ratio]}_0${i + 1}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
        done()
      }, 'image/png'))
      await new Promise((r) => setTimeout(r, 320))
    }
  }

  const seg = (on) => `px-3 py-1.5 text-xs font-medium rounded-md border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`
  const vacantCount = context ? context.split('\n').length - 1 : 0

  return (
    <div data-poststudio>
      {/* Brief */}
      <div className="border border-border rounded-xl bg-card p-5 space-y-4">
        <div>
          <label className={lab}>What are the posts about?</label>
          <textarea
            rows={3} className={inp} value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. The podcast room opens next month on Level 2 — two mics, two seats, camera gear. Push the video angle and get people to book a tour."
          />
        </div>

        <div className="flex flex-wrap items-end gap-5">
          <div>
            <span className={lab}>Posts</span>
            <div className="flex gap-1.5">
              {[1, 3, 5].map((n) => <button key={n} onClick={() => setCount(n)} className={seg(count === n)}>{n}</button>)}
            </div>
          </div>
          <div>
            <span className={lab}>Language</span>
            <div className="flex gap-1.5">
              <button onClick={() => setLang('en')} className={seg(lang === 'en')}>English</button>
              <button onClick={() => setLang('zh')} className={seg(lang === 'zh')}>中文</button>
            </div>
          </div>
          <div>
            <span className={lab}>Size</span>
            <div className="flex gap-1.5">
              <button onClick={() => setRatio('45')} className={seg(ratio === '45')}>Instagram 4:5</button>
              <button onClick={() => setRatio('34')} className={seg(ratio === '34')}>小红书 3:4</button>
            </div>
          </div>
          <button onClick={generate} disabled={busy || !ready}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {busy ? 'Writing…' : posts.length ? 'Regenerate' : 'Generate posts'}
          </button>
          {posts.length > 0 && (
            <button onClick={downloadAll} className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm hover:bg-muted">
              <Download size={15} /> Download all
            </button>
          )}
        </div>

        {!ready && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Loading brand assets…
          </p>
        )}
        {vacantCount > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Grounded with live vacancy — {vacantCount} office{vacantCount === 1 ? '' : 's'} available.
          </p>
        )}
        {err && <p className="text-sm text-red-600 flex items-center gap-2"><AlertCircle size={14} /> {err}</p>}
      </div>

      {/* Results */}
      {posts.length > 0 && (
        <div className="mt-6 space-y-4">
          {posts.map((p, i) => (
            <PostCard
              key={i} post={p} index={i} ratio={ratio} lang={lang} images={images}
              onChange={(next) => setPosts((prev) => prev.map((x, idx) => (idx === i ? next : x)))}
            />
          ))}

          <div className="border border-border rounded-xl bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caption</h3>
              <button
                onClick={() => { navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1600) }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea rows={5} className={inp} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
        </div>
      )}

      {posts.length === 0 && !busy && (
        <p className="text-sm text-muted-foreground mt-6 flex items-center gap-2">
          <RefreshCw size={14} /> Describe the posts above and Claude will write them onto the branded template — edit anything before you download.
        </p>
      )}
    </div>
  )
}
