// Canonical markup for the lobby directory boards.
//
// One place builds the board HTML so the two admin exports always agree:
//   • Download HTML — a self-contained file with the data baked in. The ground
//     and lower floors have no internet, so the board has to render from the
//     file alone: no fetch, no fonts, no scripts beyond a scale-to-fit shim.
//   • Download PNG  — the same markup rendered offscreen and rasterised
//     (see directoryExport.js).
//
// public/tv.html keeps its own ES5 copy of this for the live, Supabase-backed
// TVs (old Samsung/Tizen browsers white-screen on anything modern). Keep the
// two in step when the design changes.

export const BOARD_WIDTH = { suites: 1100, lobby: 1500 }

export function layoutOf(board) {
  return board?.layout === 'lobby' ? 'lobby' : 'suites'
}

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A name may carry extra lines (bilingual second line, shared suite) — the
// first line is full size, the rest are smaller and dimmer.
function nameHtml(name) {
  const lines = String(name ?? '').split('\n')
  return lines
    .map((l, i) => (i === 0 ? esc(l) : `<div class="l2">${esc(l)}</div>`))
    .join('')
}

// Rows for a ground-board section: either typed in by hand, or borrowed from
// one of the level boards (so a suite change up there shows down here too).
export function sectionRows(section, boards) {
  if (!section) return []
  if (section.source) {
    const src = boards?.[section.source]
    return (src?.suites ?? []).map((s) => ({
      suite: String(s.suite ?? '').trim() ? `Suite ${String(s.suite).trim()}` : '',
      name: s.name,
    }))
  }
  return section.rows ?? []
}

// ── Suite boards (levels 2, 4, 5) ───────────────────────────────────────────
function suitesBodyHtml(board) {
  const suites = board.suites ?? []
  const comm = board.community ?? []
  let h = ''
  h += `<div class="addr">${esc(board.address || '830 WHITEHORSE ROAD · BOX HILL')}</div>`
  h += '<div class="head">'
  h += `<div class="title"><span class="lv">${esc(board.levelLabel || `LEVEL ${board.level}`)}</span><span class="dr">DIRECTORY</span></div>`
  h += '<div class="brand"><div class="n">HEXA SPACE</div><div class="cn">六 合 空 间</div></div>'
  h += '</div>'

  h += '<div class="cols"><div class="c1">Suite</div><div>Business Name</div></div>'
  h += '<div class="list">'
  for (const s of suites) {
    h += `<div class="row"><div class="s">${esc(s.suite)}</div><div class="b">${nameHtml(s.name)}</div></div>`
  }
  h += '</div>'

  if (board.showCommunity && comm.length) {
    h += `<div class="comm"><div class="h">${esc(board.communityHeading || 'COMMUNITY MEMBERS')}</div>`
    if (board.communitySubheading) h += `<div class="sh">${esc(board.communitySubheading)}</div>`
    h += '<div class="grid">'
    for (const c of comm) h += `<div class="item">${esc(c)}</div>`
    h += '</div></div>'
  }

  h += '<div class="foot">HEXA SPACE · 830 WHITEHORSE ROAD BOX HILL</div>'
  return h
}

// ── Ground-floor building board ─────────────────────────────────────────────
// The Panorama mark, drawn rather than linked so the exported file stays
// self-contained (and printable) with nothing to load.
const PANORAMA_MARK = `<svg class="mk" viewBox="0 0 64 48" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M32 42 C13 35 4 24 6 14 C8 5 19 2 25 9 C30 15 32 27 32 42 Z"/>
    <path d="M32 42 C51 35 60 24 58 14 C56 5 45 2 39 9 C34 15 32 27 32 42 Z"/>
  </g>
</svg>`

function sectionHtml(section, boards) {
  const rows = sectionRows(section, boards)
  let h = '<div class="sec">'
  h += `<div class="fl"><span class="n">${esc(section.floor)}</span><span class="ln"></span></div>`
  if (section.heading) h += `<div class="hd">${esc(section.heading)}</div>`
  if (section.subheading) h += `<div class="sub">${esc(section.subheading)}</div>`
  h += '<div class="rows">'
  for (const r of rows) {
    h += `<div class="row"><div class="s">${esc(r.suite)}</div><div class="b">${nameHtml(r.name)}</div></div>`
  }
  h += '</div></div>'
  return h
}

