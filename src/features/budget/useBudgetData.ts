import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { monthStartISO, nextMonthStartISO, round2 } from '@/lib/format'
import type {
  Budget,
  Category,
  Product,
  Receipt,
  ReceiptItem,
  ShoppingListItem,
} from '@/lib/database.types'

export interface CategorySpend {
  categoryId: string | null
  name: string
  amount: number
  budget: number | null
}

export interface BudgetSummary {
  monthTotal: number
  overallBudget: number | null
  byCategory: CategorySpend[]
  receiptCount: number
  manualCount: number
}

const UNCATEGORIZED = 'אחר / ללא קטגוריה'

function inCurrentMonth(dateISO: string | null | undefined): boolean {
  if (!dateISO) return false
  const d = dateISO.slice(0, 10)
  return d >= monthStartISO() && d < nextMonthStartISO()
}

export function useBudgetData(
  familyId: string,
  categories: Category[],
  products: Product[],
) {
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    const [receiptsRes, manualRes, budgetsRes] = await Promise.all([
      supabase.from('receipts').select('*').eq('status', 'confirmed'),
      supabase
        .from('shopping_list_items')
        .select('*')
        .eq('status', 'bought')
        .eq('bought_source', 'manual'),
      supabase.from('budgets').select('*'),
    ])

    const receipts = ((receiptsRes.data ?? []) as Receipt[]).filter((r) =>
      inCurrentMonth(r.purchase_date ?? r.created_at),
    )
    const manual = ((manualRes.data ?? []) as ShoppingListItem[]).filter((i) =>
      inCurrentMonth(i.bought_at),
    )
    const budgets = (budgetsRes.data ?? []) as Budget[]

    // line items for this month's confirmed receipts (for category breakdown)
    let items: ReceiptItem[] = []
    if (receipts.length) {
      const { data } = await supabase
        .from('receipt_items')
        .select('*')
        .in(
          'receipt_id',
          receipts.map((r) => r.id),
        )
      items = (data ?? []) as ReceiptItem[]
    }

    const catOfProduct = new Map(products.map((p) => [p.id, p.category_id]))
    const catName = new Map<string | null, string>(categories.map((c) => [c.id, c.name]))

    // build category buckets
    const buckets = new Map<string | null, number>()
    const add = (catId: string | null, amount: number) => {
      if (!amount) return
      buckets.set(catId, round2((buckets.get(catId) ?? 0) + amount))
    }

    for (const it of items) {
      const amount = it.line_total ?? 0
      if (it.item_type !== 'product') {
        add(null, amount) // deposits / other → uncategorized
        continue
      }
      const catId = it.matched_product_id ? catOfProduct.get(it.matched_product_id) ?? null : null
      add(catId, amount)
    }
    for (const m of manual) {
      const catId = m.category_id ?? (m.product_id ? catOfProduct.get(m.product_id) ?? null : null)
      add(catId ?? null, m.bought_price ?? 0)
    }

    // authoritative monthly total
    const receiptsTotal = receipts.reduce((s, r) => s + (r.total ?? 0), 0)
    const manualTotal = manual.reduce((s, m) => s + (m.bought_price ?? 0), 0)
    const monthTotal = round2(receiptsTotal + manualTotal)

    // reconcile: if headline > sum of buckets (missing line totals), push the gap to "other"
    const bucketSum = round2([...buckets.values()].reduce((s, v) => s + v, 0))
    if (monthTotal > bucketSum) add(null, round2(monthTotal - bucketSum))

    const budgetByCat = new Map<string | null, number>(
      budgets.map((b) => [b.category_id, b.amount]),
    )
    const overallBudget = budgetByCat.has(null) ? budgetByCat.get(null)! : null

    const byCategory: CategorySpend[] = [...buckets.entries()]
      .map(([categoryId, amount]) => ({
        categoryId,
        name: categoryId ? catName.get(categoryId) ?? UNCATEGORIZED : UNCATEGORIZED,
        amount: round2(amount),
        budget: categoryId ? budgetByCat.get(categoryId) ?? null : null,
      }))
      .sort((a, b) => b.amount - a.amount)

    // include categories that have a budget but no spend yet
    for (const b of budgets) {
      if (b.category_id && !byCategory.some((c) => c.categoryId === b.category_id)) {
        byCategory.push({
          categoryId: b.category_id,
          name: catName.get(b.category_id) ?? UNCATEGORIZED,
          amount: 0,
          budget: b.amount,
        })
      }
    }

    setSummary({
      monthTotal,
      overallBudget,
      byCategory,
      receiptCount: receipts.length,
      manualCount: manual.length,
    })
    setLoading(false)
  }, [familyId, categories, products])

  useEffect(() => {
    load()
  }, [load])

  return { summary, loading, reload: load }
}
