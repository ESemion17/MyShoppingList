import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ShoppingListItem, Unit } from '@/lib/database.types'

export interface NewItem {
  product_id?: string | null
  raw_text?: string | null
  category_id?: string | null
  quantity: number
  unit: Unit
}

export interface MarkBoughtFields {
  bought_price?: number | null
  bought_store?: string | null
  bought_at?: string | null
  quantity?: number
}

export function useShoppingList(familyId: string, addedBy: string | null) {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) console.error('load list', error)
    setItems((data ?? []) as ShoppingListItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // Realtime sync — spec §5.1 / guide §8
    const channel = supabase
      .channel(`list-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          setItems((prev) => applyChange(prev, payload))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [familyId, load])

  const addItem = useCallback(
    async (item: NewItem) => {
      const { error } = await supabase.from('shopping_list_items').insert({
        family_id: familyId,
        added_by: addedBy,
        product_id: item.product_id ?? null,
        raw_text: item.raw_text ?? null,
        category_id: item.category_id ?? null,
        quantity: item.quantity,
        unit: item.unit,
        status: 'active',
      })
      if (error) throw error
    },
    [familyId, addedBy],
  )

  const updateItem = useCallback(async (id: string, patch: Partial<ShoppingListItem>) => {
    const { error } = await supabase.from('shopping_list_items').update(patch).eq('id', id)
    if (error) throw error
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
    if (error) throw error
  }, [])

  const markBought = useCallback(
    async (id: string, fields: MarkBoughtFields = {}) => {
      const patch: Partial<ShoppingListItem> = {
        status: 'bought',
        bought_at: fields.bought_at ?? new Date().toISOString(),
        bought_price: fields.bought_price ?? null,
        bought_store: fields.bought_store ?? null,
        bought_source: 'manual',
      }
      if (fields.quantity != null) patch.quantity = fields.quantity
      await updateItem(id, patch)
    },
    [updateItem],
  )

  const markActive = useCallback(
    async (id: string) => {
      await updateItem(id, {
        status: 'active',
        bought_at: null,
        bought_price: null,
        bought_store: null,
        bought_source: null,
      })
    },
    [updateItem],
  )

  return { items, loading, addItem, updateItem, deleteItem, markBought, markActive, reload: load }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyChange(prev: ShoppingListItem[], payload: any): ShoppingListItem[] {
  const { eventType, new: newRow, old } = payload
  if (eventType === 'INSERT') {
    if (prev.some((i) => i.id === newRow.id)) return prev
    return [...prev, newRow]
  }
  if (eventType === 'UPDATE') {
    return prev.map((i) => (i.id === newRow.id ? newRow : i))
  }
  if (eventType === 'DELETE') {
    return prev.filter((i) => i.id !== old.id)
  }
  return prev
}
