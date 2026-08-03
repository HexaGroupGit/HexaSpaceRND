// Seed the `sops` table from docs/sops/**.md
//
//   node scripts/seed-sops.mjs            # upsert every SOP
//   node scripts/seed-sops.mjs --dry      # report what would change, write nothing
//
// The markdown files in docs/sops are the SOURCE. This converts each one to the
// HTML the Training tab renders and upserts it keyed on its slug, so re-running
// is safe: edits to the markdown flow through, and anything edited in-app is
// overwritten (edit the markdown, or edit in-app — pick one per SOP).
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local (same as the
// other scripts/ tools), falling back to the process environment.
import { readFile, readdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnv(root) {
  try {
    return Object.fromEntries(
      readFileSync(join(root, '.env.local'), 'utf8')
        .split('\n')
        .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
    )
  } catch { return {} }
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SOPS_DIR = join(ROOT, 'docs', 'sops')
const DRY = process.argv.includes('--dry')

// ── frontmatter ──────────────────────────────────────────────────────────────
// Deliberately small: the frontmatter we author is flat scalars, inline arrays
// and one `relatedCode:` block list. No YAML dependency for that.
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: src }
  const meta = {}
  let key = null
  for (const raw of m[1].split(/\r?\n/)) {
    const listItem = raw.match(/^\s+-\s+(.*)$/)
    if (listItem && key) { (meta[key] ||= []).push(strip(listItem[1])); continue }
    const kv = raw.match(/^([A-Za-z][\w]*):\s*(.*)$/)
    if (!kv) continue
    key = kv[1]
    const val = kv[2].trim()
    if (val === '') { meta[key] = []; continue }
    if (val.startsWith('[')) {
      meta[key] = val.slice(1, -1).split(',').map(strip).filter(Boolean)
    } else {
      meta[key] = /^\d+$/.test(val) ? Number(val) : strip(val)
    }
  }
  return { meta, body: m[2] }
}
const strip = (s) => String(s).trim().replace(/^["']|["']$/g, '')

// ── markdown → HTML ──────────────────────────────────────────────────────────
// Covers exactly what the SOPs use: headings, tables, lists, blockquotes, bold,
// italic, inline code, links. Anything else passes through as a paragraph.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0

  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l)
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // Table: header | separator | rows
    if (isTableRow(line) && isTableRow(lines[i + 1] ?? '') && /^[\s|:-]+$/.test(lines[i + 1])) {
      const head = cells(line)
      i += 2
      const body = []
      while (i < lines.length && isTableRow(lines[i])) { body.push(cells(lines[i])); i++ }
      out.push(
        '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>'
      )
      continue
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { const n = Math.min(h[1].length + 1, 6); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { out.push('<hr>'); i++; continue }

    // Blockquote (callouts / TODO markers)
    if (/^>\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`)
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++ }
      out.push('<ol>' + buf.map((b) => `<li>${inline(b)}</li>`).join('') + '</ol>')
      continue
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
      out.push('<ul>' + buf.map((b) => `<li>${inline(b)}</li>`).join('') + '</ul>')
      continue
    }

    // Paragraph — join until a blank line or a block starter
    const buf = []
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,6}\s|>|\s*[-*]\s|\s*\d+\.\s|---+$)/.test(lines[i]) && !isTableRow(lines[i])) {
      buf.push(lines[i]); i++
    }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`)
  }
  return out.join('\n')
}

// Plain text for search — strip tags, collapse whitespace.
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// ── walk docs/sops ───────────────────────────────────────────────────────────
async function collect(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...await collect(full))
    else if (entry.name.endsWith('.md')) found.push(full)
  }
  return found
}

const main = async () => {
  const files = (await collect(SOPS_DIR)).sort()
  const rows = []

  for (const file of files) {
    const src = await readFile(file, 'utf8')
    const { meta, body } = parseFrontmatter(src)
    if (!meta.slug) { console.warn(`  skipped (no slug): ${relative(ROOT, file)}`); continue }
    const html = mdToHtml(body)
    rows.push({
      id: `sop_${meta.slug}`,
      data: {
        id: `sop_${meta.slug}`,
        slug: meta.slug,
        title: meta.title ?? meta.slug,
        category: meta.category ?? 'uncategorised',
        audience: meta.audience ?? [],
        route: meta.route ?? '',
        relatedCode: meta.relatedCode ?? [],
        relatedSops: meta.relatedSops ?? [],
        version: Number(meta.version ?? 1),
        reviewDue: meta.reviewDue ?? null,
        status: 'published',
        content: html,
        searchText: plain(html).toLowerCase(),
        sourceFile: relative(ROOT, file).replace(/\\/g, '/'),
        // Two different kinds of gap, badged separately in the Training tab:
        //   hasTodo    — I could not confirm this against the system
        //   needsInput — only Eric/the team knows this (equipment, timings, contacts)
        hasTodo: /TODO\(verify\)/.test(body),
        needsInput: /NEEDS INPUT/.test(body),
        openGaps: (body.match(/NEEDS INPUT/g) ?? []).length,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
  }

  const byCat = rows.reduce((a, r) => ({ ...a, [r.data.category]: (a[r.data.category] ?? 0) + 1 }), {})
  console.log(`Parsed ${rows.length} SOPs:`)
  for (const [c, n] of Object.entries(byCat).sort()) console.log(`  ${String(n).padStart(3)}  ${c}`)
  console.log(`  ${rows.filter((r) => r.data.hasTodo).length} carry a TODO(verify) marker`)
  const gaps = rows.filter((r) => r.data.needsInput)
  console.log(`  ${gaps.length} await your input (${gaps.reduce((s, r) => s + r.data.openGaps, 0)} gaps total)`)

  if (DRY) { console.log('\n--dry: nothing written.'); return }

  const env = { ...loadEnv(ROOT), ...process.env }
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('\nSUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local or the environment.')
    console.error('Re-run with --dry to parse only.')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  // Chunked so a large set can't blow the request size.
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50)
    const { error } = await sb.from('sops').upsert(chunk)
    if (error) { console.error(`upsert failed at ${i}: ${error.message}`); process.exit(1) }
    console.log(`  upserted ${Math.min(i + 50, rows.length)}/${rows.length}`)
  }
  console.log('\nDone.')
}

main().catch((e) => { console.error(e); process.exit(1) })
