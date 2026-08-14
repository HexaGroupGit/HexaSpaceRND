# Marketing carousels

On-brand social cards built from the real photo library and the same brand
system as the proposal brochure (`src/lib/proposalPdf.js`): greige ground,
olive accent, BigDaily display / ReworkMicro labels / GT America body, and the
official cube + HEXA SPACE + 六合空间 lockup.

## Private Offices — 5-card carousel

Two ways to produce the PNGs. Both share one drawing engine
(`carousel-render.js`), so the preview and the exported files always match.

**Edit + export in the browser** — start the dev server (`npm run dev`), then open

    http://localhost:5173/marketing/private-offices-carousel.html

Edit every line of copy, swap photos, drag the crop and darkness sliders, and
download PNGs. Edits are kept per language and saved in the browser.

**Batch export from the command line**

    node scripts/gen-po-carousel.mjs                # English, both sizes
    node scripts/gen-po-carousel.mjs zh             # 中文
    node scripts/gen-po-carousel.mjs en,zh 45,34    # everything

Writes to `marketing-out/private-offices/<lang>/<w>x<h>/card-N.png` (gitignored).

### Sizes

| Ratio | Pixels     | Where                                            |
|-------|------------|--------------------------------------------------|
| 4:5   | 1080×1350  | Instagram — it crops anything taller              |
| 3:4   | 1080×1440  | 小红书 / Xiaohongshu — its native portrait ratio   |

### The five cards

1. **Hook** — corner suite, "A suite of your own"
2. **The centre** — 1,763 sqm · 43 offices · 8 meeting rooms · 3 levels
3. **Included** — ten inclusions, two columns
4. **Available** — the suites currently on offer, with status pills
5. **Contact** — book a tour, phone / email / web / address

### Card 4 is the one that goes stale

It is a hand-maintained availability list, **not** generated from the app.
Re-check it against Spaces → Private Offices before every post.

Row format is `name | detail | price | status`. Start the status with `*` to
fill its pill olive (available now); leave it plain for an outlined pill
(available soon). Clear a row entirely to drop it from the card.

Currently listed:

| Suite            | Desks | Rate        | Monthly | Status         |
|------------------|-------|-------------|---------|----------------|
| Suite 2, Level 4 | 5     | $650 / desk | $3,250  | Available soon |
| Suite 8, Level 4 | 4     | $650 / desk | $2,600  | Available soon |
| Suite 8, Level 2 | 4     | —           | $2,400  | Available now  |

Note there are two "Suite 8"s — one on each floor — so always keep the level
in the detail line. The desk counts match the seed data; the $650/desk and the
flat $2,400 are asking prices set above the standing `OFFICE_PRICING` card
rates in `src/components/spaces/shared.jsx`.

### Where the other numbers come from

- Centre stats and inclusions — the brochure pages in `src/lib/proposalPdf.js`
- Car park $200/mo, printing from $30/mo, meeting rooms from $20/hr with 30%
  off past credits — the brochure's inclusions page
- Phone `+61 406 016 666` — the proposal brochure's default contact

These are separate copies of the app's data. If a rate changes, change it here too.

### Photos

Sourced from `public/proposal/`. Two files carry photographer watermarks and
are labelled as such in the picker: `comm-hero.jpg` and `comm-2.jpg`. Avoid
them for full-bleed cards unless the watermark is cropped out.
