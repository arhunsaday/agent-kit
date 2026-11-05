// Pure logic for change-ledger: how many lines a call changed, the running batch, the commit request.

import type { LedgerEntry } from '../types'

export type Change = { path: string; added: number; removed: number; isNew: boolean }

/** Lines in a text: "" is none, "a" and "a\n" are one, "a\nb" is two. */
export function countLines(s: unknown): number {
  if (typeof s !== 'string' || s === '') return 0
  const n = s.split('\n').length
  return s.endsWith('\n') ? n - 1 : n
}

/** Added and removed lines in a structured patch (the hunks of an Edit or Write result): null when it is not one. */
export function patchCounts(patch: unknown): { added: number; removed: number } | null {
  if (!Array.isArray(patch)) return null
  let added = 0
  let removed = 0
  for (const hunk of patch) {
    const lines = (hunk as { lines?: unknown })?.lines
    if (!Array.isArray(lines)) return null
    for (const l of lines) {
      if (typeof l !== 'string') continue
      if (l.startsWith('+') && !l.startsWith('+++')) added++
      else if (l.startsWith('-') && !l.startsWith('---')) removed++
    }
  }
  return { added, removed }
}

/**
 * What a finished Write, Edit or MultiEdit changed. The result's own patch is used when the tool gave one;
 * otherwise the lines of what was replaced and what replaced it.
 */
export function changeOf(tool: string, e: Record<string, unknown>, result: unknown): Change | null {
  const path = typeof e.file_path === 'string' ? e.file_path : null
  if (!path) return null
  const r = (result ?? {}) as Record<string, unknown>
  const fromPatch = patchCounts(r.structuredPatch)
  if (tool === 'Write') {
    const isNew = r.type === 'create' || r.originalFile === null
    if (fromPatch && !isNew) return { path, ...fromPatch, isNew }
    return { path, added: countLines(e.content), removed: typeof r.originalFile === 'string' ? countLines(r.originalFile) : 0, isNew }
  }
  if (tool === 'Edit') {
    if (fromPatch) return { path, ...fromPatch, isNew: false }
    return { path, added: countLines(e.new_string), removed: countLines(e.old_string), isNew: false }
  }
  if (tool === 'MultiEdit') {
    if (fromPatch) return { path, ...fromPatch, isNew: false }
    const edits = Array.isArray(e.edits) ? (e.edits as Record<string, unknown>[]) : []
    return {
      path,
      added: edits.reduce((n, x) => n + countLines(x?.new_string), 0),
      removed: edits.reduce((n, x) => n + countLines(x?.old_string), 0),
      isNew: false,
    }
  }
  return null
}

/** Adds a change to the batch: one entry per file, sums kept, `isNew` only if the first touch created it. */
export function record(entries: LedgerEntry[], c: Change): LedgerEntry[] {
  const i = entries.findIndex(x => x.path === c.path)
  if (i < 0) return [...entries, { path: c.path, added: c.added, removed: c.removed, edits: 1, isNew: c.isNew }]
  const old = entries[i]!
  const next = { ...old, added: old.added + c.added, removed: old.removed + c.removed, edits: old.edits + 1 }
  return entries.map((x, j) => (j === i ? next : x))
}

export const totals = (entries: LedgerEntry[]) => ({
  added: entries.reduce((n, x) => n + x.added, 0),
  removed: entries.reduce((n, x) => n + x.removed, 0),
})

/** A path relative to the working directory when it is beneath it. */
export const rel = (path: string, cwd: string): string => (path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path)

/** Single-quotes a path for a shell. */
export const quote = (p: string): string => (/^[\w./@%+=:,-]+$/.test(p) ? p : `'${p.replace(/'/g, `'\\''`)}'`)

/** The message sent to Claude: commit these files and nothing else. */
export function commitPrompt(entries: LedgerEntry[], cwd: string): string {
  const files = entries.map(e => rel(e.path, cwd))
  const t = totals(entries)
  return [
    `Commit this batch of changes: ${entries.length} file${entries.length === 1 ? '' : 's'}, +${t.added} −${t.removed}. Stage exactly these files and nothing else, then make one commit with a clear message that matches this repository's style. Do not push.`,
    '',
    `git add -- ${files.map(quote).join(' ')}`,
    '',
    ...entries.map(e => `- ${rel(e.path, cwd)} (${e.isNew ? 'new, ' : ''}+${e.added} −${e.removed})`),
    '',
    'If git reports nothing to commit for some of them, or other staged changes are present, tell me before committing.',
  ].join('\n')
}
