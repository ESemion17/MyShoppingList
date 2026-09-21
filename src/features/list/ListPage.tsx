import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFamilyData } from '@/contexts/FamilyDataContext'
import { PageHeader } from '@/components/AppLayout'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { ListIcon } from '@/components/icons'
import type { ShoppingListItem } from '@/lib/database.types'
import { AddItemForm } from './AddItemForm'
import { ListItemRow } from './ListItemRow'
import { useShoppingList } from './useShoppingList'

export function ListPage() {
  const { profile } = useAuth()
  const { familyId, categories, products, categoryName } = useFamilyData()
  const { items, loading, addItem, updateItem, deleteItem, markBought, markActive } =
    useShoppingList(familyId, profile?.id ?? null)
  const [showBought, setShowBought] = useState(false)

  const active = items.filter((i) => i.status === 'active')
  const bought = items.filter((i) => i.status === 'bought')

  // group active items by resolved category
  const groups = useMemo(() => {
    const resolveCat = (i: ShoppingListItem) =>
      i.category_id ?? products.find((p) => p.id === i.product_id)?.category_id ?? null
    const map = new Map<string | null, ShoppingListItem[]>()
    for (const i of active) {
      const key = resolveCat(i)
      const arr = map.get(key) ?? []
      arr.push(i)
      map.set(key, arr)
    }
    // stable order: defined categories by their order, then "no category" last
    const ordered: { id: string | null; name: string; items: ShoppingListItem[] }[] = []
    for (const c of categories) {
      if (map.has(c.id)) ordered.push({ id: c.id, name: c.name, items: map.get(c.id)! })
    }
    if (map.has(null)) ordered.push({ id: null, name: 'ללא קטגוריה', items: map.get(null)! })
    // any category not in the list (edge case)
    for (const [key, arr] of map) {
      if (key !== null && !categories.some((c) => c.id === key)) {
        ordered.push({ id: key, name: categoryName(key) || 'אחר', items: arr })
      }
    }
    return ordered
  }, [active, categories, products, categoryName])

  return (
    <div>
      <PageHeader
        title="רשימת קניות"
        subtitle={active.length ? `${active.length} פריטים פעילים` : 'הרשימה ריקה'}
      />

      <AddItemForm onAdd={addItem} />

      {loading ? (
        <FullPageSpinner />
      ) : active.length === 0 && bought.length === 0 ? (
        <EmptyState
          icon={<ListIcon className="h-12 w-12" />}
          title="הרשימה ריקה"
          description="הוסף את הפריט הראשון למעלה. פריטים יסונכרנו מיד לכל בני המשפחה."
        />
      ) : (
        <div className="mt-4 space-y-3 px-0 pb-4">
          {groups.map((g) => (
            <section key={g.id ?? 'none'} className="card mx-4 overflow-hidden">
              <h3 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                {g.name}
              </h3>
              <div className="divide-y divide-slate-50">
                {g.items.map((item) => (
                  <ListItemRow
                    key={item.id}
                    item={item}
                    onChangeQuantity={(id, q) => updateItem(id, { quantity: q })}
                    onDelete={deleteItem}
                    onMarkBought={markBought}
                    onMarkActive={markActive}
                  />
                ))}
              </div>
            </section>
          ))}

          {bought.length > 0 && (
            <section className="mx-4">
              <button
                className="mb-2 flex w-full items-center justify-between px-1 text-xs font-semibold text-slate-400"
                onClick={() => setShowBought((s) => !s)}
              >
                <span>נקנו ({bought.length})</span>
                <span>{showBought ? 'הסתר' : 'הצג'}</span>
              </button>
              {showBought && (
                <div className="card divide-y divide-slate-50 overflow-hidden">
                  {bought.map((item) => (
                    <ListItemRow
                      key={item.id}
                      item={item}
                      onChangeQuantity={(id, q) => updateItem(id, { quantity: q })}
                      onDelete={deleteItem}
                      onMarkBought={markBought}
                      onMarkActive={markActive}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
