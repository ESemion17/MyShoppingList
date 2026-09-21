import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useFamilyData } from '@/contexts/FamilyDataContext'
import { FullPageSpinner, Spinner } from '@/components/Spinner'
import { AlertIcon, TrashIcon } from '@/components/icons'
import { UNIT_OPTIONS, formatMoney, formatDate, round2 } from '@/lib/format'
import type { ItemType, ReceiptItem, Unit } from '@/lib/database.types'
import { useReceipt } from './useReceipts'
import {
  confirmReceipt,
  suggestMatches,
  NEW_PRODUCT,
  SKIP_MATCH,
  type MatchChoice,
} from './confirm'
import { getSignedUrls } from './uploadReceipt'

interface Draft {
  id: string
  raw_name: string
  barcode: string | null
  item_type: ItemType
  unit: Unit
  quantity: string
  full_unit_price: string
  line_total: string
  discount: string
  confidence: ReceiptItem['confidence']
  matched: MatchChoice
  had_barcode_match: boolean
}

const num = (s: string): number | null => {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const str = (n: number | null | undefined): string => (n == null ? '' : String(n))

export function ReceiptDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { products, refresh: refreshFamily } = useFamilyData()
  const { receipt, loading } = useReceipt(id)

  const [items, setItems] = useState<ReceiptItem[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [images, setImages] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [date, setDate] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [itemsLoaded, setItemsLoaded] = useState(false)

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', id)
      .order('created_at', { ascending: true })
    const rows = (data ?? []) as ReceiptItem[]
    setItems(rows)
    const suggestions = suggestMatches(rows, products)
    setDrafts(
      rows.map((r) => ({
        id: r.id,
        raw_name: r.raw_name,
        barcode: r.barcode,
        item_type: r.item_type,
        unit: r.unit,
        quantity: str(r.quantity),
        full_unit_price: str(r.full_unit_price),
        line_total: str(r.line_total),
        discount: str(r.discount ?? 0),
        confidence: r.confidence,
        matched: suggestions[r.id] ?? NEW_PRODUCT,
        had_barcode_match:
          !!r.barcode && products.some((p) => p.barcode === r.barcode),
      })),
    )
    setItemsLoaded(true)
  }, [id, products])

  // load items once the receipt is parsed / confirmed
  useEffect(() => {
    if (!receipt) return
    setStore(receipt.store_name ?? '')
    setDate(receipt.purchase_date ?? '')
    if ((receipt.status === 'parsed' || receipt.status === 'confirmed') && !itemsLoaded) {
      loadItems()
    }
    if (receipt.image_paths?.length) {
      getSignedUrls(receipt.image_paths).then(setImages)
    } else {
      setImages([])
    }
  }, [receipt, itemsLoaded, loadItems])

  const patch = (draftId: string, p: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, ...p } : d)))

  const removeLine = async (draftId: string) => {
    await supabase.from('receipt_items').delete().eq('id', draftId)
    setDrafts((prev) => prev.filter((d) => d.id !== draftId))
    setItems((prev) => prev.filter((i) => i.id !== draftId))
  }

  const warnings = useMemo(() => {
    const raw = receipt?.raw_model_json as { warnings?: string[] } | null
    return raw?.warnings ?? []
  }, [receipt])

  const retryParse = async () => {
    setRetrying(true)
    setError(null)
    try {
      await supabase.from('receipts').update({ status: 'processing', error: null }).eq('id', id)
      await supabase.functions.invoke('parse-receipt', { body: { receipt_id: id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה')
    } finally {
      setRetrying(false)
    }
  }

  const confirm = async () => {
    if (!receipt) return
    setConfirming(true)
    setError(null)
    try {
      // 1) persist header + line edits back to the DB
      await supabase
        .from('receipts')
        .update({ store_name: store || null, purchase_date: date || null })
        .eq('id', id)

      const edited: ReceiptItem[] = drafts.map((d) => {
        const base = items.find((i) => i.id === d.id)!
        return {
          ...base,
          raw_name: d.raw_name,
          barcode: d.barcode,
          item_type: d.item_type,
          unit: d.unit,
          quantity: num(d.quantity) ?? 0,
          full_unit_price: num(d.full_unit_price),
          line_total: num(d.line_total),
          discount: num(d.discount) ?? 0,
        }
      })

      for (const it of edited) {
        await supabase
          .from('receipt_items')
          .update({
            raw_name: it.raw_name,
            barcode: it.barcode,
            item_type: it.item_type,
            unit: it.unit,
            quantity: it.quantity,
            full_unit_price: it.full_unit_price,
            line_total: it.line_total,
            discount: it.discount,
          })
          .eq('id', it.id)
      }

      const choices: Record<string, MatchChoice> = {}
      for (const d of drafts) choices[d.id] = d.item_type === 'product' ? d.matched : SKIP_MATCH

      const updatedReceipt = { ...receipt, store_name: store || null, purchase_date: date || null }
      await confirmReceipt(updatedReceipt, edited, choices)
      await refreshFamily()
      navigate('/receipts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה באישור')
    } finally {
      setConfirming(false)
    }
  }

  if (loading || !receipt) return <FullPageSpinner />

  // ---- processing ----
  if (receipt.status === 'processing') {
    return (
      <StatusScreen
        title="קוראים את הקבלה…"
        note="זה לוקח כמה שניות. אפשר להישאר כאן — התוצאה תופיע אוטומטית."
        images={images}
        onBack={() => navigate('/receipts')}
      >
        <Spinner className="h-8 w-8 text-brand-500" />
      </StatusScreen>
    )
  }

  // ---- failed ----
  if (receipt.status === 'failed') {
    return (
      <StatusScreen
        title="הקריאה נכשלה"
        note={
          receipt.error === 'rate_limit'
            ? 'המודל עמוס כרגע (מגבלת קצב). נסה שוב בעוד רגע.'
            : 'לא הצלחנו לקרוא את הקבלה. אפשר לנסות שוב.'
        }
        images={images}
        onBack={() => navigate('/receipts')}
      >
        <button className="btn-primary" onClick={retryParse} disabled={retrying}>
          {retrying && <Spinner className="h-4 w-4" />}
          נסה שוב
        </button>
      </StatusScreen>
    )
  }

  const confirmed = receipt.status === 'confirmed'

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button className="btn-ghost -ms-2 text-sm text-slate-500" onClick={() => navigate('/receipts')}>
            → חזרה
          </button>
          <h1 className="text-base font-bold text-slate-800">
            {confirmed ? 'קבלה מאושרת' : 'אישור קבלה'}
          </h1>
          <span className="w-12" />
        </div>
      </header>

      {!confirmed && (
        <p className="px-4 pt-3 text-xs text-slate-400">
          עברו על הפריטים ותקנו במידת הצורך. שדות חסרים וביטחון נמוך מסומנים. באישור יתבצעו התאמת
          מוצרים, חישוב מחירים, וסימון פריטים ברשימה.
        </p>
      )}

      {warnings.length > 0 && !confirmed && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="list-disc space-y-0.5 pe-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* header fields */}
      <div className="card mx-4 mt-3 space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">חנות</label>
            <input
              className="input"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              disabled={confirmed}
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
              disabled={confirmed}
              dir="ltr"
            />
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">סה״כ בקבלה</span>
          <span className="font-semibold text-slate-800">{formatMoney(receipt.total)}</span>
        </div>
      </div>

      {/* items */}
      <div className="mt-3 space-y-2 px-4">
        {drafts.map((d) => (
          <ItemCard
            key={d.id}
            draft={d}
            confirmed={confirmed}
            onPatch={patch}
            onRemove={removeLine}
          />
        ))}
        {drafts.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">אין פריטים בקבלה זו.</p>
        )}
      </div>

      {error && <p className="mt-3 px-4 text-center text-sm text-red-600">{error}</p>}

      {!confirmed && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <button className="btn-primary w-full py-3.5 text-base" onClick={confirm} disabled={confirming}>
            {confirming && <Spinner className="h-5 w-5" />}
            אישור {drafts.length} פריטים
          </button>
        </div>
      )}

      {confirmed && (
        <p className="px-4 py-6 text-center text-xs text-slate-400">
          אושר ב-{formatDate(receipt.confirmed_at)} · התמונות נמחקו מהאחסון.
        </p>
      )}
    </div>
  )
}

