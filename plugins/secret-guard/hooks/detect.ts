// secret-guard detector: pure functions, no engine. Finds credentials in text and describes them without revealing them.

export type Match = { kind: string; start: number; end: number; value: string; line: number }

type Rule = { kind: string; re: RegExp; group?: number }

/** Formats with a distinctive prefix. Order matters: a longer, more specific prefix comes before sk-. */
const RULES: Rule[] = [
  { kind: 'Private key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |PRIVATE )*PRIVATE KEY(?: BLOCK)?-----/g },
  { kind: 'AWS access key', re: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g },
  { kind: 'AWS secret key', re: /aws_?secret_?access_?key["']?\s*[=:]\s*["']?([A-Za-z0-9/+=]{40})\b/gi, group: 1 },
  { kind: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { kind: 'GitHub token', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
  { kind: 'Anthropic key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'OpenAI key', re: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g },
  { kind: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'Slack app token', re: /\bxapp-[0-9]-[A-Za-z0-9-]{10,}/g },
  { kind: 'Stripe key', re: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/g },
  { kind: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
]

/** password=..., token: "...", API_KEY=... with a value that looks random. */
const GENERIC =
  /\b([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|auth[_-]?key|access[_-]?key|private[_-]?key)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*["']?([^\s"'`,;)}\]]{12,})/gi

const PLACEHOLDER = /example|sample|placeholder|changeme|change-me|your[_-]|<[^>]*>|\$\{|\$\(|\$[A-Z_]+|%\w+%|\{\{|xxxx|\*{4}|•{3}|process\.env|os\.environ|getenv|redacted|dummy|fake|test/i

/** Shannon entropy in bits per character. */
export function entropy(s: string): number {
  if (!s) return 0
  const counts = new Map<string, number>()
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1)
  let h = 0
  for (const n of counts.values()) {
    const p = n / s.length
    h -= p * Math.log2(p)
  }
  return h
}

function classes(s: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(s)).length
}

/** A value that is a secret by its look: long enough, mixed, random-ish, not a placeholder or a code reference. */
export function looksRandom(value: string): boolean {
  if (value.length < 12 || PLACEHOLDER.test(value)) return false
  if (/^[A-Za-z_][A-Za-z0-9_]*\(/.test(value) || /^[a-z]+(?:[._][a-z]+)+$/.test(value)) return false // a call or a dotted/snake name
  if (/^[a-z]+(?:[A-Z][a-z]+)+$/.test(value)) return false // camelCase identifier
  if (/^[A-Za-z]+(?:[-_.][A-Za-z]+)+$/.test(value)) return false // words joined by - _ . with no digit
  return classes(value) >= 2 && entropy(value) >= 3.3
}

function isPlaceholderToken(v: string): boolean {
  return /example|xxxx|0000000|1111111|sample|placeholder|dummy|redacted/i.test(v) || /^(.)\1+$/.test(v.replace(/^[a-z_-]+/i, ''))
}

/** Hides the middle: the first four and last two characters stay, so the person can tell which key it is. */
export function mask(value: string): string {
  if (/^-----BEGIN/.test(value)) return value.split('\n')[0]!
  if (value.length <= 8) return '•'.repeat(value.length)
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(value.length - 6, 8))}${value.slice(-2)}`
}

function lineOf(text: string, index: number): number {
  let n = 1
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

/** Every secret in `text`, overlapping hits keeping the most specific, in order of position. */
export function findSecrets(text: string): Match[] {
  const found: Match[] = []
  const taken = (s: number, e: number) => found.some(m => s < m.end && e > m.start)

  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const value = rule.group ? m[rule.group]! : m[0]
      const start = (m.index ?? 0) + (rule.group ? m[0].indexOf(value) : 0)
      if (isPlaceholderToken(value) || taken(start, start + value.length)) continue
      found.push({ kind: rule.kind, start, end: start + value.length, value, line: lineOf(text, start) })
    }
  }
  for (const m of text.matchAll(GENERIC)) {
    const value = m[2]!
    const start = (m.index ?? 0) + m[0].lastIndexOf(value)
    if (!looksRandom(value) || taken(start, start + value.length)) continue
    found.push({ kind: `Secret in ${m[1]!.slice(0, 32)}`, start, end: start + value.length, value, line: lineOf(text, start) })
  }
  return found.sort((a, b) => a.start - b.start)
}

/** .env, .env.local, .env.production: yes; .env.example, .env.sample, .env.template: no. */
export function isEnvFile(path: string): boolean {
  const base = path.split(/[\\/]/).pop() ?? ''
  return /^\.env(\.[\w-]+)?$/i.test(base) && !/\.(example|sample|template|dist|defaults?)$/i.test(base)
}

/** KEY=value lines of a .env file with a real-looking value (any non-empty, non-placeholder one). */
export function findEnvValues(text: string): Match[] {
  const out: Match[] = []
  let offset = 0
  text.split('\n').forEach((line, i) => {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m) {
      const value = m[2]!.replace(/^(["'])(.*)\1$/, '$2')
      const isSecretName = /secret|token|key|password|passwd|pwd|credential|auth|dsn|url/i.test(m[1]!)
      if (value.length >= 6 && !PLACEHOLDER.test(value) && (isSecretName ? true : looksRandom(value))) {
        const start = offset + line.indexOf(m[2]!)
        out.push({ kind: `.env value ${m[1]!.slice(0, 32)}`, start, end: start + value.length, value, line: i + 1 })
      }
    }
    offset += line.length + 1
  })
  return out
}

export type Scan = { sink: 'disk' | 'network'; target: string; matches: Match[] }

const NETWORK = /(?:^|[\s;&|(])(?:curl|wget|http|https|xh|httpie|nc|ncat|netcat)\s/
const DISK = /(?:^|[^<>0-9&])>>?\s*[^\s&|>]|\btee\b|\bsed\s+(?:-[a-zA-Z]*i|--in-place)|\bdd\b[^|;]*\bof=/
const SENDS_ENV_FILE = /(?:-d|--data(?:-binary|-raw|-urlencode)?|-F|--form|-T|--upload-file|--post-file|--body-file)\s*[=\s]?\s*["']?[\w]*@?\S*\.env\b/

/** Which of a tool call's text would leave the machine or land on disk, and what in it is secret. */
export function scanCall(tool: string, input: Record<string, unknown>): Scan | null {
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  if (tool === 'Bash') {
    const command = str(input.command)
    const matches = findSecrets(command)
    const net = NETWORK.test(command)
    const disk = DISK.test(command)
    if (net && SENDS_ENV_FILE.test(command)) {
      matches.push({ kind: '.env file uploaded', start: 0, end: 0, value: '.env', line: 1 })
    }
    if (matches.length === 0 || (!net && !disk)) return null
    const first = command.trim().split(/\s+/)[0] ?? 'shell'
    return { sink: net ? 'network' : 'disk', target: net ? (/\b(curl|wget|http|https|xh|httpie|nc|ncat|netcat)\b/.exec(command)?.[1] ?? first) : 'shell redirect', matches }
  }

  let path = ''
  let texts: string[] = []
  if (tool === 'Write') {
    path = str(input.file_path)
    texts = [str(input.content)]
  } else if (tool === 'Edit') {
    path = str(input.file_path)
    texts = [str(input.new_string)]
  } else if (tool === 'MultiEdit') {
    path = str(input.file_path)
    texts = Array.isArray(input.edits) ? input.edits.map(e => str((e as Record<string, unknown>)?.new_string)) : []
  } else if (tool === 'NotebookEdit') {
    path = str(input.notebook_path)
    texts = [str(input.new_source)]
  } else return null

  const matches: Match[] = []
  let line0 = 0
  for (const t of texts) {
    const found = findSecrets(t)
    if (isEnvFile(path)) for (const f of findEnvValues(t)) if (!found.some(g => f.start < g.end && f.end > g.start)) found.push(f)
    for (const f of found) matches.push({ ...f, line: f.line + line0 })
    line0 += t.split('\n').length
  }
  if (matches.length === 0) return null
  return { sink: 'disk', target: path || tool, matches }
}
