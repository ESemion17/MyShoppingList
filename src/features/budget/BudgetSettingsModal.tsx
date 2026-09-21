import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useFamilyData } from '@/contexts/FamilyDataContext'
import { setBudget, clearBudget } from './budgetApi'
import type { CategorySpend } from './useBudgetData'

export function BudgetSettingsModal({
  open,
  onClose,
  overallBudget,
  byCategory,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  overallBudget: number | null
  byCategory: CategorySpend[]
  onSaved: () => void
}) {
  const { familyId, categories } = useFamilyData()
  const [overall, setOverall] = useState(overallBudget != null ? String(overallBudget) : '')
  const [perCat, setPerCat] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const c of byCategory) if (c.categoryId && c.budget != null) init[c.categoryId] = String(c.budget)
    return init
  })
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      // overall
      if (overall.trim() === '') await clearBudget(familyId, null)
      else await setBudget(familyId, null, Number(overall))

      // per category
      for (const c of categories) {
        const v = perCat[c.id]
        if (v === undefined) continue
        if (v.trim() === '') await clearBudget(familyId, c.id)
        else await setBudget(familyId, c.id, Number(v))
      }
      onSaved()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="הגדרת תקציב"
      footer={
        <>
          <button className="btn-secondary flex-1" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary flex-1" onClick={save} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            שמירה
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            תקרה חודשית כוללת (₪)
          </label>
          <input
            className="input ltr-nums text-center"
            inputMode="decimal"
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            placeholder="ללא הגבלה"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">תקרות לפי קטגוריה (אופציונלי)</p>
          {categories.length === 0 ? (
            <p className="text-xs text-slate-400">
              עדיין אין קטגוריות. אפשר להוסיף אותן במסך ההגדרות.
            </p>
          ) : (
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-slate-700">{c.name}</span>
                  <input
                    className="input ltr-nums w-28 text-center"
                    inputMode="decimal"
                    value={perCat[c.id] ?? ''}
                    onChange={(e) => setPerCat((p) => ({ ...p, [c.id]: e.target.value }))}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
