// Vercel serverless function — POST /api/parse-pricelist
// Reads a Found Huntingdale lease price-list PDF with Claude and returns the
// units as structured JSON for reconciliation against RND spaces.
// Requires env var: ANTHROPIC_API_KEY.
//
// Body: { data: <base64 PDF (no data: prefix)> }

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-4-8'

export const config = { maxDuration: 60, api: { bodyParser: { sizeLimit: '12mb' } } }

const PROMPT = `This is a commercial lease price list for "Found Huntingdale" (Huntingdale, Melbourne). It has TWO sections: "Warehouses - Leasing Pricelist" and "Storage Spaces - Leasing Pricelist".

Extract EVERY unit row from BOTH sections. For each unit return:
- unitNumber: the "Lot" code exactly as shown (e.g. "O5", "O15", "61W"). STORAGE units have no Lot code — for those, use the street-address identifier shown (e.g. "25/18 Logistic Ct") as the unitNumber.
- type: "warehouse" for units in the Warehouses section (Lot codes start with "O" or end in "W"); "storage" for units in the Storage Spaces section (Block column shows "Store").
- size: the "Total m²" value as a string with unit, e.g. "240 m²".
- address: the Street Address shown (e.g. "11 Distribution Cct", "25/18 Logistic Ct").
- monthlyRate: the "Lease Price" as a WHOLE-DOLLAR NUMBER PER MONTH, ex-GST. These prices are ANNUAL ex-GST — divide by 12 and round to the nearest whole dollar. No "$" or commas.
- status: map the Availability column — "Now" or "Available" → "vacant"; "Under Offer" → "reserved"; "Leased" or "Unavailable" → "occupied". Default "vacant" if blank.
- cars: the Cars number (0 if none/blank — storage units have none).
- attributes: the Attributes text (or "").

Return ONLY a JSON object of the form {"units":[ ... ]} with no markdown, no commentary.`

function parseJson(text) {
  let t = text.trim()
  if (t.startsWith('```')) t = t.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
  return JSON.parse(t)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { data } = req.body ?? {}
  if (!data) return res.status(400).json({ error: 'Missing PDF data' })

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    if (message.stop_reason === 'refusal') return res.status(422).json({ error: 'Request declined.' })
    const raw = (message.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    let parsed
    try { parsed = parseJson(raw) } catch { return res.status(502).json({ error: 'Could not parse the price list. Is it the standard format?' }) }
    return res.status(200).json({ units: parsed.units ?? [] })
  } catch (err) {
    console.error('parse-pricelist error:', err)
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500
    return res.status(status).json({ error: err?.message ?? 'Parse failed' })
  }
}
