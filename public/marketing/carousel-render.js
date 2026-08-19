/* ══════════════════════════════════════════════════════════════════════
   Hexa Space — Private Offices carousel: the drawing engine.

   Pure Canvas2D, no DOM. Shared by two callers so what you edit in the
   browser is byte-identical to what the batch export writes:
     • private-offices-carousel.html  (edit + preview + download)
     • scripts/gen-po-carousel.mjs    (node, @napi-rs/canvas, all sizes)

   Brand system is lifted from src/lib/proposalPdf.js — the luxury brochure:
   greige ground, olive accent, BigDaily display / ReworkMicro labels /
   GT America body, and the official cube + HEXA SPACE + 六合空间 lockup.
   ══════════════════════════════════════════════════════════════════════ */

export const C = {
  greige:'#EFEDF2', bone:'#E7E4E9', ink:'#1b1b18', soft:'#6a6a63',
  line:'#c9c6cd', olive:'#7F8B2F', paper:'#f7f6f8', cream:'#c9d08a',
};

export const W = 1080;
export const RATIOS = { '45': 1350, '34': 1440 };   // IG 4:5 · 小红书 3:4

// Each stack names the face twice: `Hx*` is how the standalone editor and the
// node exporter register the OTFs, while 'Big Daily Short' / 'Rework Micro' /
// 'GT America' are the names the admin app's index.css already uses — so the
// same engine draws on-brand inside the RND app without duplicate @font-face
// rules. The CJK faces trail behind because the Hexa OTFs carry no CJK glyphs.
export const F_DISPLAY = `HxDisplay, 'Big Daily Short', 'Songti SC', SimSun, 'Source Han Serif SC', serif`;
export const F_HEAD    = `HxHeading, 'Rework Micro', 'PingFang SC', 'Microsoft YaHei', sans-serif`;
export const F_BODY    = `HxBody, 'GT America', 'PingFang SC', 'Microsoft YaHei', sans-serif`;

export const LOGO_W = '/marketing/brand/logo-white.png';
export const LOGO_B = '/marketing/brand/logo-black.png';
const LOGO_WIDTH = 252;

export const PHOTOS = [
  ['/proposal/private-office.jpg',  'Private suite — corner window'],
  ['/proposal/dd-3159.jpg',         'Open plan — planter bays'],
  ['/proposal/dd-3188.jpg',         'Open plan — booths & pods'],
  ['/proposal/reception.jpg',       'Reception & concierge'],
  ['/proposal/gallery-2.jpg',       'Lounge — round mirror'],
  ['/proposal/lounge-main.jpg',     'Lounge — leather sofa'],
  ['/proposal/meeting-room.jpg',    'Meeting room — boardroom'],
  ['/proposal/room-east.jpg',       'East — Chinese tearoom'],
  ['/proposal/comm-4.jpg',          'Members at work (portrait)'],
  ['/proposal/event-space.jpg',     'Event space'],
  ['/proposal/media-1.jpg',         'Media studio'],
  ['/proposal/hero-main.jpg',       'Hero'],
  ['/proposal/comm-hero.jpg',       'Community event  ⚠ watermarked'],
  ['/proposal/comm-2.jpg',          'Community drinks  ⚠ watermarked'],
];

export const TITLES = ['01 Hook', '02 The centre', '03 Included', '04 Available', '05 Contact'];

/* ── copy ──────────────────────────────────────────────────────────────
   Centre stats and inclusions come from the brochure pages in
   src/lib/proposalPdf.js. Card 4 is a live availability list — it is NOT
   generated from the app, so re-check it against Spaces → Private Offices
   before every post. Desk counts match the seed data (L4 Suite 2 = 5 pax,
   L4 Suite 8 = 4 pax, L2 Suite 8 = 4 pax); the $650/desk and the flat
   $2,400 are quoted asking prices, above the standing OFFICE_PRICING
   card rates.                                                          */
