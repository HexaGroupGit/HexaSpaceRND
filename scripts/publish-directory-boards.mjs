// Publish the Ground and Level 5 directory boards.
//
// tv.html reads directory_boards and has no bundled seed, so a board that has
// never been saved leaves the screen on "LOADING DIRECTORY…" forever. Rows '2'
// and '4' were created when those boards were first saved in the admin; 'G' and
// '5' need the same.
//
// Content starts from the bundled seed (src/lib/directoryData.js) and then gets
// the same live-data pass the admin's "Refresh from live data" button runs, so
// the suites and community reflect who is actually here today.
//
//   node scripts/publish-directory-boards.mjs           # dry run
//   node scripts/publish-directory-boards.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_BOARDS, cloneBoard } from '../src/lib/directoryData.js'
import { buildDirectoryBoard } from '../src/lib/directoryAuto.js'

const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8').split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

const [t, l, s, existing] = await Promise.all([
  sb.from('tenants').select('data'),
  sb.from('leases').select('data'),
  sb.from('spaces').select('data'),
  sb.from('directory_boards').select('id'),
])
const live = { tenants: t.data.map(r => r.data), leases: l.data.map(r => r.data), spaces: s.data.map(r => r.data) }
const have = new Set(existing.data.map(r => r.id))

for (const id of ['G', '5']) {
  if (have.has(id)) { console.log(`\n${id}: row already exists — leaving it alone`); continue }
  const seed = cloneBoard(id)
  const fromLive = buildDirectoryBoard(id, seed, live)

  // Suites keep the transcribed board text. The live pass names them from the
  // CONTRACT holder, which is the legal entity ("Hexa Pacific PTY LTD") rather
  // than the trading name on the wall ("HEXA Group 六合集团") — and it collapses
  // a shared suite to whoever signed. Community is the opposite: it's a plain
  // list of who currently holds a desk/VO membership, so live is authoritative.
  const board = { ...seed, community: fromLive.community ?? [] }

  console.log(`\n${id}: ${(board.suites ?? []).length} suites, ${(board.community ?? []).length} community`)
  if (id === '5') {
    console.log(`   publishing : ${board.suites.map(x => `${x.suite}=${String(x.name).split('\n')[0]}`).join(' | ')}`)
    console.log(`   (live said : ${(fromLive.suites ?? []).map(x => `${x.suite}=${String(x.name).split('\n')[0]}`).join(' | ') || 'nothing'})`)
  }
  if (id === 'G') {
    console.log(`   sections : ${board.sections.map(x => `${x.floor}${x.source ? `←L${x.source}` : ''}`).join(' ')}`)
    console.log(`   community: ${(board.community ?? []).slice(0, 6).join(', ')}${board.community.length > 6 ? `, … (+${board.community.length - 6})` : ''}`)
  }
  if (APPLY) {
    const { error } = await sb.from('directory_boards').upsert({ id, data: board, updated_at: new Date().toISOString() })
    if (error) throw new Error(`${id}: ${error.message}`)
    console.log('   → saved')
  }
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — nothing written. Re-run with --apply.'}`)
