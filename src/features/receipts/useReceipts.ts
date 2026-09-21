import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Receipt } from '@/lib/database.types'

export function useReceipts(familyId: string) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('load receipts', error)
    setReceipts((data ?? []) as Receipt[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`receipts-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts', filter: `family_id=eq.${familyId}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [familyId, load])

  return { receipts, loading, reload: load }
}

export function useReceipt(receiptId: string) {
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('receipts').select('*').eq('id', receiptId).maybeSingle()
    setReceipt((data as Receipt) ?? null)
    setLoading(false)
  }, [receiptId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`receipt-${receiptId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts', filter: `id=eq.${receiptId}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [receiptId, load])

  return { receipt, loading, reload: load }
}