const EN = [
  { img:'/proposal/private-office.jpg', focus:52, scrim:70,
    eyebrow:'PRIVATE OFFICES',
    kicker:'BOX HILL · WHITEHORSE ROAD',
    title:'A suite\nof your own.',
    lede:'Furnished, lockable and ready on day one.',
    foot:'402/830 WHITEHORSE RD · BOX HILL',
    cta:'SWIPE →', zh:'独立办公室 · 博士山' },

  { img:'/proposal/reception.jpg', focus:50, scrim:0,
    eyebrow:'THE CENTRE',
    title:'1,763 sqm of\nserviced calm.',
    lede:'Three levels above Box Hill Central. Hotel-style amenity, hospitality-led service, and the privacy of your own door.',
    s1:'1,763|SQM CENTRE', s2:'43|PRIVATE OFFICES',
    s3:'8|MEETING ROOMS',  s4:'3|LEVELS',
    zh:'三层楼 · 1,763平方米' },

  { img:'/proposal/gallery-2.jpg', focus:52, scrim:0,
    eyebrow:'EVERYTHING INCLUDED',
    title:'No hidden\nextras.',
    listA:'24/7 secure access\nInternet 1000/1000 Mbps\nFurnished — desks & storage\nMonthly meeting-room credits\nDaily cleaning',
    listB:'Reception greets your clients\nMail collection & delivery\nTea, coffee & filtered water\nEnd-of-trip facilities\nEvent and networking opportunities',
    foot:'Parking $200/mo · Printing from $30/mo',
    zh:'一价全包，无隐藏费用' },

  // Live availability. Row format: name | meta | price | status
  // A leading * on the status fills the pill olive (available now).
  { img:'', focus:50, scrim:0,
    eyebrow:'AVAILABILITY',
    title:'Three suites\nopening up.',
    lede:'Per month, ex GST.',
    r1:'SUITE 2|LEVEL 4 · 5 DESKS · $650 PER DESK|$3,250|AVAILABLE SOON',
    r2:'SUITE 8|LEVEL 4 · 4 DESKS · $650 PER DESK|$2,600|AVAILABLE SOON',
    r3:'SUITE 8|LEVEL 2 · 4 DESKS|$2,400|*AVAILABLE NOW',
    foot:'Furnished and lockable. Assigned car park $200 pcm per bay, ex GST.',
    zh:'三间办公室即将开放' },

  { img:'/proposal/comm-4.jpg', focus:38, scrim:80,
    eyebrow:'BOOK A TOUR',
    title:'Come and\nsee it.',
    lede:'Tours weekdays. We’ll hold the suite while you decide.',
    c1:'PHONE|+61 406 016 666',
    c2:'EMAIL|info@hexaspace.com.au',
    c3:'WEB|hexaspace.com.au',
    foot:'402/830 Whitehorse Rd, Box Hill VIC 3128',
    zh:'预约参观 · 欢迎联系我们' },
];

const ZH = [
  { img:'/proposal/private-office.jpg', focus:52, scrim:70,
    eyebrow:'独立办公室',
    kicker:'博士山 · WHITEHORSE ROAD',
    title:'拥有一间\n属于自己的办公室',
    lede:'家具齐全，独立门禁，拎包入驻。',
    foot:'402/830 WHITEHORSE RD · BOX HILL',
    cta:'左滑 →', zh:'' },

  { img:'/proposal/reception.jpg', focus:50, scrim:0,
    eyebrow:'关于中心',
    title:'1,763 平方米\n的从容',
    lede:'位于博士山中心之上的三层空间。酒店级配套、专业的前台服务，以及一扇只属于你的门。',
    s1:'1,763|平方米', s2:'43|独立办公室',
    s3:'8|会议室',     s4:'3|楼层', zh:'' },

  { img:'/proposal/gallery-2.jpg', focus:52, scrim:0,
    eyebrow:'一价全包',
    title:'没有隐藏\n费用',
    listA:'24 小时门禁\n千兆光纤 1000/1000\n办公桌椅与储物柜齐全\n每月赠送会议室额度\n每日保洁',
    listB:'前台代为接待客户\n信件代收与转交\n咖啡、茶与净水\n淋浴更衣设施\n各类活动与社交机会',
    foot:'车位 $200/月 · 打印服务 $30/月起', zh:'' },

  { img:'', focus:50, scrim:0,
    eyebrow:'现有房源',
    title:'三间办公室\n即将开放',
    lede:'每月租金，不含 GST。',
    r1:'2 号房|4 楼 · 5 个工位 · 每工位 $650|$3,250|即将开放',
    r2:'8 号房|4 楼 · 4 个工位 · 每工位 $650|$2,600|即将开放',
    r3:'8 号房|2 楼 · 4 个工位|$2,400|*现可入驻',
    foot:'家具齐全，独立门禁。专属车位 $200/月（每个车位，不含 GST）。', zh:'' },

  { img:'/proposal/comm-4.jpg', focus:38, scrim:80,
    eyebrow:'预约参观',
    title:'欢迎来\n现场看看',
    lede:'工作日均可安排参观。看中的房间，我们会为你保留。',
    c1:'电话|+61 406 016 666',
    c2:'邮箱|info@hexaspace.com.au',
    c3:'网站|hexaspace.com.au',
    foot:'402/830 Whitehorse Rd, Box Hill VIC 3128', zh:'' },
];

