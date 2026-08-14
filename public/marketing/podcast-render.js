/* ══════════════════════════════════════════════════════════════════════
   Hexa Space — Podcast Room "coming soon" post.

   Single-image announcement for Instagram (4:5) and 小红书 (3:4). Shares the
   brand kit with the Private Offices carousel, so the two sit together in a
   feed: greige/olive palette, BigDaily display, the cube + 六合空间 lockup.

   Rendered by scripts/gen-podcast-post.mjs.
   ══════════════════════════════════════════════════════════════════════ */
import { C, W, F_DISPLAY, F_HEAD, F_BODY, LOGO_W, makeKit } from './carousel-render.js';

export { W, RATIOS, LOGO_W, LOGO_B } from './carousel-render.js';

const M = 84;

export const PHOTOS = [
  ['/marketing/podcast/mic.jpg',     'Shure mic + acoustic panel (portrait)'],
  ['/marketing/podcast/desk.jpg',    'RØDECaster on dark wood — moody'],
  ['/marketing/podcast/console.jpg', 'RØDECaster top-down'],
  ['/marketing/podcast/camera.jpg',  'Camera, teleprompter and monitor'],
];

/* Room is on Level 2 and is acoustically treated. Level and the 2-mic /
   2-seat setup are per Eric (12 Aug 2026) and supersede the seeded space
   record, which still says floor l5 / "4 seats" / "4-mic podcast booth".
   Spec strip is deliberately plain English — brand names read as feed noise.

   Three variants, each a different angle on the same announcement, so they can
   run as a series rather than one post repeated. Every one carries the tag,
   the spec strip and the contact block, so any of them works standalone. */
const COMMON_EN = {
  tag:'COMING SOON', corner:'LEVEL 2',
  spec:'2 MICS · 2 SEATS · CAMERA EQUIPMENT',
  cta:'hexaspace.com.au',
  foot:'830 Whitehorse Road',
};
const COMMON_ZH = {
  tag:'即将开放', corner:'二楼',
  spec:'2 支麦克风 · 2 个座位 · 摄影摄像设备',
  cta:'hexaspace.com.au',
  foot:'830 Whitehorse Road',
};

export const VARIANTS = ['mic', 'record', 'video'];

const COPY = {
  // 1 — the reveal. Names the thing.
  mic: {
    en: { ...COMMON_EN, img:'/marketing/podcast/mic.jpg', focus:88, scrim:80,
      title:'The Podcast\nRoom.',
      lede:'Acoustically treated. Two mics, two seats, and a room that sounds like it means it.' },
    zh: { ...COMMON_ZH, img:'/marketing/podcast/mic.jpg', focus:88, scrim:80,
      title:'播客录音室',
      lede:'专业隔音处理。两支麦克风，两个座位，一间真正为声音而生的房间。' },
  },
  // 2 — the invitation. Removes the excuse of setup.
  record: {
    en: { ...COMMON_EN, img:'/marketing/podcast/desk.jpg', focus:50, scrim:74,
      title:'Just press\nrecord.',
      lede:'Plugged in, levelled and waiting. Book the room, sit down, start talking.' },
    zh: { ...COMMON_ZH, img:'/marketing/podcast/desk.jpg', focus:50, scrim:74,
      title:'坐下\n就能录',
      lede:'设备已接好、调试完毕。订好房间，坐下来，开口就是。' },
  },
  // 3 — the upsell. Most people don't expect video.
  video: {
    en: { ...COMMON_EN, img:'/marketing/podcast/camera.jpg', focus:50, scrim:78,
      title:'Not just\naudio.',
      lede:'Camera gear on site, so every episode leaves as video too — ready to cut.' },
    zh: { ...COMMON_ZH, img:'/marketing/podcast/camera.jpg', focus:50, scrim:78,
      title:'不只是\n声音',
      lede:'现场配备摄影摄像设备，每一期都能同时产出视频，拍完即可剪。' },
  },
};

export function defaults(lang, variant = 'mic'){
  const v = COPY[variant] ? variant : 'mic';
  return JSON.parse(JSON.stringify(COPY[v][lang === 'zh' ? 'zh' : 'en']));
}

/**
 * Draw the post.
 * @param ctx     Canvas2D context sized W × H
 * @param p       copy object
 * @param images  { [src]: Image } — photo + white logo, pre-loaded
 * @param opts    { H, lang }
 */
export function renderPost(ctx, p, images, opts = {}){
  const H = opts.H || 1350;
  const k = makeKit(ctx, H, images, opts.lang || 'en');

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  k.coverDraw(p.img, 0, 0, W, H, p.focus);

  // The scrim stays light through the upper half so the mic keeps its shape,
  // then falls away fast under it to carry the type block.
  const s = p.scrim / 100;
  k.vGrad(0, 0, W, H, [
    [0, 'rgba(10,10,9,.44)'], [.22, 'rgba(10,10,9,.06)'],
    [.50, `rgba(10,10,9,${s * .20})`], [.66, `rgba(10,10,9,${s * .70})`],
    [.82, `rgba(10,10,9,${s * .94})`], [1, `rgba(10,10,9,${Math.min(1, s * 1.02)})`],
  ]);

  k.drawLogo(true);
  k.label(p.corner, W - M, M + 46, 'rgba(255,255,255,.88)', 16, 'right');

  // Bottom-anchored stack: address → cta → rule → spec → lede → headline.
  const specY = H - M - 104;
  ctx.font = `400 27px ${F_BODY}`;
  const ledeLines = k.wrap(p.lede, W - M * 2 - 20);
  const ledeY = specY - k.px(58) - (ledeLines.length - 1) * 40;

  ctx.font = `200 106px ${F_DISPLAY}`;
  const tl = k.wrap(p.title, W - M * 2);
  const blockH = (tl.length - 1) * 106 * .98;
  const titleY = ledeY - k.px(62) - blockH;

  // Olive tag, clearing the headline's cap height. Measured from the first
  // baseline only — CJK glyphs fill nearly the whole em, so a one-line 中文
  // headline needs as much headroom as a two-line Latin one.
  k.setFont(F_HEAD, 16, 600);
  const tw = k.trackedWidth(String(p.tag || '').toUpperCase(), 4.4);
  const tagY = titleY - k.px(178);
  ctx.fillStyle = C.olive; ctx.fillRect(M, tagY, tw + 40, 44);
  ctx.fillStyle = '#fff'; k.drawTracked(String(p.tag || '').toUpperCase(), M + 20, tagY + 29, 4.4);

  ctx.fillStyle = '#fff'; k.setFont(F_DISPLAY, 106, 200);
  tl.forEach((l, i) => ctx.fillText(l, M, titleY + i * 106 * .98));

  ctx.fillStyle = 'rgba(255,255,255,.82)'; k.setFont(F_BODY, 27, 400);
  ledeLines.forEach((l, i) => ctx.fillText(l, M, ledeY + i * 40));

  // spec strip — the gear is the flex, so it gets the cream accent
  k.label(p.spec, M, specY, C.cream, 15);

  k.hair(M, H - M - 76, W - M * 2, 'rgba(255,255,255,.34)');
  ctx.fillStyle = '#fff'; k.setFont(F_DISPLAY, 44, 200);
  ctx.fillText(String(p.cta || ''), M, H - M - 30);
  ctx.fillStyle = 'rgba(255,255,255,.62)'; k.setFont(F_BODY, 20, 400);
  ctx.fillText(String(p.foot || ''), M, H - M + 4);
}
