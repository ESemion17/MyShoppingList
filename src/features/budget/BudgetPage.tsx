import { useMemo, useState } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useFamilyData } from '@/contexts/FamilyDataContext'
import { PageHeader } from '@/components/AppLayout'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { AlertIcon, ChartIcon } from '@/components/icons'
import { formatMoney, formatMonth, formatDate, UNIT_LABELS } from '@/lib/format'
import { useBudgetData, type CategorySpend } from './useBudgetData'
import { usePriceHistory } from './usePriceHistory'
import { BudgetSettingsModal } from './BudgetSettingsModal'

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#6366f1']

type AlertLevel = 'ok' | 'near' | 'over'
function alertLevel(spent: number, budget: number | null): AlertLevel {
  if (budget == null || budget <= 0) return 'ok'
  const ratio = spent / budget
  if (ratio >= 1) return 'over'
  if (ratio >= 0.9) return 'near'
  return 'ok'
}

export function BudgetPage() {
  const { familyId, categories, products } = useFamilyData()
  const { summary, loading, reload } = useBudgetData(familyId, categories, products)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const alerts = useMemo(() => {
    if (!summary) return []
    const out: { name: string; level: AlertLevel; spent: number; budget: number }[] = []
    if (summary.overallBudget != null) {
      const level = alertLevel(summary.monthTotal, summary.overallBudget)
      if (level !== 'ok')
        out.push({ name: 'תקציב כולל', level, spent: summary.monthTotal, budget: summary.overallBudget })
    }
    for (const c of summary.byCategory) {
      if (c.budget != null) {
        const level = alertLevel(c.amount, c.budget)
        if (level !== 'ok') out.push({ name: c.name, level, spent: c.amount, budget: c.budget })
      }
    }
    return out
  }, [summary])

  if (loading || !summary) return <FullPageSpinner />

  const hasData = summary.monthTotal > 0 || summary.byCategory.length > 0

  return (
    <div className="pb-4">
      <PageHeader
        title="תקציב והוצאות"
        subtitle={formatMonth(new Date())}
        action={
          <button className="btn-secondary text-xs" onClick={() => setSettingsOpen(true)}>
            הגדרת תקציב
          </button>
        }
      />

      {/* headline */}
      <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-lg">
        <p className="text-sm opacity-90">עלות הסל החודשית</p>
        <p className="mt-1 text-3xl font-bold">{formatMoney(summary.monthTotal)}</p>
        <p className="mt-1 text-xs opacity-80">
          {summary.receiptCount} קבלות · {summary.manualCount} פריטים ידניים
        </p>
        {summary.overallBudget != null && (
          <div className="mt-3">
            <ProgressBar
              value={summary.monthTotal}
              max={summary.overallBudget}
              light
            />
            <p className="mt-1 text-xs opacity-90">
              מתוך תקציב {formatMoney(summary.overallBudget)}
            </p>
          </div>
        )}
      </div>

      {/* alerts */}
      {alerts.length > 0 && (
        <div className="mx-4 mt-3 space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                a.level === 'over'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              <AlertIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                {a.name}: {formatMoney(a.spent)} מתוך {formatMoney(a.budget)}
              </span>
              <span className="font-semibold">
                {a.level === 'over' ? 'חריגה' : 'קרוב לתקרה'}
              </span>
            </div>
          ))}
        </div>
      )}

      {!hasData ? (
        <EmptyState
          icon={<ChartIcon className="h-12 w-12" />}
          title="אין עדיין נתוני הוצאות החודש"
          description="אשר קבלה או סמן פריט כנקנה עם מחיר כדי לראות את הפילוח והתקציב."
        />
      ) : (
        <>
          {/* distribution pie */}
          {summary.byCategory.some((c) => c.amount > 0) && (
            <section className="card mx-4 mt-3 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">פילוח לפי קטגוריה</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.byCategory.filter((c) => c.amount > 0)}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {summary.byCategory
                        .filter((c) => c.amount > 0)
                        .map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {summary.byCategory
                  .filter((c) => c.amount > 0)
                  .map((c, i) => (
                    <span key={c.categoryId ?? 'none'} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-slate-600">{c.name}</span>
                      <span className="text-slate-400">{formatMoney(c.amount)}</span>
                    </span>
                  ))}
              </div>
            </section>
          )}

          {/* category budgets breakdown */}
          <section className="card mx-4 mt-3 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">הוצאה מול תקציב</h3>
            <div className="space-y-3">
              {summary.byCategory.map((c) => (
                <CategoryRow key={c.categoryId ?? 'none'} spend={c} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* price history */}
      <PriceTracker />

      <BudgetSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        overallBudget={summary.overallBudget}
        byCategory={summary.byCategory}
        onSaved={reload}
      />
    </div>
  )
}

function CategoryRow({ spend }: { spend: CategorySpend }) {
  const level = alertLevel(spend.amount, spend.budget)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-700">{spend.name}</span>
        <span className="text-slate-500">
          {formatMoney(spend.amount)}
          {spend.budget != null && (
            <span className="text-slate-400"> / {formatMoney(spend.budget)}</span>
          )}
        </span>
      </div>
      {spend.budget != null ? (
        <ProgressBar value={spend.amount} max={spend.budget} level={level} />
      ) : (
        <div className="h-1.5 rounded-full bg-slate-100" />
      )}
    </div>
  )
}

function ProgressBar({
  value,
  max,
  level,
  light,
}: {
  value: number
  max: number
  level?: AlertLevel
  light?: boolean
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const color = light
    ? 'bg-white'
    : level === 'over'
      ? 'bg-red-500'
      : level === 'near'
        ? 'bg-amber-500'
        : 'bg-brand-500'
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${light ? 'bg-white/30' : 'bg-slate-100'}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function PriceTracker() {
  const { products } = useFamilyData()
  const [productId, setProductId] = useState<string>('')
  const { rows, loading } = usePriceHistory(productId || null)

  const product = products.find((p) => p.id === productId)
  const chartData = rows.map((r) => ({
    date: formatDate(r.purchase_date),
    price: r.real_unit_price,
    full: r.full_unit_price,
  }))

  return (
    <section className="card mx-4 mt-3 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">מחיר מוצר לאורך זמן</h3>
      {products.length === 0 ? (
        <p className="text-xs text-slate-400">הקטלוג עדיין ריק — אשר קבלה כדי לבנות אותו.</p>
      ) : (
        <>
          <select
            className="input mb-3"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">בחר מוצר…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {!productId ? null : loading ? (
            <p className="py-6 text-center text-xs text-slate-400">טוען…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">אין עדיין היסטוריית מחירים למוצר זה.</p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} reversed />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    <Line
                      type="monotone"
                      dataKey="price"
                      name="מחיר אמיתי"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {product && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  {rows.length} רכישות · ליחידת {UNIT_LABELS[product.default_unit]}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
