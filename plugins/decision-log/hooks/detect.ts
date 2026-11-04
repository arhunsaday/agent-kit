// decision-log detector and file format: pure functions, regex only, no model calls.

import type { LoggedDecision } from '../types'

/** Phrases that announce a decision, French and English. Matched on a lower-cased, accent-folded sentence. */
const CUES: RegExp[] = [
  // French
  /\bon part sur\b/,
  /\bon garde\b/,
  /\bon reste (?:sur|avec)\b/,
  /\bon (?:retient|valide|choisit|opte pour|adopte|tranche)\b/,
  /\bon y va (?:avec|sur)\b/,
  /\b(?:c'est|ce sera) (?:decide|tranche|valide)\b/,
  /\bdecision\s*:/,
  /\bdecision (?:prise|finale)\b/,
  /\bj'ai decide\b/,
  /\bon a decide\b/,
  /\bon (?:abandonne|renonce a)\b/,
  /\bdecide(?:s)?\s*:/,
  // English
  /\bwe(?:'ll| will) go with\b/,
  /\bwe(?:'re| are) going with\b/,
  /\blet'?s go with\b/,
  /\b(?:we|i)(?:'ve| have)? decided\b/,
  /\b(?:we|i) decide to\b/,
  /\bdecision\s*:/,
  /\bdecided\s*:/,
  /\bwe(?:'ll| will) (?:keep|stick with|use|adopt|drop)\b/,
  /\bwe(?:'re| are) (?:keeping|sticking with|dropping)\b/,
  /\bfinal (?:answer|call|decision)\b/,
]

/** A cue that is negated, hypothetical or a question about a decision, not one. */
const VETO =
  /\b(?:pas (?:encore )?(?:decide|tranche)|reste a (?:decider|trancher)|a decider|n'avons pas decide|n'ai pas decide|on verra|si on (?:part|garde)|not (?:yet )?decided|haven't decided|have not decided|undecided|to be decided|tbd|yet to decide|once we decide|if we (?:go|decide|keep)|should we|shall we|do we|did we|have we|what(?:'s| is| was) the decision)\b/

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")

/** Prose of a prompt: code fences, quoted lines and inline code removed. */
function prose(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*>.*$/gm, ' ')
    .replace(/`[^`]*`/g, ' ')
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

export type Found = { text: string; context: string }

/** The first sentence of a prompt that states a decision, with a line of context; null when there is none. */
export function detectDecision(prompt: string): Found | null {
  const trimmed = prompt.trim()
  if (!trimmed || trimmed.startsWith('/')) return null
  const all = sentences(prose(trimmed))
  for (let i = 0; i < all.length; i++) {
    const s = all[i]!
    if (s.length < 8 || /[?]\s*$/.test(s)) continue
    const f = fold(s)
    if (VETO.test(f) || !CUES.some(re => re.test(f))) continue
    const before = all.slice(0, i).reverse().find(p => p.length >= 8 && !p.endsWith('?'))
    const after = all[i + 1]
    const context = before ?? (after && !after.endsWith('?') ? after : '') ?? ''
    return { text: clip(s, 240), context: clip(context, 140) }
  }
  return null
}

export const HEADER = '# Decisions\n\nAppended by the decision-log mod from the prompts of Claude Code sessions. Edit freely.\n\n'

export function formatEntry(d: LoggedDecision): string {
  return `- ${d.date} · ${d.text}\n${d.context ? `  - context: ${d.context}\n` : ''}`
}

/** Entries of a DECISIONS.md, oldest first. */
export function parseDecisions(md: string): LoggedDecision[] {
  const out: LoggedDecision[] = []
  for (const line of md.split('\n')) {
    const m = /^- (\d{4}-\d{2}-\d{2}) · (.+)$/.exec(line)
    if (m) out.push({ date: m[1]!, text: m[2]!.trim(), context: '' })
    else {
      const c = /^\s+- context: (.+)$/.exec(line)
      if (c && out.length) out[out.length - 1]!.context = c[1]!.trim()
    }
  }
  return out
}

/** The file with `d` added, or null when the same decision is already among the last 50. */
export function appendDecision(md: string | null, d: LoggedDecision): string | null {
  const norm = (s: string) => fold(s).replace(/\W+/g, ' ').trim()
  if (md && parseDecisions(md).slice(-50).some(x => norm(x.text) === norm(d.text))) return null
  const base = md && md.trim() ? (md.endsWith('\n') ? md : `${md}\n`) : HEADER
  return base + formatEntry(d)
}

/** YYYY-MM-DD of a time in ms, in the machine's local time. */
export function dayOf(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** The listing /decision-log answers: newest first, at most `limit`. */
export function listing(all: LoggedDecision[], limit: number): string {
  if (all.length === 0) return "No decision logged yet. Say it in a prompt: \"on part sur…\", \"on garde…\", \"we'll go with…\", \"decided: …\"."
  const shown = all.slice(-limit).reverse()
  const lines = shown.map(d => `${d.date} · ${d.text}${d.context ? `\n    ${d.context}` : ''}`)
  const more = all.length - shown.length
  return `${all.length} decision${all.length > 1 ? 's' : ''} in DECISIONS.md\n\n${lines.join('\n')}${more > 0 ? `\n\n… and ${more} older` : ''}`
}