function lobbyBodyHtml(board, boards) {
  const sections = board.sections ?? []
  const split = Number.isFinite(board.columnSplitAfter)
    ? board.columnSplitAfter
    : Math.ceil(sections.length / 2)
  const left = sections.slice(0, split)
  const right = sections.slice(split)
  const comm = board.community ?? []
  const [titleTop, ...titleRest] = String(board.title || 'EAST\nCOMMERCIAL LOBBY').split('\n')

  let h = '<div class="top">'
  h += '<div class="bd">'
  h += PANORAMA_MARK
  h += '<div class="bt">'
  h += `<div class="bn">${esc(board.buildingName || 'PANORAMA')}</div>`
  if (board.buildingSub) h += `<div class="bs"><i></i><span>${esc(board.buildingSub)}</span><i></i></div>`
  if (board.buildingCn) h += `<div class="bc">${esc(board.buildingCn)}</div>`
  h += '</div></div>'
  h += `<div class="tt"><span class="t1">${esc(titleTop)}</span>${titleRest.map((t) => `<span class="t2">${esc(t)}</span>`).join('')}</div>`
  h += '</div>'

  h += '<div class="body">'
  for (const col of [left, right]) {
    h += '<div class="col">'
    for (const s of col) h += sectionHtml(s, boards)
    h += '</div>'
  }
  h += '</div>'

  if (board.showCommunity && comm.length) {
    h += '<div class="reg"><div class="rh">'
    h += '<div class="rl">'
    if (board.communityLead) h += `<span class="lead">${esc(board.communityLead)}</span>`
    h += `<span class="ttl">${esc(board.communityHeading || 'Registered Businesses')}</span>`
    h += '</div>'
    if (board.communitySubheading) h += `<div class="rcn">${esc(board.communitySubheading)}</div>`
    h += '</div><div class="rg">'
    for (const c of comm) h += `<div class="item">${esc(c)}</div>`
    h += '</div></div>'
  }

  h += `<div class="foot"><span>${esc(board.buildingName || 'PANORAMA')} ${esc(board.buildingSub || '')} · ${esc(String(board.title || '').replace(/\n/g, ' '))}</span><span>BUILDING DIRECTORY</span></div>`
  return h
}

// Inner markup for a board — wrap it in `<div class="hxdir ${layout}">`.
export function boardBodyHtml(board, boards) {
  return layoutOf(board) === 'lobby' ? lobbyBodyHtml(board, boards) : suitesBodyHtml(board)
}

// ── Styles ──────────────────────────────────────────────────────────────────
// Every rule is scoped under .hxdir so the same sheet can be injected into the
// admin page (for the PNG render) without leaking into the app.
const SUITES_CSS = `
.hxdir.suites { width: ${BOARD_WIDTH.suites}px; padding: 26px 52px 22px; color: #fff;
  font-family: "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif; font-weight: 300; }
.hxdir.suites .addr { text-align: center; font-size: 12px; letter-spacing: 0.5em; color: #8a8a92; text-transform: uppercase; }
.hxdir.suites .head { display: flex; align-items: flex-start; justify-content: space-between; margin-top: 18px; }
.hxdir.suites .title { line-height: 0.9; }
.hxdir.suites .title .lv { display: block; font-size: 50px; font-weight: 300; letter-spacing: 0.12em; }
.hxdir.suites .title .dr { display: block; font-size: 50px; font-weight: 700; letter-spacing: 0.06em; }
.hxdir.suites .brand { text-align: right; padding-top: 2px; white-space: nowrap; }
.hxdir.suites .brand .n { font-size: 34px; font-weight: 300; letter-spacing: 0.18em; }
.hxdir.suites .brand .cn { margin-top: 5px; font-size: 18px; letter-spacing: 0.6em; color: #a7a7ae; }
.hxdir.suites .cols { display: flex; margin-top: 22px; padding: 0 0 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.10);
  font-size: 12px; letter-spacing: 0.35em; color: #8a8a92; text-transform: uppercase; }
.hxdir.suites .cols .c1 { width: 150px; }
.hxdir.suites .list { margin-top: 6px; border-left: 1px solid rgba(255,255,255,0.10); }
.hxdir.suites .list .row { display: flex; align-items: flex-start; padding: 9px 0 9px 20px; }
.hxdir.suites .list .row .s { width: 150px; flex: 0 0 150px; font-size: 23px; font-weight: 300; color: #a7a7ae; }
.hxdir.suites .list .row .b { font-size: 23px; font-weight: 300; line-height: 1.2; }
.hxdir.suites .list .row .b .l2 { font-size: 18px; color: #c9c9d0; }
.hxdir.suites .comm { margin-top: 26px; }
.hxdir.suites .comm .h { text-align: center; font-size: 25px; letter-spacing: 0.35em; text-transform: uppercase; }
.hxdir.suites .comm .sh { text-align: center; margin-top: 7px; font-size: 13px; letter-spacing: 0.4em; color: #8a8a92; }
.hxdir.suites .comm .grid { margin-top: 18px; column-count: 3; column-gap: 30px; }
.hxdir.suites .comm .item { break-inside: avoid; font-size: 15px; font-weight: 300; color: #c9c9d0; line-height: 1.25;
  padding-bottom: 7px; margin-bottom: 7px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.hxdir.suites .foot { margin-top: 26px; text-align: center; font-size: 11px; letter-spacing: 0.4em; color: #55555c; text-transform: uppercase; }
`

