// scope-fence: the paths Claude may change are declared in .claude/fence.json (or /scope-fence src/api/). A Write,
// Edit or MultiEdit outside them is held in a band: Allow once lets that call through, Block refuses it.
// Bash, NotebookEdit and MCP tools are not fenced (see the README): this is a guard rail on Claude's file tools.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HeldWrite } from '../types'
import { FENCE_FILE, formatFence, isInside, parseArgs, parseFence, pathsOf, shown } from './fence'
import { band } from './view'

export { normalize, resolvePath, parseFence, parseArgs, isInside, pathsOf, formatFence, shown } from './fence'

const fenceAtom = atom({ plugin: 'scope-fence', key: 'fence' } as const, [] as string[])
const heldAtom = atom({ plugin: 'scope-fence', key: 'held' } as const, null as HeldWrite | null)
const countsAtom = atom({ plugin: 'scope-fence', key: 'counts' } as const, { held: 0, allowed: 0 })
const collapsedAtom = atom({ plugin: 'scope-fence', key: 'isCollapsed' } as const, false)

const COMMANDS = [
  { name: 'scope-fence', description: 'Show the fence, or set it: /scope-fence src/api/ tests/ (off clears it)' },
  { name: 'scope-fence-collapse', description: 'Scope fence band: fold it to one line, or open it again' },
]

export function timeoutFrom(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

/** The fence from the file (read on every call, so an edit by hand counts at once); the state follows it. */
async function loadFence($: EngineInterface): Promise<string[]> {
  const text = await $.fs.read(`${await $.session.cwd()}/${FENCE_FILE}`).catch(() => null)
  const fence = parseFence(typeof text === 'string' ? text : null)
  if (JSON.stringify(fence) !== JSON.stringify(await read($, fenceAtom))) await update($, fenceAtom, () => fence)
  return fence
}

const TOOLS = ['Write', 'Edit', 'MultiEdit'] as const

export const register: Register = (on, options) => {
  const timeoutSeconds = timeoutFrom(options.timeoutSeconds)
  const decisions = new Map<string, 'block' | 'allow'>()
  let holder: string | null = null
  let secondsLeft: number | null = null

  on('session.start', async ($, e, next) => {
    for (const c of COMMANDS) await $.command.register(c)
    if ((await $.store.get('isCollapsed')) === true) await update($, collapsedAtom, () => true)
    await loadFence($)
    return next(e)
  })

  for (const tool of TOOLS) {
    on('tool.call', { tool: tool as 'Write' }, async ($: EngineInterface, e: any, next: any) => {
      const fence = await loadFence($)
      if (fence.length === 0) return next(e)
      const cwd = await $.session.cwd()
      const outside = pathsOf(tool, e).filter(p => !isInside(p, fence, cwd))
      if (outside.length === 0) return next(e)
      const path: string = outside[0]!
      const says = `scope-fence: ${shown(path, cwd)} is outside the fence (${fence.join(', ')}).`

      // Nothing draws the session (claude -p): nobody can answer, so refuse.
      if ((await $.session.surfaces()).length === 0) return { deny: `${says} Stay inside the fence, or ask the user to widen it with /scope-fence.` }

      for (;;) {
        if (next.signal.aborted) return { deny: 'scope-fence: held this write, but it was stopped before it was shown.' }
        if (holder === null && (await read($, heldAtom)) === null) break
        await $.process.run(['sleep', '0.25'])
      }
      holder = e.tool_use_id
      try {
        const id: string = e.tool_use_id
        await update($, heldAtom, () => ({ id, tool, path }))
        await update($, countsAtom, c => ({ ...c, held: c.held + 1 }))
        const deadline = timeoutSeconds > 0 ? (await $.clock.now()) + timeoutSeconds * 1000 : null
        let isTimedOut = false
        while (!decisions.has(id) && !next.signal.aborted) {
          if (deadline !== null) {
            const left = Math.ceil((deadline - (await $.clock.now())) / 1000)
            if (left <= 0) {
              isTimedOut = !decisions.has(id)
              break
            }
            if (left !== secondsLeft) {
              secondsLeft = left
              await update($, heldAtom, h => (h ? { ...h } : h)) // redraw the countdown
            }
          }
          await $.process.run(['sleep', '0.25'])
        }
        const decision = isTimedOut ? 'block' : (decisions.get(id) ?? 'block')
        decisions.delete(id)
        await update($, heldAtom, () => null)
        if (decision === 'allow') {
          await update($, countsAtom, c => ({ ...c, allowed: c.allowed + 1 }))
          return next(e) // this call only: the next write outside is held again
        }
        return {
          deny: `${says} ${isTimedOut ? `Nobody answered within ${timeoutSeconds} s. ` : 'The user blocked it. '}Don't retry this path; stay inside the fence, or ask the user to widen it with /scope-fence.`,
        }
      } finally {
        holder = null
        secondsLeft = null
        await update($, heldAtom, h => (h && h.id === e.tool_use_id ? null : h)).catch(() => undefined)
      }
    })
  }

  on('command.run', { command: 'scope-fence' }, async ($, e) => {
    const arg = parseArgs(String(e.args ?? ''))
    if (arg === 'show') {
      const fence = await loadFence($)
      return { text: fence.length ? `Fence (${FENCE_FILE}):\n${fence.map(p => `  ${p}`).join('\n')}` : `No fence. /scope-fence src/api/ sets one (written to ${FENCE_FILE}).` }
    }
    await $.fs.write(`${await $.session.cwd()}/${FENCE_FILE}`, formatFence(arg))
    await update($, fenceAtom, () => arg)
    return { text: arg.length ? `Fence set: ${arg.join(', ')}. Writes outside are held.` : 'Fence cleared. Writes are not held.' }
  })

  on('command.run', { command: 'scope-fence-collapse' }, async $ => {
    const isCollapsed = !(await read($, collapsedAtom))
    await update($, collapsedAtom, () => isCollapsed)
    await $.store.set('isCollapsed', isCollapsed)
    return { text: isCollapsed ? 'Scope fence band collapsed to one line.' : 'Scope fence band expanded.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId !== undefined) return next(e)
    const [fence, held, isCollapsed] = await Promise.all([read($, fenceAtom), read($, heldAtom), read($, collapsedAtom)])
    if (fence.length === 0 && !held) return next(e)
    const cwd = await $.session.cwd()
    const E = $.ui.resolve(e)
    const mine = band(
      E as Parameters<typeof band>[0],
      { fence, held, isCollapsed, shownPath: held ? shown(held.path, cwd) : '', secondsLeft: held ? secondsLeft : null },
      {
        toggle: () => {
          void (async () => {
            const was = await read($, collapsedAtom)
            await update($, collapsedAtom, () => !was)
            await $.store.set('isCollapsed', !was)
          })()
        },
        block: () => held && decisions.set(held.id, 'block'),
        allow: () => held && decisions.set(held.id, 'allow'),
      },
    )
    const below = await next(e)
    if (!below) return mine
    const { Box } = E
    return (
      <Box flexDirection="column" rowGap={1}>
        {mine}
        {below}
      </Box>
    )
  })
}