export function defaults(lang){
  return JSON.parse(JSON.stringify(lang === 'zh' ? ZH : EN));
}

/* ── drawing primitives ────────────────────────────────────────────── */
const M = 84;   // page margin

// The shared drawing kit — tracked micro-type, CJK-aware wrapping, cover-fit
// photos, the logo lockup. Exported so other posts can be built in the same
// hand without duplicating any of it.
export function makeKit(ctx, H, images, lang){
  const px = (n) => n * (H / 1350);          // vertical rhythm follows height
  const img = (src) => images[src] || null;
  const bi  = lang === 'bi';

  const setFont = (family, size, weight) => { ctx.font = `${weight || 400} ${size}px ${family}` };

  // Uppercase micro-type is drawn glyph-by-glyph so the wide brand tracking
  // survives — canvas letterSpacing isn't portable across engines.
  const trackedWidth = (t, sp) => {
    let w = 0; for (const ch of t) w += ctx.measureText(ch).width + sp;
    return w - (t.length ? sp : 0);
  };
  const drawTracked = (t, x, y, sp, align) => {
    let cx = x;
    if (align === 'right')  cx = x - trackedWidth(t, sp);
    if (align === 'center') cx = x - trackedWidth(t, sp) / 2;
    for (const ch of t){ ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp }
  };

  // Wrap honouring hard newlines; CJK runs (no spaces) break per character.
  const wrap = (text, maxW) => {
    const out = [];
    for (const p of String(text ?? '').split('\n')){
      if (!p){ out.push(''); continue }
      if (ctx.measureText(p).width <= maxW){ out.push(p); continue }
      if (/\s/.test(p.trim())){
        let line = '';
        for (const word of p.split(/\s+/)){
          const test = line ? line + ' ' + word : word;
          if (ctx.measureText(test).width > maxW && line){ out.push(line); line = word }
          else line = test;
        }
        if (line) out.push(line);
      } else {
        let line = '';
        for (const ch of p){
          if (ctx.measureText(line + ch).width > maxW && line){ out.push(line); line = ch }
          else line += ch;
        }
        if (line) out.push(line);
      }
    }
    return out;
  };

  const coverDraw = (src, x, y, w, h, focus) => {
    const im = img(src); if (!im) return;
    const ir = im.width / im.height, br = w / h;
    let sw, sh, sx, sy;
    if (ir > br){ sh = im.height; sw = sh * br; sy = 0; sx = (im.width - sw) / 2 }
    else        { sw = im.width;  sh = sw / br; sx = 0; sy = (im.height - sh) * (focus / 100) }
    ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  };

  const vGrad = (x, y, w, h, stops) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  };
  const hair = (x, y, w, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, 1) };

  const eyebrow = (t, x, y, color) => {
    ctx.fillStyle = color; setFont(F_HEAD, 17, 600);
    drawTracked(String(t || '').toUpperCase(), x, y, 4.6);
  };
  const label = (t, x, y, color, size, align) => {
    ctx.fillStyle = color; setFont(F_HEAD, size || 19, 600);
    drawTracked(String(t || '').toUpperCase(), x, y, (size || 19) * .16, align);
  };

  // Official lockup, top-left, identical optical size on every card.
  const drawLogo = (onDark) => {
    const im = img(onDark ? LOGO_W : LOGO_B);
    if (!im) return M + 74;
    const h = LOGO_WIDTH * (im.height / im.width);
    ctx.drawImage(im, M, M, LOGO_WIDTH, h);
    return M + h;
  };

  // Bilingual mode drops a 中文 line beneath the English headline.
  const zhLine = (c, x, y, color, size) => {
    if (!bi || !c.zh) return y;
    ctx.fillStyle = color; setFont(F_BODY, size || 30, 400);
    ctx.fillText(c.zh, x, y);
    return y + (size || 30) * 1.5;
  };
  const zhGap = (c, n) => (bi && c.zh ? n : 0);

  return { px, setFont, trackedWidth, drawTracked, wrap, coverDraw, vGrad,
           hair, eyebrow, label, drawLogo, zhLine, zhGap };
}