const LOBBY_CSS = `
.hxdir.lobby { width: ${BOARD_WIDTH.lobby}px; padding: 40px 56px 26px; color: #fff;
  font-family: "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif; font-weight: 300; }
.hxdir.lobby .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 40px;
  padding-bottom: 26px; border-bottom: 1px solid rgba(200,167,94,0.22); }
.hxdir.lobby .bd { display: flex; align-items: center; gap: 16px; color: #c8a75e; }
.hxdir.lobby .bd .mk { width: 58px; height: 44px; flex: 0 0 58px; }
.hxdir.lobby .bn { font-size: 34px; font-weight: 400; letter-spacing: 0.22em; color: #fff; }
.hxdir.lobby .bs { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
.hxdir.lobby .bs i { display: block; width: 26px; height: 1px; background: #c8a75e; }
.hxdir.lobby .bs span { font-size: 12px; letter-spacing: 0.34em; color: #c8a75e; }
.hxdir.lobby .bc { margin-top: 7px; font-size: 15px; letter-spacing: 0.34em; color: #c8a75e; }
.hxdir.lobby .tt { text-align: right; line-height: 1.02; }
.hxdir.lobby .tt .t1 { display: block; font-size: 40px; font-weight: 300; letter-spacing: 0.05em; color: #c8a75e; }
.hxdir.lobby .tt .t2 { display: block; font-size: 40px; font-weight: 700; letter-spacing: 0.02em; color: #c8a75e; }
.hxdir.lobby .body { display: flex; gap: 52px; margin-top: 28px; align-items: flex-start; }
.hxdir.lobby .col { flex: 1 1 0; min-width: 0; }
.hxdir.lobby .sec { margin-bottom: 26px; }
.hxdir.lobby .sec:last-child { margin-bottom: 0; }
.hxdir.lobby .fl { display: flex; align-items: center; gap: 16px; }
.hxdir.lobby .fl .n { font-size: 40px; font-weight: 700; letter-spacing: 0.02em; color: #fff; line-height: 1.1; }
.hxdir.lobby .fl .ln { flex: 1 1 auto; height: 1px; background: rgba(255,255,255,0.16); }
.hxdir.lobby .hd { margin-top: 8px; font-size: 19px; font-weight: 500; color: #c8a75e; }
.hxdir.lobby .sub { margin-top: 3px; font-size: 13px; color: #9b8a63; }
.hxdir.lobby .rows { margin-top: 10px; }
.hxdir.lobby .sec .row { display: flex; align-items: flex-start; gap: 14px; padding: 4px 0; }
.hxdir.lobby .sec .row .s { width: 78px; flex: 0 0 78px; font-size: 15px; color: #86868f; padding-top: 3px; }
.hxdir.lobby .sec .row .b { font-size: 19px; line-height: 1.32; color: #fff; }
.hxdir.lobby .sec .row .b .l2 { font-size: 19px; color: #fff; }
.hxdir.lobby .reg { margin-top: 34px; border: 1px solid rgba(200,167,94,0.22); border-radius: 3px; padding: 22px 26px 16px;
  background: rgba(255,255,255,0.015); }
.hxdir.lobby .rh { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding-bottom: 16px; }
.hxdir.lobby .rl { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.hxdir.lobby .rl .lead { font-size: 19px; font-weight: 700; letter-spacing: 0.06em; color: #fff; }
.hxdir.lobby .rl .ttl { font-size: 25px; font-weight: 500; color: #c8a75e; }
.hxdir.lobby .rcn { font-size: 14px; letter-spacing: 0.1em; color: #9b8a63; white-space: nowrap; }
.hxdir.lobby .rg { column-count: 4; column-gap: 34px; }
.hxdir.lobby .item { break-inside: avoid; font-size: 14px; line-height: 1.3; color: #d2d2d8;
  padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.hxdir.lobby .foot { display: flex; justify-content: space-between; gap: 20px; margin-top: 22px;
  font-size: 11px; letter-spacing: 0.28em; color: #6c6558; text-transform: uppercase; }
`

