import { supabase, RECEIPTS_BUCKET } from '@/lib/supabase'
import { round2, toDateOnly } from '@/lib/format'
import { bestMatch } from '@/lib/fuzzy'
import type { Product, Receipt, ReceiptItem } from '@/lib/database.types'

export type MatchChoice = string // product id | 'NEW' | 'SKIP'
export const NEW_PRODUCT = 'NEW'
export const SKIP_MATCH = 'SKIP'

/**
 * Suggest a match for each product line (spec §7.2):
 * barcode first (trusted), then fuzzy name match, else "create new".
 */
export function suggestMatches(
  items: ReceiptItem[],
  products: Product[],
): Record<string, MatchChoice> {
  const byBarcode = new Map<string, Product>()
  for (const p of products) if (p.barcode) byBarcode.set(p.barcode, p)

  const result: Record<string, MatchChoice> = {}
  for (const item of items) {
    if (item.item_type !== 'product') {
      result[item.id] = SKIP_MATCH
      continue
    }
    if (item.barcode && byBarcode.has(item.barcode)) {
      result[item.id] = byBarcode.get(item.barcode)!.id
      continue
    }
    const fuzzy = bestMatch(item.raw_name, products, (p) => p.name, 0.72)
    result[item.id] = fuzzy ? fuzzy.item.id : NEW_PRODUCT
  }
  return result
}

export function realUnitPrice(item: Pick<ReceiptItem, 'line_total' | 'quantity' | 'full_unit_price'>) {
  if (item.line_total != null && item.quantity) return round2(item.line_total / item.quantity)
  return item.full_unit_price ?? null
}

/** Sanity check: line_total ≈ quantity × unit_price − discount (spec §7.3). */
export function lineTotalMismatch(item: ReceiptItem): boolean {
  if (item.line_total == null || item.full_unit_price == null) return false
  const expected = item.quantity * item.full_unit_price - (item.discount ?? 0)
  return Math.abs(expected - item.line_total) > 0.1
}

interface ConfirmResult {
  productsCreated: number
  priceRows: number
  autoMarked: number
}

/**
 * Confirm a parsed receipt:
 *  - match / create products, write matched_product_id + real_unit_price
 *  - write price_history rows
 *  - auto-mark matching shopping-list items as bought
 *  - flip receipt → confirmed and delete the images from Storage
 */
export async function confirmReceipt(
  receipt: Receipt,
  items: ReceiptItem[],
  choices: Record<string, MatchChoice>,
): Promise<ConfirmResult> {
  const familyId = receipt.family_id
  const purchaseDate = receipt.purchase_date ?? toDateOnly(new Date())

  // fresh product list for barcode dedup
  const { data: existing } = await supabase
    .from('products')
    .select('*')
    .eq('family_id', familyId)
  const products = (existing ?? []) as Product[]
  const byBarcode = new Map<string, Product>()
  for (const p of products) if (p.barcode) byBarcode.set(p.barcode, p)

  let productsCreated = 0
  const priceRows: Array<Record<string, unknown>> = []
  const productMeta = new Map<string, { price: number | null; store: string | null }>()

  for (const item of items) {
    if (item.item_type !== 'product') continue
    const choice = choices[item.id] ?? NEW_PRODUCT
    if (choice === SKIP_MATCH) continue

    let productId: string | null = null
    if (choice !== NEW_PRODUCT) {
      productId = choice
    } else if (item.barcode && byBarcode.has(item.barcode)) {
      productId = byBarcode.get(item.barcode)!.id
    } else {
      const { data: created, error } = await supabase
        .from('products')
        .insert({
          family_id: familyId,
          name: item.raw_name,
          barcode: item.barcode,
          default_unit: item.unit,
          category_id: null,
        })
        .select()
        .single()
      if (error) throw error
      productId = (created as Product).id
      productsCreated++
      if (item.barcode) byBarcode.set(item.barcode, created as Product)
    }

    const real = realUnitPrice(item)

    // update the receipt line with its match + computed real price
    await supabase
      .from('receipt_items')
      .update({ matched_product_id: productId, real_unit_price: real })
      .eq('id', item.id)

    if (real != null) {
      priceRows.push({
        family_id: familyId,
        product_id: productId,
        receipt_item_id: item.id,
        real_unit_price: real,
        full_unit_price: item.full_unit_price,
        unit: item.unit,
        store_name: receipt.store_name,
        purchase_date: purchaseDate,
      })
    }
    if (!productMeta.has(productId)) {
      productMeta.set(productId, { price: real, store: receipt.store_name })
    }
  }

  // write price history
  if (priceRows.length) {
    const { error } = await supabase.from('price_history').insert(priceRows)
    if (error) throw error
  }

  // auto-mark shopping-list items whose product was purchased
  let autoMarked = 0
  for (const [productId, meta] of productMeta) {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .update({
        status: 'bought',
        bought_at: new Date().toISOString(),
        bought_price: meta.price,
        bought_store: meta.store,
        bought_source: 'receipt',
      })
      .eq('family_id', familyId)
      .eq('product_id', productId)
      .eq('status', 'active')
      .select('id')
    if (error) throw error
    autoMarked += data?.length ?? 0
  }

  // flip receipt to confirmed
  await supabase
    .from('receipts')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', receipt.id)

  // delete images from Storage (spec §5.2 — after confirm)
  if (receipt.image_paths?.length) {
    await supabase.storage.from(RECEIPTS_BUCKET).remove(receipt.image_paths)
    await supabase.from('receipts').update({ image_paths: [] }).eq('id', receipt.id)
  }

  return { productsCreated, priceRows: priceRows.length, autoMarked }
}
