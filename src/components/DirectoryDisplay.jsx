import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { DEFAULT_BOARDS } from '../lib/directoryData.js'

// Public, no-auth lobby TV board. One page per level (/directory/4, /directory/2).
// Reads its row from directory_boards; falls back to the bundled seed if the row
// (or table) doesn't exist yet. Re-fetches every 30s so a TV left on the link
// picks up admin edits without being touched — the "plays on repeat" behaviour.
const REFRESH_MS = 30000

export default function DirectoryDisplay({ level }) {
  const [board, setBoard] = useState(DEFAULT_BOARDS[level] || DEFAULT_BOARDS['4'])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase
          .from('directory_boards')
          .select('data')
          .eq('id', level)
          .maybeSingle()
        if (!cancelled && !error && data?.data) setBoard(data.data)
      } catch { /* keep whatever we have (seed) */ }
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [level])

  // Split the community list into 3 sequential columns so names still read
  // alphabetically top-to-bottom down each column (matching the printed board).
  const list = board.community || []
  const per = Math.ceil(list.length / 3)
  const cols = [list.slice(0, per), list.slice(per, per * 2), list.slice(per * 2)]

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0c] text-white font-sans flex justify-center overflow-x-hidden">
      {/* Layered background matching the reference boards: cool charcoal base with
          a soft light glow behind the title, a faint diagonal pinstripe texture,
          and a vignette that darkens the edges. Fixed so it stays anchored on a TV. */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(115% 75% at 22% 6%, rgba(140,150,170,0.13), transparent 55%),
            repeating-linear-gradient(135deg, rgba(255,255,255,0.016) 0px, rgba(255,255,255,0.016) 1px, transparent 1px, transparent 9px),
            radial-gradient(125% 115% at 50% 26%, #1e2126 0%, #14151a 45%, #0a0a0c 100%)
          `,
        }}
      />

      <div className="relative w-full max-w-[1100px] px-10 py-10 md:px-14 md:py-12">
        {/* address strip */}
        <div className="text-center text-[11px] md:text-xs tracking-[0.5em] text-zinc-500 uppercase">
          {board.address}
        </div>

        {/* header: title left, wordmark right (no cube icon) */}
        <div className="mt-8 flex items-start justify-between gap-6">
          <h1 className="leading-[0.92]">
            <span className="block text-5xl md:text-6xl font-light tracking-[0.12em] text-white">
              {board.levelLabel}
            </span>
            <span className="block text-5xl md:text-6xl font-bold tracking-[0.06em] text-white">
              DIRECTORY
            </span>
          </h1>
          <div className="text-right shrink-0 pt-1">
            <div className="text-3xl md:text-4xl font-light tracking-[0.18em] text-white">HEXA SPACE</div>
            <div className="mt-1 text-lg md:text-xl tracking-[0.6em] text-zinc-400">六 合 空 间</div>
          </div>
        </div>

        {/* column headers */}
        <div className="mt-10 flex text-[11px] md:text-xs tracking-[0.35em] text-zinc-500 uppercase pb-3 border-b border-white/10 pl-5">
          <div className="w-24 md:w-36">Suite</div>
          <div>Business Name</div>
        </div>

        {/* suite rows */}
        <div className="mt-2 border-l border-white/10">
          {(board.suites || []).map((s, i) => (
            <div key={i} className="flex items-start py-4 pl-5">
              <div className="w-24 md:w-36 shrink-0 text-xl md:text-2xl font-light text-zinc-400 tabular-nums">
                {s.suite}
              </div>
              <div className="text-xl md:text-2xl font-light text-white leading-snug">
                {String(s.name || '').split('\n').map((line, li) => (
                  <div key={li} className={li > 0 ? 'text-lg md:text-xl text-zinc-300' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* community members */}
        {board.showCommunity && (board.community || []).length > 0 && (
          <div className="mt-14">
            <div className="text-center text-2xl md:text-3xl tracking-[0.35em] text-white uppercase">
              {board.communityHeading}
            </div>
            {board.communitySubheading && (
              <div className="mt-2 text-center text-sm tracking-[0.4em] text-zinc-500">
                {board.communitySubheading}
              </div>
            )}
            <div className="mt-8 grid grid-cols-3 gap-x-8">
              {cols.map((col, ci) => (
                <div key={ci} className="space-y-3">
                  {col.map((name, ni) => (
                    <div
                      key={ni}
                      className="text-sm md:text-base font-light text-zinc-300 leading-snug border-b border-white/[0.06] pb-3"
                    >
                      {name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* footer */}
        <div className="mt-16 text-center text-[10px] md:text-[11px] tracking-[0.4em] text-zinc-600 uppercase">
          HEXA SPACE · 830 WHITEHORSE ROAD BOX HILL
        </div>
      </div>
    </div>
  )
}
