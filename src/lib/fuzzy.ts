// Lightweight fuzzy matching for Hebrew product names.
// Used as a *fallback* when a receipt line has no barcode.
// Barcode remains the primary, trusted matching key (see receipts/confirm.ts).

/** Normalize a Hebrew product name for comparison. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/["'`׳״]/g, '') // gershayim / quotes
    .replace(/[^֐-׿a-z0-9%\s]/g, ' ') // keep Hebrew, latin, digits, %
    .replace(/\s+/g, ' ')
    .trim()
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  const clean = s.replace(/\s/g, '')
  for (let i = 0; i < clean.length - 1; i++) {
    const g = clean.slice(i, i + 2)
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

/** Dice coefficient over character bigrams — 0..1. */
export function similarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const ba = bigrams(na)
  const bb = bigrams(nb)
  if (ba.size === 0 || bb.size === 0) return 0

  let intersection = 0
  for (const [g, count] of ba) {
    const other = bb.get(g)
    if (other) intersection += Math.min(count, other)
  }
  const total = [...ba.values()].reduce((a, c) => a + c, 0) +
    [...bb.values()].reduce((a, c) => a + c, 0)
  return (2 * intersection) / total
}

export interface FuzzyMatch<T> {
  item: T
  score: number
}

/** Best fuzzy match above `threshold`, or null. */
export function bestMatch<T>(
  query: string,
  candidates: T[],
  getName: (c: T) => string,
  threshold = 0.6,
): FuzzyMatch<T> | null {
  let best: FuzzyMatch<T> | null = null
  for (const c of candidates) {
    const score = similarity(query, getName(c))
    if (score >= threshold && (!best || score > best.score)) {
      best = { item: c, score }
    }
  }
  return best
}
