// context-diet: watches what goes into the context. A tool result over a size, and a file read three times or
// more, are listed as offenders in a band; past a fill threshold (60% by default) the band suggests /compact.
// Sizes are estimates (4 characters a token) of the text the model read; the fill is the host's own figure.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BigResult } from '../types'
import { addRead, addResult, cleanThreshold, fmtTokens, labelOf, offenders, REREAD_AT, resultText, tokensOf } from './diet'
import { band } from './view'

export { tokensOf, labelOf, addResult, addRead, rereads, offenders, resultText, cleanThreshold } from './diet'

const resultsAtom = atom({ plugin: 'context-diet', key: 'results' } as const, [] as BigResult[])
const readsAtom = atom({ plugin: 'context-diet', key: 'reads' } as const, {} as Record<string, { count: number; tokens: number }>)
const percentAtom = atom({ plugin: 'context-diet', key: 'percent' } as const, null as number | null)
const collapsedAtom = atom({ plugin: 'context-diet', key: 'isCollapsed' } as const, false)
const suggestedAtom = atom({ plugin: 'context-diet', key: 'isSuggested' } as const, false)

const COMMANDS = [
  { name: 'context-diet', description: 'List the biggest tool results and the files read most' },
  { name: 'context-diet-collapse', description: 'Context diet band: fold it to one line, or open it again' },
]

async function setPercent($: EngineInterface, percent: number | null, threshold: number) {
  await update($, percentAtom, () => percent)
  if (percent === null) return
  if (percent < threshold) {
    await update($, suggestedAtom, () => false)
  } else if (!(await read($, suggestedAtom))) {
    await update($, suggestedAtom, () => true)
    $.ui.toast(`Context is ${percent}% full. /compact would free room.`)
  }
}

async function forget($: EngineInterface) {
  await update($, resultsAtom, () => [])
  await update($, readsAtom, () => ({}))
  await update($, suggestedAtom, () => false)
}

export const register: Register = (on, options) => {
  const threshold = cleanThreshold(options.thresholdPercent, 60)
  const bigAt = cleanThreshold(options.bigResultTokens, 8000)

  on('session.start', async ($, e, next) => {
    for (const c of COMMANDS) await $.command.register(c)
    if ((await $.store.get('isCollapsed')) === true) await update($, collapsedAtom, () => true)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined || ran.deny !== undefined) return ran // a subagent's results never reach this context
    const tokens = tokensOf(resultText(ran))
    if (tokens === 0) return ran
    const call = e as unknown as Record<string, unknown>
    const label = labelOf(e.tool, call)
    const before = await read($, resultsAtom)
    await update($, resultsAtom, list => addResult(list, { id: e.tool_use_id, tool: e.tool, label, tokens }, bigAt))
    if (tokens >= bigAt && !before.some(r => r.id === e.tool_use_id)) {
      $.ui.toast(`Big tool result: ${e.tool} ${label} (~${fmtTokens(tokens)} tokens)`)
    }
    if (e.tool === 'Read' && typeof call.file_path === 'string') {
      const path = call.file_path
      const was = (await read($, readsAtom))[path]?.count ?? 0
      await update($, readsAtom, r => addRead(r, path, tokens))
      if (was + 1 === REREAD_AT) $.ui.toast(`${path} has been read ${REREAD_AT} times.`)
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await setPercent($, typeof e.context.percent === 'number' ? Math.round(e.context.percent) : null, threshold)
    return next(e)
  })

  // /compact, ours or the person's: what was read is summarized away.
  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (r.skip === undefined) await forget($)
    return r
  })

  on('command.run', { command: 'context-diet' }, async $ => {
    const [results, reads, percent] = await Promise.all([read($, resultsAtom), read($, readsAtom), read($, percentAtom)])
    const top = offenders(results, reads, 10)
    const head = `Context ${percent === null ? 'unknown' : `${percent}%`} full · suggests /compact at ${threshold}% · big result = ~${fmtTokens(bigAt)} tokens (estimated)`
    return { text: [head, ...(top.length ? top.map(o => `${o.label} · ${o.detail}`) : ['No offenders.'])].join('\n') }
  })

  on('command.run', { command: 'context-diet-collapse' }, async $ => {
    const isCollapsed = !(await read($, collapsedAtom))
    await update($, collapsedAtom, () => isCollapsed)
    await $.store.set('isCollapsed', isCollapsed)
    return { text: isCollapsed ? 'Context diet band collapsed to one line.' : 'Context diet band expanded.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId !== undefined) return next(e)
    const [results, reads, percent, isCollapsed] = await Promise.all([read($, resultsAtom), read($, readsAtom), read($, percentAtom), read($, collapsedAtom)])
    const list = offenders(results, reads)
    const isOver = percent !== null && percent >= threshold
    if (list.length === 0 && !isOver) return next(e)
    const E = $.ui.resolve(e)
    const mine = band(E as Parameters<typeof band>[0], { percent, threshold, offenders: list, isCollapsed }, {
      toggle: () => {
        void (async () => {
          const was = await read($, collapsedAtom)
          await update($, collapsedAtom, () => !was)
          await $.store.set('isCollapsed', !was)
        })()
      },
      compact: async () => {
        try {
          const r = await $.session.compact()
          if (r.skip !== undefined) $.ui.toast('Compaction was skipped.')
          else await forget($) // our own call is not seen by our own session.compact hook
        } catch {
          $.ui.toast('Compact runs between turns: try again when this one finishes.')
        }
      },
    })
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
