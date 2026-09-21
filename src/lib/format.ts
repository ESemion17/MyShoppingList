import type { Unit } from './database.types'

export const UNIT_LABELS: Record<Unit, string> = {
  unit: 'יח׳',
  kg: 'ק״ג',
  liter: 'ליטר',
}

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'unit', label: 'יחידות' },
  { value: 'kg', label: 'ק״ג (משקל)' },
  { value: 'liter', label: 'ליטר (נפח)' },
]

const ils = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 2,
})

/** ₪12.90 — returns '—' for null/undefined */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return ils.format(value)
}

/** Trims trailing zeros: 1.000 → "1", 0.652 → "0.652" */
export function formatQuantity(value: number): string {
  return Number(value.toFixed(3)).toString()
}

export function formatUnitQuantity(quantity: number, unit: Unit): string {
  return `${formatQuantity(quantity)} ${UNIT_LABELS[unit]}`
}

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return dateFmt.format(d)
}

const monthFmt = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' })

export function formatMonth(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return monthFmt.format(d)
}

/** ISO date (YYYY-MM-DD) for the first day of the given month offset from now. */
export function monthStartISO(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  return toDateOnly(d)
}

export function nextMonthStartISO(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return toDateOnly(d)
}

export function toDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const round2 = (n: number) => Math.round(n * 100) / 100