/* ── the five cards ────────────────────────────────────────────────── */
function cover(ctx, c, k, H){
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  k.coverDraw(c.img, 0, 0, W, H, c.focus);
  k.vGrad(0, 0, W, H, [[0,'rgba(14,14,11,.54)'],[.30,'rgba(14,14,11,.10)'],
                       [.58,`rgba(14,14,11,${(c.scrim/100)*.55})`],[1,`rgba(14,14,11,${c.scrim/100})`]]);

  k.drawLogo(true);
  k.label(c.eyebrow, W - M, M + 46, 'rgba(255,255,255,.88)', 16, 'right');

  // headline block anchored up from the footer rule
  k.setFont(F_DISPLAY, 104, 200);
  const tl = k.wrap(c.title, W - M * 2);
  const ledeH = k.wrap(c.lede, W - M * 2 - 60).length * 44;
  const blockH = (tl.length - 1) * 104 * .99;
  let y = H - M - 62 - 54 - ledeH - k.zhGap(c, 52) - blockH;

  k.label(c.kicker, M, y - blockH - 66, C.cream, 16);

  ctx.fillStyle = '#fff'; k.setFont(F_DISPLAY, 104, 200);
  tl.forEach((l, i) => ctx.fillText(l, M, y + i * 104 * .99));
  let ny = y + blockH + 56;
  ny = k.zhLine(c, M, ny, 'rgba(255,255,255,.86)', 34);

  ctx.fillStyle = 'rgba(255,255,255,.80)'; k.setFont(F_BODY, 30, 400);
  k.wrap(c.lede, W - M * 2 - 60).forEach((l, i) => ctx.fillText(l, M, ny + i * 44));

  k.hair(M, H - M - 62, W - M * 2, 'rgba(255,255,255,.34)');
  k.label(c.foot, M, H - M - 24, 'rgba(255,255,255,.72)', 16);
  k.label(c.cta,  W - M, H - M - 24, C.cream, 16, 'right');
}

function stats(ctx, c, k, H){
  ctx.fillStyle = C.greige; ctx.fillRect(0, 0, W, H);
  const bandH = Math.round(H * .47);
  k.coverDraw(c.img, 0, 0, W, bandH, c.focus);
  k.vGrad(0, 0, W, 300, [[0,'rgba(14,14,11,.48)'],[1,'rgba(14,14,11,0)']]);
  k.drawLogo(true);

  // the display face has a tall ascender — the eyebrow needs its cap-height clear
  let y = bandH + 92;
  k.eyebrow(c.eyebrow, M, y, C.olive); y += 92;

  ctx.fillStyle = C.ink; k.setFont(F_DISPLAY, 82, 200);
  const tl = k.wrap(c.title, W - M * 2);
  tl.forEach((l, i) => ctx.fillText(l, M, y + i * 82 * .99));
  y += (tl.length - 1) * 82 * .99 + 62;
  y = k.zhLine(c, M, y, C.soft, 30);

  ctx.fillStyle = '#33332e'; k.setFont(F_BODY, 26, 400);
  k.wrap(c.lede, W - M * 2 - 20).forEach((l, i) => ctx.fillText(l, M, y + i * 45));

  const railY = H - M - 96;
  k.hair(M, railY - 46, W - M * 2, C.line);
  const cells = [c.s1, c.s2, c.s3, c.s4].filter(Boolean);
  const cw = (W - M * 2) / cells.length;
  cells.forEach((cell, i) => {
    const [n, l] = String(cell).split('|');
    const x = M + i * cw;
    ctx.fillStyle = C.ink; k.setFont(F_DISPLAY, 60, 200); ctx.fillText(n || '', x, railY + 22);
    k.label(l || '', x, railY + 58, C.soft, 14);
  });
}

