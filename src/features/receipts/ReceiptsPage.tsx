import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFamilyData } from '@/contexts/FamilyDataContext'
import { PageHeader } from '@/components/AppLayout'
import { FullPageSpinner, Spinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { CameraIcon, ReceiptIcon } from '@/components/icons'
import { formatDate, formatMoney } from '@/lib/format'
import type { Receipt, ReceiptStatus } from '@/lib/database.types'
import { useReceipts } from './useReceipts'
import { uploadReceipt } from './uploadReceipt'

const STATUS: Record<ReceiptStatus, { label: string; cls: string }> = {
  processing: { label: 'בעיבוד…', cls: 'bg-amber-100 text-amber-700' },
  parsed: { label: 'ממתין לאישור', cls: 'bg-brand-100 text-brand-700' },
  confirmed: { label: 'אושר', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'נכשל', cls: 'bg-red-100 text-red-700' },
}

export function ReceiptsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { familyId } = useFamilyData()
  const { receipts, loading } = useReceipts(familyId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (e.target) e.target.value = '' // allow re-selecting same file
    if (!files.length) return
    setError(null)
    setUploading(true)
    try {
      const receipt = await uploadReceipt(familyId, profile?.id ?? null, files)
      navigate(`/receipts/${receipt.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהעלאה')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <PageHeader title="קבלות" subtitle="צלם קבלה — המערכת תקרא אותה אוטומטית" />

      <div className="px-4 pt-4">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={onFiles}
        />
        <button
          className="btn-primary w-full py-3.5 text-base"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Spinner className="h-5 w-5" /> : <CameraIcon className="h-5 w-5" />}
          {uploading ? 'מעלה…' : 'צילום / העלאת קבלה'}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          אפשר לבחור כמה תמונות לקבלה ארוכה אחת. צלם ישר, בתאורה טובה.
        </p>
        {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
      </div>

      {loading ? (
        <FullPageSpinner />
      ) : receipts.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon className="h-12 w-12" />}
          title="אין קבלות עדיין"
          description="צלם את הקבלה הראשונה שלך. הקטלוג והמחירים ייבנו מהסריקות."
        />
      ) : (
        <ul className="mt-4 space-y-2 px-4 pb-4">
          {receipts.map((r) => (
            <ReceiptRow key={r.id} receipt={r} onClick={() => navigate(`/receipts/${r.id}`)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReceiptRow({ receipt, onClick }: { receipt: Receipt; onClick: () => void }) {
  const status = STATUS[receipt.status]
  return (
    <li>
      <button
        onClick={onClick}
        className="card flex w-full items-center justify-between gap-3 p-4 text-right active:scale-[0.99]"
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">
            {receipt.store_name || 'קבלה ללא שם חנות'}
          </p>
          <p className="text-xs text-slate-400">
            {formatDate(receipt.purchase_date ?? receipt.created_at)}
            {receipt.store_branch ? ` · ${receipt.store_branch}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {receipt.total != null && (
            <span className="font-semibold text-slate-700">{formatMoney(receipt.total)}</span>
          )}
          <span className={`chip ${status.cls}`}>
            {receipt.status === 'processing' && <Spinner className="h-3 w-3" />}
            {status.label}
          </span>
        </div>
      </button>
    </li>
  )
}
