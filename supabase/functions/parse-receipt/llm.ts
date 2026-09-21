import { ReceiptParse } from './schema.ts'

// --- To swap providers, change ONLY these three: ---
const BASE_URL = 'https://integrate.api.nvidia.com/v1'
const MODEL = 'nvidia/nemotron-nano-2-vl' // ← verify the exact string on the model page at build.nvidia.com
const API_KEY = Deno.env.get('NVIDIA_API_KEY')!
// ---------------------------------------------------

const SYSTEM_PROMPT = `
You are a receipt-reading assistant for an Israeli grocery app. The receipt image(s) are in Hebrew.
Return ONLY one JSON object — no markdown, no code fences, no text before or after it — matching this shape:
{
  "store": { "name": string|null, "branch": string|null, "address": string|null },
  "purchase": { "date": "YYYY-MM-DD"|null, "time": string|null, "receipt_number": string|null, "currency": string },
  "items": [ { "raw_name": string, "barcode": string|null, "item_type": "product"|"deposit"|"other",
    "quantity": number, "unit": "unit"|"kg"|"liter", "unit_price": number|null,
    "line_total": number|null, "discount": number, "confidence": "high"|"low" } ],
  "totals": { "subtotal": number|null, "total": number|null },
  "warnings": string[]
}
Rules:
- Report prices EXACTLY as printed. Do NOT calculate. unit_price = full printed price per unit;
  line_total = printed line amount after discount; discount = discount amount shown, else 0.
- unit: "kg" for items sold by weight, "liter" by volume, otherwise "unit".
- item_type: "deposit" for פיקדון lines; "other" for bags / rounding / club fees / any non-product line; else "product".
- If a field is not clearly readable, use null. NEVER guess a barcode. Mark uncertain items confidence:"low".
- Keep raw_name exactly as printed (Hebrew).
`.trim()

// Each image as a data URL in OpenAI-compatible format.
// NOTE: some NIM models expect the image embedded inside the text content (<img src="data:...">)
// and large images via the Assets API. Verify the image format on the model page.
async function callModel(imagesBase64: string[], extraInstruction = ''): Promise<string> {
  const imageParts = imagesBase64.map((b64) => ({
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${b64}` },
  }))

  const userText = extraInstruction
    ? `Extract this receipt. ${extraInstruction}`
    : 'Extract this receipt.'

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: [...imageParts, { type: 'text', text: userText }] },
      ],
    }),
  })

  if (res.status === 429) throw new Error('RATE_LIMIT')
  if (!res.ok) throw new Error(`LLM_HTTP_${res.status}`)

  const data = await res.json()
  return (data.choices?.[0]?.message?.content ?? '') as string
}

function extractJson(text: string): unknown {
  // Defensive: strip fences and grab the outermost JSON object.
  let clean = text.replace(/```json|```/g, '').trim()
  const first = clean.indexOf('{')
  const last = clean.lastIndexOf('}')
  if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1)
  return JSON.parse(clean)
}

/**
 * The only function the rest of the system calls.
 * Three layers of defense (spec §9): JSON-only prompt, defensive parse + schema
 * validation, and one retry before giving up.
 */
export async function parseReceiptImages(imagesBase64: string[]): Promise<ReceiptParse> {
  try {
    const text = await callModel(imagesBase64)
    return ReceiptParse.parse(extractJson(text))
  } catch (err) {
    if (err instanceof Error && err.message === 'RATE_LIMIT') throw err
    // one retry with a stricter reminder
    const text = await callModel(
      imagesBase64,
      'Return STRICT valid JSON only, matching the schema exactly. No prose, no code fences.',
    )
    return ReceiptParse.parse(extractJson(text))
  }
}
