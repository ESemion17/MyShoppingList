import { useState } from 'react'
import { useFamilyData } from '@/contexts/FamilyDataContext'
import { UNIT_LABELS, formatMoney, formatQuantity } from '@/lib/format'
import { CheckIcon, TrashIcon } from '@/components/icons'
import type { ShoppingListItem } from '@/lib/database.types'
import { MarkBoughtModal } from './MarkBoughtModal'
import type { MarkBoughtFields } from './useShoppingList'

interface Props {
  item: ShoppingListItem
  onChangeQuantity: (id: string, quantity: number) => void
  onDelete: (id: string) => void
  onMarkBought: (id: string, fields?: MarkBoughtFields) => void
  onMarkActive: (id: string) => void
}

export function ListItemRow({
  item,
  onChangeQuantity,
  onDelete,
  onMarkBought,
  onMarkActive,
}: Props) {
  const { products, categoryName, memberName } = useFamilyData()
  const [modalOpen, setModalOpen] = useState(false)

  const product = item.product_id ? products.find((p) => p.id === item.product_id) : null
  const displayName = product?.name ?? item.raw_text ?? 'פריט'
  const catId = item.category_id ?? product?.category_id
  const category = categoryName(catId)
  const addedBy = memberName(item.added_by)
  const bought = item.status === 'bought'

  const step = (delta: number) => {
    const next = Math.round((item.quantity + delta) * 1000) / 1000
    if (next > 0) onChangeQuantity(item.id, next)
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 px-4 py-3 ${bought ? 'opacity-60' : ''}`}
      >
        <button
          onClick={() => (bought ? onMarkActive(item.id) : onMarkBought(item.id))}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
            bought
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-slate-300 text-transparent hover:border-brand-400'
          }`}
          aria-label={bought ? 'החזר לפעיל' : 'סמן כנקנה'}
        >
          <CheckIcon className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${bought ? 'line-through' : 'text-slate-800'}`}>
            {displayName}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
            <span className="ltr-nums">
              {formatQuantity(item.quantity)} {UNIT_LABELS[item.unit]}
            </span>
            {category && <span className="chip bg-slate-100 text-slate-500">{category}</span>}
            {addedBy && !bought && <span>· {addedBy}</span>}
            {bought && item.bought_price != null && (
              <span className="text-emerald-600">· {formatMoney(item.bought_price)}</span>
            )}
            {bought && item.bought_store && <span>· {item.bought_store}</span>}
          </div>
        </div>

        {!bought && (
          <div className="flex items-center gap-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600 active:scale-95"
              onClick={() => step(-1)}
              aria-label="הפחת כמות"
            >
              −
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600 active:scale-95"
              onClick={() => step(1)}
              aria-label="הוסף כמות"
            >
              +
            </button>
          </div>
        )}

        <div className="flex items-center gap-0.5">
          {!bought && (
            <button
              className="btn-ghost p-2 text-xs text-emerald-600"
              onClick={() => setModalOpen(true)}
              aria-label="סמן כנקנה עם פרטים"
              title="סמן כנקנה עם מחיר וחנות"
            >
              ₪
            </button>
          )}
          <button
            className="btn-ghost p-2 text-slate-300 hover:text-red-500"
            onClick={() => onDelete(item.id)}
            aria-label="מחק"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {modalOpen && (
        <MarkBoughtModal
          item={item}
          displayName={displayName}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onConfirm={async (fields) => onMarkBought(item.id, fields)}
        />
      )}
    </>
  )
}