function ItemCard({
  draft,
  confirmed,
  onPatch,
  onRemove,
}: {
  draft: Draft
  confirmed: boolean
  onPatch: (id: string, p: Partial<Draft>) => void
  onRemove: (id: string) => void
}) {
  const { products } = useFamilyData()
  const qty = num(draft.quantity)
  const lt = num(draft.line_total)
  const real = lt != null && qty ? round2(lt / qty) : num(draft.full_unit_price)
  const lowConfidence = draft.confidence === 'low'
  const missingPrice = num(draft.full_unit_price) == null && num(draft.line_total) == null
  const isProduct = draft.item_type === 'product'

  return (
    <div
      className={`card p-3 ${lowConfidence || missingPrice ? 'ring-1 ring-amber-300' : ''}`}
    >
      <div className="flex items-start gap-2">
        <input
          className="input flex-1 font-medium"
          value={draft.raw_name}
          onChange={(e) => onPatch(draft.id, { raw_name: e.target.value })}
          disabled={confirmed}
        />
        {!confirmed && (
          <button
            className="btn-ghost p-2 text-slate-300 hover:text-red-500"
            onClick={() => onRemove(draft.id)}
            aria-label="מחק שורה"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {lowConfidence && <span className="chip bg-amber-100 text-amber-700">ביטחון נמוך</span>}
        {missingPrice && <span className="chip bg-red-100 text-red-700">חסר מחיר</span>}
        {draft.had_barcode_match && isProduct && (
          <span className="chip bg-emerald-100 text-emerald-700">התאמת ברקוד</span>
        )}
        {draft.barcode && (
          <span className="chip bg-slate-100 text-slate-400 ltr-nums">{draft.barcode}</span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="כמות">
          <input
            className="input ltr-nums text-center"
            inputMode="decimal"
            value={draft.quantity}
            onChange={(e) => onPatch(draft.id, { quantity: e.target.value })}
            disabled={confirmed}
          />
        </Field>
        <Field label="יחידה">
          <select
            className="input"
            value={draft.unit}
            onChange={(e) => onPatch(draft.id, { unit: e.target.value as Unit })}
            disabled={confirmed}
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="סוג">
          <select
            className="input"
            value={draft.item_type}
            onChange={(e) => onPatch(draft.id, { item_type: e.target.value as ItemType })}
            disabled={confirmed}
          >
            <option value="product">מוצר</option>
            <option value="deposit">פיקדון</option>
            <option value="other">אחר</option>
          </select>
        </Field>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="מחיר ליח׳">
          <input
            className="input ltr-nums text-center"
            inputMode="decimal"
            value={draft.full_unit_price}
            onChange={(e) => onPatch(draft.id, { full_unit_price: e.target.value })}
            disabled={confirmed}
          />
        </Field>
        <Field label="סה״כ שורה">
          <input
            className="input ltr-nums text-center"
            inputMode="decimal"
            value={draft.line_total}
            onChange={(e) => onPatch(draft.id, { line_total: e.target.value })}
            disabled={confirmed}
          />
        </Field>
        <Field label="הנחה">
          <input
            className="input ltr-nums text-center"
            inputMode="decimal"
            value={draft.discount}
            onChange={(e) => onPatch(draft.id, { discount: e.target.value })}
            disabled={confirmed}
          />
        </Field>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>מחיר אמיתי ליח׳ (מחושב)</span>
        <span className="font-semibold text-brand-600">{formatMoney(real)}</span>
      </div>

      {isProduct && !confirmed && (
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">התאמה לקטלוג</label>
          <select
            className="input"
            value={draft.matched}
            onChange={(e) => onPatch(draft.id, { matched: e.target.value })}
          >
            <option value={NEW_PRODUCT}>➕ מוצר חדש</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}

function StatusScreen({
  title,
  note,
  images,
  onBack,
  children,
}: {
  title: string
  note: string
  images: string[]
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <button className="btn-ghost -ms-2 text-sm text-slate-500" onClick={onBack}>
          → חזרה
        </button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        {children}
        <h1 className="text-lg font-bold text-slate-800">{title}</h1>
        <p className="max-w-xs text-sm text-slate-400">{note}</p>
        {images.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`קבלה ${i + 1}`}
                className="h-40 w-auto rounded-xl border border-slate-200 object-cover"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
