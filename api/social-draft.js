// POST /api/social-draft — prompt in, on-brand social posts out.
//
// The admin types a brief ("podcast room opening, push the video angle") and
// Claude returns copy for N posts shaped exactly like the fields the canvas
// renderer draws (public/marketing/podcast-render.js → renderPost). Nothing is
// rendered here — the browser draws the PNGs so the admin can edit and
// re-render without another API call.
//
// Requires ANTHROPIC_API_KEY; returns 503 until it's set.
import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from './_auth.js'

export const config = { maxDuration: 60 }

// Ground truth. Claude is told to use ONLY these numbers so a post can never
// invent a rate — everything here mirrors the app's own data.
const FACTS = `HEXA SPACE — the facts you may state. Never invent numbers.

Location: 402/830 Whitehorse Road, Box Hill VIC 3128, Melbourne.
  In copy write the address as "830 Whitehorse Road, Box Hill" (no unit number).
Web: hexaspace.com.au · Phone: +61 406 016 666 · Email: info@hexaspace.com.au
Brand names: "Hexa Space" and 六合空间. NEVER "HexaHub".
Slogan: build locally, scale sustainably.

The centre: 1,763 sqm across three levels (2, 4, 5) above Box Hill Central.
  43 private offices · 8 meeting rooms · media studios · podcast room.

Private offices: per desk per month, ex GST.
  Level 2 — $400 internal / $500 external. Level 4 & 5 — $500 internal / $600 external.
  Incentive for new members: 6-month term = 1 month free; 12-month = 3 months free.
Desks: dedicated $500/mo, flexible $300/mo. Virtual office $75/mo.
Meeting rooms from $20/hr; 30% off once monthly credits are used.
Car park $200/mo per bay. Printing from $30/mo.
Podcast Room: Level 2, acoustically treated, 2 mics, 2 seats, camera equipment.

Included with a membership: 24/7 secure access; internet 1000/1000; furnished
desks and storage; monthly meeting-room credits; daily cleaning; reception
greets clients; mail handling; tea, coffee and filtered water; end-of-trip
facilities; events and networking opportunities.`

const SYSTEM = `You write Instagram and 小红书 (Xiaohongshu) posts for Hexa Space.

VOICE — quiet luxury, Australian English. Short declarative sentences. Concrete
over promotional. Never exclamation marks, never "unlock", "elevate",
"game-changing", "nestled", "state-of-the-art". Confident and plain: the space
speaks for itself. Think a considered property brochure, not a sales flyer.

LAYOUT CONSTRAINTS — the copy is typeset onto a photo in a fixed template, so
length is not negotiable:
  title  — the hero line in a large display serif. AT MOST 22 characters per
           line and AT MOST 2 lines, separated by a single \n. Break the line
           where it reads best. Ending with a full stop is the house style.
  lede   — one sentence, 60-110 characters. Never repeats the title.
  spec   — 3 short facts joined by " · ", UPPERCASE, under 44 characters total.
  tag    — 1-3 words for a small olive pill, e.g. COMING SOON, NOW LEASING.
  corner — a short locator for the top-right, e.g. LEVEL 2, BOX HILL.

Each post in a set must make a DIFFERENT argument — never restate one idea.
A good set moves: name the thing → remove an objection → reveal what they did
not expect → ask for the visit.

For Chinese posts write natural, elegant 中文 (not translated-sounding); the
same length rules apply but count characters, so a title line is at most 9
Chinese characters.

Pick the photo whose subject matches what each post is about.

${FACTS}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI drafting is not configured yet — add ANTHROPIC_API_KEY in Vercel.' })
  }

  const { brief, count = 3, lang = 'en', photos = [], context = '' } = req.body ?? {}
  if (!brief?.trim()) return res.status(400).json({ error: 'Tell me what the posts are about.' })

  const n = Math.min(Math.max(Number(count) || 3, 1), 6)
  const photoKeys = (photos ?? []).map((p) => p.key).filter(Boolean)
  if (!photoKeys.length) return res.status(400).json({ error: 'No photo library supplied.' })
  const photoList = (photos ?? []).map((p) => `  ${p.key} — ${p.label}`).join('\n')

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 8000,
      system: SYSTEM,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              posts: {
                type: 'array',
                minItems: n,
                maxItems: n,
                items: {
                  type: 'object',
                  properties: {
                    angle: { type: 'string', description: 'A 2-4 word note to the admin on what this post argues. Not printed.' },
                    tag: { type: 'string', description: 'Olive pill, 1-3 words, e.g. COMING SOON' },
                    corner: { type: 'string', description: 'Top-right locator, e.g. LEVEL 2' },
                    title: { type: 'string', description: 'Hero line. Max 2 lines separated by \n, max 22 chars per line.' },
                    lede: { type: 'string', description: 'One sentence, 60-110 characters.' },
                    spec: { type: 'string', description: '3 facts joined by " · ", uppercase, under 44 chars.' },
                    cta: { type: 'string', description: 'Usually hexaspace.com.au' },
                    foot: { type: 'string', description: 'Address line: 830 Whitehorse Road, Box Hill VIC 3128' },
                    photo: { type: 'string', enum: photoKeys, description: 'Which library photo suits this post' },
                  },
                  required: ['angle', 'tag', 'corner', 'title', 'lede', 'spec', 'cta', 'foot', 'photo'],
                  additionalProperties: false,
                },
              },
              caption: { type: 'string', description: 'One Instagram caption for the set, with 4-6 hashtags on the last line.' },
            },
            required: ['posts', 'caption'],
            additionalProperties: false,
          },
        },
      },
      messages: [{
        role: 'user',
        content: `Write ${n} post${n > 1 ? 's' : ''} in ${lang === 'zh' ? 'Chinese (中文)' : 'English'}.

Brief from the admin:
${brief.trim()}

Photos available (choose by key):
${photoList}
${context ? `\nLive data you may draw on:\n${context}` : ''}`,
      }],
    })

    if (response.stop_reason === 'refusal') {
      return res.status(400).json({ error: 'The assistant declined that brief — try rephrasing it.' })
    }
    const text = response.content.find((b) => b.type === 'text')?.text ?? ''
    const draft = JSON.parse(text)
    return res.status(200).json({ posts: draft.posts ?? [], caption: draft.caption ?? '' })
  } catch (err) {
    console.error('social-draft error:', err)
    return res.status(500).json({ error: 'Could not draft the posts — try again.' })
  }
}
