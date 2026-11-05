// secret-guard: before Write, Edit, MultiEdit, NotebookEdit and Bash, look for credentials that would be written to
// disk or sent over the network. A hit is held in a band with a masked preview; the person blocks it or allows
// that one call. The secret itself is never shown, logged or put in the message Claude reads.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HeldCall } from '../types'
import { mask, scanCall } from './detect'
import { report, type Decision } from './view'

export { findSecrets, findEnvValues, isEnvFile, mask, scanCall, entropy } from './detect'

const held = atom({ plugin: 'secret-guard', key: 'held' } as const, null as HeldCall | null)

export function timeoutFrom(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 60
}

const TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash'] as const

export const register: Register = (on, options) => {
  const timeoutSeconds = timeoutFrom(options.timeoutSeconds)
  const decisions = new Map<string, Decision>()
  let holder: string | null = null

  for (const tool of TOOLS) {
    on('tool.call', { tool: tool as 'Bash' }, async ($: EngineInterface, e: any, next: any) => {
      const scan = scanCall(tool, e as Record<string, unknown>)
      if (!scan) return next(e)

      const findings = scan.matches.map(m => ({ kind: m.kind, preview: mask(m.value), line: m.line }))
      const summary = findings.map(f => `${f.kind} ${f.preview} (line ${f.line})`).join('; ')
      const where = scan.sink === 'network' ? `sent with ${scan.target}` : `written to ${scan.target}`

      // Nothing draws the session (claude -p): nobody can answer, so refuse.
      if ((await $.session.surfaces()).length === 0) {
        return {
          deny: `secret-guard: blocked, this would have ${where} and contains ${summary}. Use an environment variable or a secret manager instead of the literal value.`,
        }
      }

      for (;;) {
        if (next.signal.aborted) return { deny: 'secret-guard: held this call, but it was stopped before it was shown.' }
        if (holder === null && (await read($, held)) === null) break
        await $.process.run(['sleep', '0.25'])
      }
      holder = e.tool_use_id
      try {
        const one: HeldCall = {
          id: e.tool_use_id,
          tool,
          target: scan.target,
          sink: scan.sink,
          findings,
          secondsLeft: timeoutSeconds > 0 ? timeoutSeconds : null,
          timeoutSeconds: timeoutSeconds > 0 ? timeoutSeconds : null,
        }
        await update($, held, () => one)

        const deadline = timeoutSeconds > 0 ? (await $.clock.now()) + timeoutSeconds * 1000 : null
        let isTimedOut = false
        while (!decisions.has(one.id) && !next.signal.aborted) {
          if (deadline !== null) {
            const left = Math.ceil((deadline - (await $.clock.now())) / 1000)
            if (left <= 0) {
              isTimedOut = !decisions.has(one.id)
              break
            }
            if (left !== one.secondsLeft) {
              one.secondsLeft = left
              await update($, held, h => (h && h.id === one.id ? { ...h, secondsLeft: left } : h))
            }
          }
          await $.process.run(['sleep', '0.25'])
        }
        const decision = isTimedOut ? 'block' : (decisions.get(one.id) ?? 'block')
        decisions.delete(one.id)
        await update($, held, () => null)

        if (decision === 'allow') return next(e) // this call only: the next one is scanned again
        return {
          deny:
            `secret-guard: ${isTimedOut ? `nobody answered within ${timeoutSeconds} s, so ` : 'the user '}blocked this call. ` +
            `It would have ${where} and contains ${summary}. ` +
            `Read the value from an environment variable or a secret manager instead, and keep it out of files and commands. Don't retry with the literal value.`,
        }
      } finally {
        holder = null
        await update($, held, h => (h && h.id === e.tool_use_id ? null : h)).catch(() => {})
      }
    })
  }

  const decide = (id: string, d: Decision) => {
    decisions.set(id, d)
  }

  // A held call takes the top of the band until answered; what the host and other mods draw there stays under it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const one = await read($, held)
    if (!one || e.props.hasSurvey) return next(e)
    const E = $.ui.resolve(e)
    const mine = report(E, one, decide)
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
