import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useFamilyData } from '@/contexts/FamilyDataContext'
import { UNIT_OPTIONS, formatQuantity } from '@/lib/format'
import { normalizeName } from '@/lib/fuzzy'
import type { Product, Unit } from '@/lib/database.types'
import { PlusIcon } from '@/components/icons'
import { Spinner } from '@/components/Spinner'
import type { NewItem } from './useShoppingList'

export function AddItemForm({ onAdd }: { onAdd: (item: NewItem) => Promise<void> }) {
  const { products, categories } = useFamilyData()
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState<Unit>('unit')
  const [categoryId, setCategoryId] = useState<string>('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blurTimer = useRef<number>()

  const suggestions = useMemo(() => {
    const q = normalizeName(name)
    if (!q) return []
    return products
      .filter((p) => normalizeName(p.name).includes(q))
      .slice(0, 6)
  }, [name, products])

  const pick = (p: Product) => {
    setSelected(p)
    setName(p.name)
    setUnit(p.default_unit)
    if (p.category_id) setCategoryId(p.category_id)
    setShowSuggestions(false)
  }

  const onNameChange = (v: string) => {
    setName(v)
    setSelected(null) // typing again = free text unless re-picked
    setShowSuggestions(true)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) return setError('נא להזין שם פריט')
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) return setError('כמות לא תקינה')

    setBusy(true)
    try {
      await onAdd({
        product_id: selected?.id ?? null,
        raw_text: selected ? null : trimmed,
        category_id: categoryId || selected?.category_id || null,
        quantity: qty,
        unit,
      })
      setName('')
      setSelected(null)
      setQuantity('1')
      setUnit('unit')
      setCategoryId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהוספה')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card mx-4 mt-4 p-3">
      <div className="relative">
        <input
          className="input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setShowSuggestions(false), 150)
          }}
          placeholder="הוסף פריט… (למשל חלב)"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-right text-sm hover:bg-slate-50"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    if (blurTimer.current) clearTimeout(blurTimer.current)
                    pick(p)
                  }}
                >
                  <span className="text-slate-700">{p.name}</span>
                  {p.barcode && (
                    <span className="ltr-nums text-xs text-slate-300">{p.barcode}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          className="input w-20 text-center ltr-nums"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-label="כמות"
        />
        <select
          className="input flex-1"
          value={unit}
          onChange={(e) => setUnit(e.target.value as Unit)}
          aria-label="יחידה"
        >
          {UNIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="input flex-1"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="קטגוריה"
        >
          <option value="">ללא קטגוריה</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <p className="mt-2 text-xs text-brand-600">
          מקושר למוצר מהקטלוג · כמות ברירת מחדל {formatQuantity(quantity ? Number(quantity) : 1)}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button className="btn-primary mt-3 w-full" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
        הוספה לרשימה
      </button>
    </form>
  )
}
