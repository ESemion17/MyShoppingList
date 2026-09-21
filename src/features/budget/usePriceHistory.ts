import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PriceHistory } from '@/lib/database.types'

export function usePriceHistory(productId: string | null) {
  const [rows, setRows] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!productId) {
      setRows([])
      return
    }
    setLoading(true)
    supabase
      .from('price_history')
      .select('*')
      .eq('product_id', productId)
      .order('purchase_date', { ascending: true })
      .then(({ data }) => {
        setRows((data ?? []) as PriceHistory[])
        setLoading(false)
      })
  }, [productId])

  return { rows, loading }
}