function list(ctx, c, k, H){
  ctx.fillStyle = C.greige; ctx.fillRect(0, 0, W, H);
  const bandH = Math.round(H * .28);
  k.coverDraw(c.img, 0, H - bandH, W, bandH, c.focus);

  let y = k.drawLogo(false) + 72;
  k.eyebrow(c.eyebrow, M, y, C.olive); y += 96;

  ctx.fillStyle = C.ink; k.setFont(F_DISPLAY, 86, 200);
  const tl = k.wrap(c.title, W - M * 2);
  tl.forEach((l, i) => ctx.fillText(l, M, y + i * 86 * .99));
  y += (tl.length - 1) * 86 * .99 + 60;
  y = k.zhLine(c, M, y, C.soft, 30);

  k.hair(M, y - 4, W - M * 2, C.line);
  y += 54;

  // two bullet columns with the brochure's olive square marker. The step
  // stretches to fill the space down to the footnote so the card never
  // strands a dead zone above the photo band.
  const colW = (W - M * 2 - 44) / 2;
  const cols = [String(c.listA || '').split('\n'), String(c.listB || '').split('\n')];
  const footY = H - bandH - 44;
  const rows = Math.max(1, ...cols.map((a) => a.filter(Boolean).length));
  const step = Math.max(k.px(48), Math.min(k.px(70), (footY - 54 - y) / rows));
  cols.forEach((items, ci) => {
    const x = M + ci * (colW + 44);
    items.filter(Boolean).forEach((raw, i) => {
      const yy = y + i * step;
      ctx.fillStyle = C.olive; ctx.fillRect(x, yy - 11, 7, 7);
      ctx.fillStyle = '#2c2c26'; k.setFont(F_HEAD, 16.5, 600);
      k.wrap(raw.toUpperCase(), colW - 24).forEach((l, li) => k.drawTracked(l, x + 22, yy + li * 24, 2.1));
    });
  });

  ctx.fillStyle = C.soft; k.setFont(F_BODY, 22, 400);
  ctx.fillText(String(c.foot || ''), M, footY);
}

function suites(ctx, c, k, H){
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);

  let y = k.drawLogo(true) + 78;
  k.eyebrow(c.eyebrow, M, y, C.cream); y += 112;

  ctx.fillStyle = '#fff'; k.setFont(F_DISPLAY, 98, 200);
  const tl = k.wrap(c.title, W - M * 2);
  tl.forEach((l, i) => ctx.fillText(l, M, y + i * 98 * .97));
  y += (tl.length - 1) * 98 * .97 + 66;
  y = k.zhLine(c, M, y, 'rgba(255,255,255,.78)', 30);

  ctx.fillStyle = 'rgba(255,255,255,.60)'; k.setFont(F_BODY, 25, 400);
  ctx.fillText(String(c.lede || ''), M, y);

  // Availability rows: name + status pill, meta beneath, price hard right.
  // Anchored between the lede and the footnote so the slack splits evenly
  // instead of stranding a dead zone at the bottom.
  const rows = [c.r1, c.r2, c.r3].filter(Boolean);
  const footLines = k.wrap(c.foot, W - M * 2);
  const RH = k.px(116);
  const tableH = rows.length * RH;
  const top    = y + k.px(78);
  const bottom = H - M - 44 - (footLines.length - 1) * 32 - k.px(76) - tableH;
  y = bottom > top ? top + (bottom - top) * .42 : top;   // sit slightly high

  rows.forEach((row) => {
    const [name = '', meta = '', priceTxt = '', statusRaw = ''] = String(row).split('|');
    k.hair(M, y, W - M * 2, 'rgba(255,255,255,.18)');
    y += k.px(52);

    // measure the name at its own size before the pill switches fonts
    k.setFont(F_HEAD, 22, 600);
    const nameW = k.trackedWidth(name.toUpperCase(), 22 * .16);
    k.label(name, M, y, '#fff', 22);

    // status pill — filled olive when the status is starred (available now)
    const live = statusRaw.startsWith('*');
    const status = statusRaw.replace(/^\*/, '');
    if (status){
      k.setFont(F_HEAD, 12, 600);
      const sw = k.trackedWidth(status.toUpperCase(), 3);
      const sx = M + nameW + 26;
      const sy = y - 21;
      if (live){ ctx.fillStyle = C.olive; ctx.fillRect(sx, sy, sw + 28, 28) }
      else {
        ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + .5, sy + .5, sw + 27, 27);
      }
      ctx.fillStyle = live ? '#fff' : 'rgba(255,255,255,.66)';
      k.drawTracked(status.toUpperCase(), sx + 14, sy + 19, 3);
    }

    // price, hard right, on the name's baseline
    k.setFont(F_DISPLAY, 54, 200);
    ctx.fillStyle = live ? C.cream : '#fff';
    ctx.fillText(priceTxt, W - M - ctx.measureText(priceTxt).width, y + 8);

    y += k.px(32);
    k.label(meta, M, y, 'rgba(255,255,255,.52)', 14);
    y += RH - k.px(84);
  });
  k.hair(M, y, W - M * 2, 'rgba(255,255,255,.18)');

  ctx.fillStyle = 'rgba(255,255,255,.50)'; k.setFont(F_BODY, 21, 400);
  footLines.forEach((l, i) => ctx.fillText(l, M, H - M - 40 - (footLines.length - 1 - i) * 32));
}

