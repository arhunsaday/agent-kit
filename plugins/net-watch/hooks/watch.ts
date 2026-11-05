// Pure logic for net-watch: which hosts a call names, and what the allow and deny lists say about them.

export const FILE = '.claude/net-watch.json'

export type Status = 'allowed' | 'denied' | 'new'

const LOCAL = /^(localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|\[?::1\]?)$/

const URL_RE = /\b(?:https?|ftp|wss?|git|ssh|git\+https?|git\+ssh):\/\/(?:[^\s/@'"`]*@)?(\[[0-9a-f:]+\]|[a-z0-9][a-z0-9.-]*)(?::\d+)?/gi
const SCP_RE = /\b[\w.-]+@([a-z0-9][a-z0-9.-]*\.[a-z]{2,}):[\w./~-]/gi
const BARE_RE = /^([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?::\d+)?(?:\/|$)/i
const NET_TOOL = /(?:^|[\s;&|(`])(curl|wget|http|https|git|npm|npx|pnpm|yarn|bun|pip3?|pipx|uv|gem|cargo|go)(?=\s|$)/g

/** A host in its lower-case form without brackets, a trailing dot or `www.` left alone (www.x.com is its own host). */
export const cleanHost = (h: string): string => h.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')

export const isLocal = (h: string): boolean => LOCAL.test(h)

/** Hosts a Bash command contacts, with the tool that does it: every URL beside a network tool, `curl example.com`, scp-style git remotes, and the default registry of an install. */
export function bashHosts(command: string): { host: string; via: string }[] {
  const tools = new Set<string>()
  for (const m of command.matchAll(NET_TOOL)) tools.add(m[1]!)
  if (tools.size === 0) return []
  const via = (tools.has('curl') && 'curl') || (tools.has('wget') && 'wget') || [...tools][0]!
  const found: { host: string; via: string }[] = []
  const add = (h: string, v = via) => {
    const host = cleanHost(h)
    if (host && !isLocal(host) && !found.some(f => f.host === host)) found.push({ host, via: v })
  }
  for (const m of command.matchAll(URL_RE)) add(m[1]!)
  if (tools.has('git')) for (const m of command.matchAll(SCP_RE)) add(m[1]!, 'git')
  if (tools.has('curl') || tools.has('wget') || tools.has('http') || tools.has('https')) {
    for (const tok of command.split(/\s+/)) {
      const t = tok.replace(/^['"]|['"]$/g, '')
      if (t.startsWith('-') || t.includes('://')) continue
      const m = BARE_RE.exec(t)
      if (m && !/\.(sh|json|txt|js|ts|py|md|zip|tar|gz|html|log|yml|yaml)$/i.test(m[1]!)) add(m[1]!)
    }
  }
  const installs = /\b(install|add|i|ci|update|up|publish|dlx|create|exec|download|sync)\b/.test(command)
  if (!found.length && installs) {
    if (['npm', 'pnpm', 'yarn', 'bun'].some(t => tools.has(t))) add('registry.npmjs.org', [...tools].find(t => ['npm', 'pnpm', 'yarn', 'bun'].includes(t))!)
    if (['pip', 'pip3', 'pipx', 'uv'].some(t => tools.has(t))) {
      const v = [...tools].find(t => ['pip', 'pip3', 'pipx', 'uv'].includes(t))!
      add('pypi.org', v)
      add('files.pythonhosted.org', v)
    }
  }
  if (!found.length && tools.has('npx')) add('registry.npmjs.org', 'npx')
  return found
}

/** Hosts a tool call contacts. Only WebFetch and Bash name any. */
export function hostsOf(tool: string, e: Record<string, unknown>): { host: string; via: string }[] {
  if (tool === 'WebFetch' && typeof e.url === 'string') {
    try {
      const h = cleanHost(new URL(e.url).hostname)
      return h && !isLocal(h) ? [{ host: h, via: 'WebFetch' }] : []
    } catch {
      return []
    }
  }
  if (tool === 'Bash' && typeof e.command === 'string') return bashHosts(e.command)
  return []
}

/** Whether `host` is `domain` or beneath it. */
export const covers = (domain: string, host: string): boolean => host === domain || host.endsWith(`.${domain}`)

/** The longest matching entry decides: `deny: a.com` with `allow: api.a.com` allows api.a.com. A tie goes to deny. */
export function statusOf(host: string, allow: string[], deny: string[]): Status {
  const best = (list: string[]) => list.filter(d => covers(d, host)).reduce((n, d) => Math.max(n, d.length), 0)
  const a = best(allow)
  const d = best(deny)
  if (a === 0 && d === 0) return 'new'
  return d >= a ? 'denied' : 'allowed'
}

export function parseList(text: string | null): { allow: string[]; deny: string[] } {
  const none = { allow: [], deny: [] }
  if (!text) return none
  try {
    const j = JSON.parse(text) as { allow?: unknown; deny?: unknown }
    const clean = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === 'string').map(s => cleanHost(s.trim())).filter(Boolean))] : [])
    return { allow: clean(j.allow), deny: clean(j.deny) }
  } catch {
    return none
  }
}

export const formatList = (allow: string[], deny: string[]): string => `${JSON.stringify({ allow, deny }, null, 2)}\n`

/** Sets a domain's answer: removes it from both lists first, so the latest word stands. */
export function setStatus(allow: string[], deny: string[], domain: string, to: 'allow' | 'deny' | 'forget') {
  const d = cleanHost(domain)
  const a2 = allow.filter(x => x !== d)
  const d2 = deny.filter(x => x !== d)
  if (to === 'allow') a2.push(d)
  if (to === 'deny') d2.push(d)
  return { allow: a2, deny: d2 }
}

/** The seen domains, new ones first, then by calls. */
export function ranked(seen: Record<string, { count: number; via: string }>, allow: string[], deny: string[]) {
  const order: Record<Status, number> = { new: 0, denied: 1, allowed: 2 }
  return Object.entries(seen)
    .map(([host, v]) => ({ host, ...v, status: statusOf(host, allow, deny) }))
    .sort((a, b) => order[a.status] - order[b.status] || b.count - a.count || a.host.localeCompare(b.host))
}
