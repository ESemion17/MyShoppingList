import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { UNIT_LABELS, toDateOnly } from '@/lib/format'
import type { ShoppingListItem } from '@/lib/database.types'
import type { MarkBoughtFields } from './useShoppingList'

export function MarkBoughtModal({
  item,
  displayName,
  open,
  onClose,
  onConfirm,
}: {
  item: ShoppingListItem
  displayName: string
  open: boolean
  onClose: () => void
  onConfirm: (fields: MarkBoughtFields) => Promise<void>
}) {
  const [price, setPrice] = useState('')
  const [store, setStore] = useState('')
  const [date, setDate] = useState(toDateOnly(new Date()))
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onConfirm({
        bought_price: price ? Number(price) : null,
        bought_store: store.trim() || null,
        bought_at: date ? new Date(date).toISOString() : new Date().toISOString(),
        quantity: quantity ? Number(quantity) : item.quantity,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`סימון "${displayName}" כנקנה`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-slate-400">כל השדות אופציונליים — מלא רק מה שרלוונטי.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">מחיר ששולם (₪)</label>
            <input
              className="input ltr-nums text-center"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              כמות ({UNIT_LABELS[item.unit]})
            </label>
            <input
              className="input ltr-nums text-center"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">חנות</label>
          <input
            className="input"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="שם החנות"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">תאריך</label>
          <input
            className="input ltr-nums"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary flex-1" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            סמן כנקנה
          </button>
        </div>
      </form>
    </Modal>
  )
}
