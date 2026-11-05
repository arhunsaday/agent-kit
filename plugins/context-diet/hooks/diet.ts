// Pure logic for context-diet: size estimates, labels, the offender list.

import type { BigResult, RereadFile } from '../types'

export const REREAD_AT = 3
export const MAX_RESULTS = 20

/** Tokens at 4 characters each: an estimate, said so wherever it is shown. */
export const tokensOf = (text: string): number => Math.ceil(text.length / 4)

export const fmtTokens = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n))

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** A short name for what a call asked, by tool. */
export function labelOf(tool: string, e: Record<string, unknown>): string {
  const str = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const first = str('file_path') || str('path') || str('notebook_path') || str('url') || str('command') || str('pattern') || str('query')
  return clip(first.replace(/\s+/g, ' ').trim(), 60) || tool
}

/** The text of a result, as the model read it: `text` when core set one, else the record stringified. */
export function resultText(r: { text?: string; result?: unknown } | undefined): string {
  if (!r) return ''
  if (typeof r.text === 'string') return r.text
  try {
    return r.result === undefined ? '' : JSON.stringify(r.result)
  } catch {
    return ''
  }
}

/** Adds a result to the ranked list: largest first, capped. A result under `floor` tokens is not kept. */
export function addResult(list: BigResult[], r: BigResult, floor: number): BigResult[] {
  if (r.tokens < floor) return list
  return [...list.filter(x => x.id !== r.id), r].sort((a, b) => b.tokens - a.tokens).slice(0, MAX_RESULTS)
}

export function addRead(reads: Record<string, { count: number; tokens: number }>, path: string, tokens: number) {
  const old = reads[path] ?? { count: 0, tokens: 0 }
  return { ...reads, [path]: { count: old.count + 1, tokens: old.tokens + tokens } }
}

export const rereads = (reads: Record<string, { count: number; tokens: number }>): RereadFile[] =>
  Object.entries(reads)
    .filter(([, v]) => v.count >= REREAD_AT)
    .map(([path, v]) => ({ path, ...v }))
    .sort((a, b) => b.tokens - a.tokens)

export type Offender = { kind: 'big' | 'reread'; label: string; detail: string; tokens: number }

/** The top offenders of both kinds, by tokens: what to look at first. */
export function offenders(results: BigResult[], reads: Record<string, { count: number; tokens: number }>, limit = 3): Offender[] {
  const all: Offender[] = [
    ...results.map(r => ({ kind: 'big' as const, label: r.label, detail: `${r.tool} · ~${fmtTokens(r.tokens)} tokens`, tokens: r.tokens })),
    ...rereads(reads).map(f => ({ kind: 'reread' as const, label: f.path, detail: `read ${f.count}× · ~${fmtTokens(f.tokens)} tokens`, tokens: f.tokens })),
  ]
  return all.sort((a, b) => b.tokens - a.tokens).slice(0, limit)
}

export const cleanThreshold = (v: unknown, d: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= 1 ? n : d
}
