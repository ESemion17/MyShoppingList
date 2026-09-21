import { supabase, RECEIPTS_BUCKET } from '@/lib/supabase'
import type { Receipt } from '@/lib/database.types'
import { compressImage } from './imageUtils'

/**
 * Receipt upload flow (spec §7.2):
 * 1. compress images  2. create `receipts` row (processing)
 * 3. upload images straight to Storage  4. save image_paths
 * 5. invoke the `parse-receipt` Edge Function.
 * Realtime on `receipts` then flips the UI from spinner → results.
 */
export async function uploadReceipt(
  familyId: string,
  uploadedBy: string | null,
  files: File[],
): Promise<Receipt> {
  if (files.length === 0) throw new Error('לא נבחרו תמונות')

  // 1 + 2: create the row first so we have an id for the storage path
  const { data: receipt, error: insertError } = await supabase
    .from('receipts')
    .insert({
      family_id: familyId,
      uploaded_by: uploadedBy,
      status: 'processing',
      image_paths: [],
    })
    .select()
    .single()
  if (insertError) throw insertError
  const receiptRow = receipt as Receipt

  // 3: compress + upload each image directly to Storage
  const paths: string[] = []
  try {
    for (let i = 0; i < files.length; i++) {
      const blob = await compressImage(files[i])
      const path = `${familyId}/${receiptRow.id}/${i}.jpg`
      const { error: upErr } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr
      paths.push(path)
    }
  } catch (err) {
    await supabase
      .from('receipts')
      .update({ status: 'failed', error: 'upload_failed' })
      .eq('id', receiptRow.id)
    throw err
  }

  // 4: persist paths
  await supabase.from('receipts').update({ image_paths: paths }).eq('id', receiptRow.id)

  // 5: kick off parsing (async — result arrives via Realtime)
  const { error: fnError } = await supabase.functions.invoke('parse-receipt', {
    body: { receipt_id: receiptRow.id },
  })
  if (fnError) {
    // The function itself also marks failed; surface a hint anyway.
    console.error('parse-receipt invoke error', fnError)
  }

  return { ...receiptRow, image_paths: paths }
}

/** Signed URLs for previewing private receipt images. */
export async function getSignedUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return []
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(paths, 60 * 10)
  if (error) {
    console.error('signed urls', error)
    return []
  }
  return (data ?? [])
    .map((d) => d.signedUrl)
    .filter((u): u is string => typeof u === 'string')
}
