// Pure helpers for spend-meter: formatting, the budget bar and its level.

export type Level = 'ok' | 'near' | 'over'

export const fmtUsd = (n: number | null): string => {
  if (n === null) return '—'
  if (n > 0 && n < 0.01) return '<$0.01'
  return `$${n.toFixed(n >= 100 ? 0 : 2)}`
}

export const fmtTokens = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n))

/** Fraction of the budget spent (may pass 1); null with no budget or no reading. */
export const fraction = (spent: number | null, budget: number): number | null => (spent === null || !(budget > 0) ? null : spent / budget)

export const levelOf = (f: number | null): Level => (f === null ? 'ok' : f >= 1 ? 'over' : f >= 0.8 ? 'near' : 'ok')

export const LEVEL_COLOR: Record<Level, 'success' | 'warning' | 'error'> = { ok: 'success', near: 'warning', over: 'error' }

/** A bar `width` cells wide: filled cells and empty ones. */
export function bar(f: number, width: number): { filled: string; empty: string } {
  const n = Math.max(0, Math.min(width, Math.round(Math.max(0, f) * width)))
  return { filled: '█'.repeat(n), empty: '░'.repeat(width - n) }
}

/** Which threshold a move from `before` to `after` (as fractions) crossed: 80% once, 100% once. */
export function crossed(before: number | null, after: number | null): 'near' | 'over' | null {
  if (after === null) return null
  const b = before ?? 0
  if (b < 1 && after >= 1) return 'over'
  if (b < 0.8 && after >= 0.8) return 'near'
  return null
}

export const cleanBudget = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/^\$/, '').trim())
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 5
}