function contact(ctx, c, k, H){
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  k.coverDraw(c.img, 0, 0, W, H, c.focus);
  k.vGrad(0, 0, W, H, [[0,'rgba(12,12,10,.54)'],[.26,'rgba(12,12,10,.24)'],
                       [.52,`rgba(12,12,10,${(c.scrim/100)*.76})`],[1,`rgba(12,12,10,${Math.min(1,(c.scrim/100)*1.06)})`]]);

  const logoBottom = k.drawLogo(true);

  // olive tag
  k.setFont(F_HEAD, 16, 600);
  const tw = k.trackedWidth(String(c.eyebrow || '').toUpperCase(), 4.4);
  const tagY = logoBottom + 38;
  ctx.fillStyle = C.olive; ctx.fillRect(M, tagY, tw + 40, 44);
  ctx.fillStyle = '#fff'; k.drawTracked(String(c.eyebrow || '').toUpperCase(), M + 20, tagY + 29, 4.4);

  // The whole stack is anchored up from the contact rows, which are in turn
  // pinned above the address line — so nothing can collide at either height.
  const contacts = [c.c1, c.c2, c.c3].filter(Boolean);
  const CH = k.px(62);                       // per contact row
  const blockTop = H - M - 76 - contacts.length * CH + k.px(34);

  ctx.font = `400 26px ${F_BODY}`;
  const ledeLines = k.wrap(c.lede, W - M * 2 - 40);
  const ledeY = blockTop - k.px(34) - 62 - (ledeLines.length - 1) * 38;

  k.setFont(F_DISPLAY, 104, 200);
  const tl = k.wrap(c.title, W - M * 2);
  const blockH = (tl.length - 1) * 104 * .99;
  const y = ledeY - 58 - k.zhGap(c, 48) - blockH;

  ctx.fillStyle = '#fff';
  tl.forEach((l, i) => ctx.fillText(l, M, y + i * 104 * .99));
  let ny = y + blockH + 58;
  ny = k.zhLine(c, M, ny, 'rgba(255,255,255,.86)', 32);

  ctx.fillStyle = 'rgba(255,255,255,.78)'; k.setFont(F_BODY, 26, 400);
  ledeLines.forEach((l, i) => ctx.fillText(l, M, ny + i * 38));

  // contact rows — tracked label in a fixed left column, value alongside
  let cy = blockTop;
  contacts.forEach((row) => {
    const [lab = '', val = ''] = String(row).split('|');
    k.hair(M, cy - k.px(34), W - M * 2, 'rgba(255,255,255,.22)');
    k.label(lab, M, cy, C.cream, 14);
    ctx.fillStyle = '#fff'; k.setFont(F_BODY, 30, 400);
    ctx.fillText(val, M + 200, cy + 3);
    cy += CH;
  });
  k.hair(M, cy - k.px(34), W - M * 2, 'rgba(255,255,255,.22)');

  ctx.fillStyle = 'rgba(255,255,255,.62)'; k.setFont(F_BODY, 21, 400);
  ctx.fillText(String(c.foot || ''), M, H - M - 14);
}

const CARDS = [cover, stats, list, suites, contact];

/**
 * Draw one card.
 * @param ctx     Canvas2D context, already sized W × H
 * @param card    the copy object for this card
 * @param index   0-4
 * @param images  { [src]: Image }  — photos + both logos, pre-loaded
 * @param opts    { H, lang }  lang: 'en' | 'zh' | 'bi'
 */
export function renderCard(ctx, card, index, images, opts = {}){
  const H = opts.H || RATIOS['45'];
  const lang = opts.lang || 'en';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.greige; ctx.fillRect(0, 0, W, H);
  CARDS[index](ctx, card, makeKit(ctx, H, images, lang), H);
}