export function boardStyles(layout) {
  return `.hxdir { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
.hxdir *, .hxdir *::before, .hxdir *::after { box-sizing: border-box; }
${layout === 'lobby' ? LOBBY_CSS : SUITES_CSS}`
}

// Page backdrop. Kept identical to the canvas painting in directoryExport.js so
// the PNG and the HTML file look the same.
export const BOARD_BACKDROP = {
  suites: `background-color: #14151a; background-image:
    radial-gradient(115% 75% at 22% 6%, rgba(140,150,170,0.13), rgba(20,21,26,0) 55%),
    repeating-linear-gradient(135deg, rgba(255,255,255,0.016) 0px, rgba(255,255,255,0.016) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 9px),
    radial-gradient(125% 115% at 50% 26%, #1e2126 0%, #14151a 45%, #0a0a0c 100%);`,
  lobby: `background-color: #0b0b0e; background-image:
    radial-gradient(90% 60% at 12% 0%, rgba(200,167,94,0.10), rgba(11,11,14,0) 60%),
    repeating-linear-gradient(135deg, rgba(255,255,255,0.014) 0px, rgba(255,255,255,0.014) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 9px),
    radial-gradient(120% 110% at 50% 24%, #191919 0%, #111114 48%, #08080a 100%);`,
}

// A complete, offline standalone page. No network, no fonts, no data fetch —
// everything it needs is in the file, which is the point: the ground floor and
// the lower levels have no internet, so the board is carried there on a stick.
export function buildBoardDocument(board, boards, { generatedOn = '' } = {}) {
  const layout = layoutOf(board)
  const title = `Hexa Space Directory — ${board.levelLabel || board.level}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<!-- Standalone directory board exported from the Hexa Space admin${generatedOn ? ` on ${esc(generatedOn)}` : ''}.
     Self-contained: open it from a USB stick or a local folder, no internet needed.
     Re-export from Admin → Directory whenever the board changes. -->
<style>
html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0c; }
body { overflow: hidden; }
#bg { position: fixed; inset: 0; z-index: 0; ${BOARD_BACKDROP[layout]} }
#fit { position: relative; z-index: 1; display: flex; justify-content: center; transform-origin: top center; }
@media print { #bg { position: absolute; } body { overflow: visible; } #fit { transform: none !important; } }
${boardStyles(layout)}
</style>
</head>
<body>
<div id="bg"></div>
<div id="fit"><div class="hxdir ${layout}">${boardBodyHtml(board, boards)}</div></div>
<script>
// Scale the board to whatever screen it lands on — kiosk TVs, a laptop, a
// projector — without scrolling or clipping. ES5 on purpose (old smart TVs).
(function () {
  function fit() {
    var w = document.getElementById('fit');
    // Measure the board itself, not the full-width centring wrapper.
    var el = w && w.children ? w.children[0] : null;
    if (!el) return;
    w.style.transform = 'none';
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var h = el.offsetHeight, ww = el.offsetWidth;
    if (!h || !ww) return;
    w.style.transform = 'scale(' + Math.min(vh / h, vw / ww) + ')';
  }
  fit();
  setTimeout(fit, 60);
  setTimeout(fit, 400);
  if (window.addEventListener) window.addEventListener('resize', fit, false);
})();
</script>
</body>
</html>
`
}
