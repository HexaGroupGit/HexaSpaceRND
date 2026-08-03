import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { DEFAULT_BOARDS } from '../lib/directoryData.js'
import { boardBodyHtml, boardStyles, layoutOf, BOARD_BACKDROP } from '../lib/directoryHtml.js'

// Public, no-auth lobby board. One page per board (/directory/4, /directory/2,
// /directory/5, /directory/G). Reads from directory_boards; falls back to the
// bundled seed if the row (or table) doesn't exist yet. Re-fetches every 30s so
// a screen left on the link picks up admin edits without being touched — the
// "plays on repeat" behaviour.
//
// Markup comes from directoryHtml.js, the same builder behind the admin's PNG
// and standalone-HTML exports, so the preview is exactly what gets downloaded.
// The ground board borrows its Hexa floors from the level boards, so all rows
// are loaded, not just this one.
const REFRESH_MS = 30000

export default function DirectoryDisplay({ level }) {
  const [boards, setBoards] = useState(DEFAULT_BOARDS)
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase.from('directory_boards').select('id, data')
        if (cancelled || error || !data) return
        const next = { ...DEFAULT_BOARDS }
        data.forEach((row) => { if (row.data) next[row.id] = row.data })
        setBoards(next)
      } catch { /* keep whatever we have (seed) */ }
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const board = boards[level] || DEFAULT_BOARDS[level] || DEFAULT_BOARDS['4']
  const layout = layoutOf(board)
  const html = boardBodyHtml(board, boards)

  // Scale the board to the screen — no scrolling, no clipping, whatever the
  // board's length. Re-measured after CJK glyphs and the column layout settle.
  useLayoutEffect(() => {
    function fit() {
      const el = wrapRef.current
      if (!el) return
      // offsetWidth/Height are layout values — unaffected by the transform, so
      // this can't feed back on itself.
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (!w || !h) return
      setScale(Math.min(window.innerWidth / w, window.innerHeight / h))
    }
    fit()
    const t1 = setTimeout(fit, 80)
    const t2 = setTimeout(fit, 500)
    window.addEventListener('resize', fit)
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', fit) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, layout])

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <style>{boardStyles(layout)}</style>
      <div className="fixed inset-0 pointer-events-none" style={cssToStyle(BOARD_BACKDROP[layout])} />
      <div className="relative flex justify-center" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        <div ref={wrapRef} className={`hxdir ${layout}`} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}

// The backdrop is shared with the exports as a plain CSS declaration string.
function cssToStyle(css) {
  const style = {}
  String(css).split(';').forEach((decl) => {
    const i = decl.indexOf(':')
    if (i < 0) return
    const prop = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const value = decl.slice(i + 1).trim()
    if (prop && value) style[prop] = value
  })
  return style
}
