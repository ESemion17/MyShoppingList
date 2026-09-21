import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { parseReceiptImages } from './llm.ts'
import { corsHeaders } from '../_shared/cors.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // bypasses RLS — so we verify family membership manually below
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let receiptId: string | undefined
  try {
    const body = await req.json()
    receiptId = body.receipt_id

    // 1) verify the calling user belongs to the receipt's family
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    const { data: userRes } = await admin.auth.getUser(jwt)
    const userId = userRes?.user?.id
    if (!userId) return json({ error: 'unauthorized' }, 401)

    const { data: receipt } = await admin
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single()
    const { data: profile } = await admin
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single()
    if (!receipt || !profile || receipt.family_id !== profile.family_id) {
      return json({ error: 'forbidden' }, 403)
    }

    // 2) download the images from Storage → base64
    const images: string[] = []
    for (const path of receipt.image_paths ?? []) {
      const { data: blob, error } = await admin.storage.from('receipts').download(path)
      if (error || !blob) throw new Error('IMAGE_DOWNLOAD_FAILED')
      images.push(toBase64(new Uint8Array(await blob.arrayBuffer())))
    }
    if (images.length === 0) throw new Error('NO_IMAGES')

    // 3) call the model (through the provider abstraction)
    const parsed = await parseReceiptImages(images)

    // 4) compute real price + write the rows
    const rows = parsed.items.map((it) => ({
      receipt_id: receiptId,
      family_id: receipt.family_id,
      raw_name: it.raw_name,
      barcode: it.barcode,
      item_type: it.item_type,
      quantity: it.quantity,
      unit: it.unit,
      full_unit_price: it.unit_price,
      line_total: it.line_total,
      discount: it.discount,
      real_unit_price:
        it.line_total != null && it.quantity ? round(it.line_total / it.quantity) : it.unit_price,
      confidence: it.confidence,
    }))
    if (rows.length) await admin.from('receipt_items').insert(rows)

    await admin
      .from('receipts')
      .update({
        status: 'parsed',
        store_name: parsed.store.name,
        store_branch: parsed.store.branch,
        purchase_date: parsed.purchase.date,
        purchase_time: parsed.purchase.time,
        receipt_number: parsed.purchase.receipt_number,
        currency: parsed.purchase.currency,
        subtotal: parsed.totals.subtotal,
        total: parsed.totals.total,
        raw_model_json: parsed,
        error: null,
        parsed_at: new Date().toISOString(),
      })
      .eq('id', receiptId)

    return json({ ok: true })
  } catch (e) {
    // controlled failure: mark failed so the user can retry
    const msg = String(e).includes('RATE_LIMIT') ? 'rate_limit' : 'parse_failed'
    if (receiptId) {
      await admin.from('receipts').update({ status: 'failed', error: msg }).eq('id', receiptId)
    }
    return json({ error: msg }, 200)
  }
})

const round = (n: number) => Math.round(n * 100) / 100

// Chunked base64 encode — avoids call-stack overflow on large images.
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
