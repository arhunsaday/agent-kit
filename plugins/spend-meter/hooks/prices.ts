// Fallback price table. The mod does NOT need it when the host reports the session cost
// (`$.session.usage().cost.usd`, which is what /cost totals): the table is only used when that is absent.
//
// Last checked: never. The table ships EMPTY on purpose, because list prices change and a wrong figure would pass
// for a measurement. Fill it in the plugin option `prices` (JSON) from your provider's price page; every value is
// US dollars per million tokens. VERIFY every figure you enter against the provider's current price page.

import type { ModelTokens } from '../types'

export type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }

/** Reads the `prices` option; anything that is not a table of finite non-negative numbers is dropped. */
export function parsePrices(raw: unknown): Record<string, Price> {
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof json !== 'object' || json === null) return {}
  const out: Record<string, Price> = {}
  for (const [model, p] of Object.entries(json as Record<string, Record<string, unknown>>)) {
    const n = (k: string) => (typeof p?.[k] === 'number' && Number.isFinite(p[k] as number) && (p[k] as number) >= 0 ? (p[k] as number) : null)
    const input = n('input')
    const output = n('output')
    if (input === null || output === null) continue
    out[model] = { input, output, cacheRead: n('cacheRead') ?? input, cacheWrite: n('cacheWrite') ?? input }
  }
  return out
}

/** Dollars for a token count at a price, or null when the model has no price. Prefix match: "m-1" prices "m-1-20260101". */
export function estimate(table: Record<string, Price>, model: string, t: Omit<ModelTokens, 'estimateUsd'>): number | null {
  const key = table[model] ? model : Object.keys(table).find(k => model.startsWith(k))
  const p = key ? table[key] : undefined
  if (!p) return null
  return (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead + t.cacheWrite * p.cacheWrite) / 1_000_000
}
