// Pure logic for scope-fence: reading the fence, resolving paths, deciding what is inside.

export const FENCE_FILE = '.claude/fence.json'

/** Collapses `.` and `..` and repeated slashes. A path that climbs above its root keeps its leading `..`. */
export function normalize(path: string): string {
  const abs = path.startsWith('/')
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
      else if (!abs) out.push('..')
    } else out.push(part)
  }
  return (abs ? '/' : '') + out.join('/')
}

/** An absolute, normalized path: relative ones are taken from `cwd`. */
export const resolvePath = (path: string, cwd: string): string => normalize(path.startsWith('/') ? path : `${cwd}/${path}`)

/** The entries of a fence file: `{ "allow": [...] }` or a bare array; anything else is no fence. */
export function parseFence(text: string | null): string[] {
  if (!text) return []
  try {
    const json = JSON.parse(text) as unknown
    const list = Array.isArray(json) ? json : (json as { allow?: unknown } | null)?.allow
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()) : []
  } catch {
    return []
  }
}

export const formatFence = (allow: string[]): string => `${JSON.stringify({ allow }, null, 2)}\n`

/** The words after `/scope-fence`: paths separated by spaces or commas; `off`, `clear` or `none` is an empty fence. */
export function parseArgs(args: string): string[] | 'show' {
  const t = args.trim()
  if (t === '') return 'show'
  if (/^(off|clear|none)$/i.test(t)) return []
  return t.split(/[\s,]+/).filter(Boolean)
}

/** Whether `path` is one of the fence entries or beneath one. An entry is a file, a folder (`src/api/`) or absolute. */
export function isInside(path: string, fence: string[], cwd: string): boolean {
  if (fence.length === 0) return true
  const target = resolvePath(path, cwd)
  return fence.some(entry => {
    const root = resolvePath(entry, cwd)
    return target === root || target.startsWith(root === '/' ? '/' : `${root}/`)
  })
}

/** The paths a write call would touch. */
export function pathsOf(tool: string, e: Record<string, unknown>): string[] {
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') return typeof e.file_path === 'string' ? [e.file_path] : []
  return []
}

/** A path for display: relative to the working directory when it is beneath it. */
export const shown = (path: string, cwd: string): string => {
  const abs = resolvePath(path, cwd)
  return abs.startsWith(`${cwd}/`) ? abs.slice(cwd.length + 1) : abs
}
