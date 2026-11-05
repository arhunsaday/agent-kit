// decision-log: a decision stated in a prompt is appended to DECISIONS.md at the project root, with the date and a
// line of context. Regex only: no model call, nothing leaves the machine. A band shows the newest one.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LoggedDecision } from '../types'
import { appendDecision, dayOf, detectDecision, listing, parseDecisions } from './detect'

export { detectDecision, appendDecision, parseDecisions, formatEntry, dayOf, listing } from './detect'

const FILE = 'DECISIONS.md'
const last = atom({ plugin: 'decision-log', key: 'last' } as const, null as LoggedDecision | null)
const count = atom({ plugin: 'decision-log', key: 'count' } as const, 0)
const isShown = atom({ plugin: 'decision-log', key: 'isShown' } as const, true)

async function path($: EngineInterface): Promise<string> {
  return `${await $.session.cwd()}/${FILE}`
}

async function load($: EngineInterface): Promise<LoggedDecision[]> {
  const md = await $.fs.read(await path($)).catch(() => '')
  return typeof md === 'string' ? parseDecisions(md) : []
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'decision-log', description: 'List the decisions logged in DECISIONS.md (optional: how many, default 15)' })
    await $.command.register({ name: 'decision-log-band', description: 'Show or hide the band with the last decision' })
    if ((await $.store.get('isShown')) === false) await update($, isShown, () => false)
    const all = await load($)
    await update($, count, () => all.length)
    await update($, last, () => all[all.length - 1] ?? null)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    const found = detectDecision(e.text)
    if (found) {
      const file = await path($)
      const d: LoggedDecision = { date: dayOf(await $.clock.now()), text: found.text, context: found.context }
      const md = await $.fs.read(file).catch(() => null)
      const next_md = appendDecision(typeof md === 'string' ? md : null, d)
      if (next_md) {
        await $.fs.write(file, next_md)
        await update($, last, () => d)
        await update($, count, n => n + 1)
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e)) // a failed write never costs the person their prompt

  on('command.run', { command: 'decision-log' }, async ($, e) => {
    const all = await load($)
    const n = Number.parseInt(String(e.args ?? '').trim(), 10)
    return { text: listing(all, Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 15) }
  })

  on('command.run', { command: 'decision-log-band' }, async $ => {
    const was = await read($, isShown)
    await update($, isShown, () => !was)
    await $.store.set('isShown', !was)
    return { text: was ? 'Decision band hidden.' : 'Decision band shown.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const d = await read($, last)
    if (!d || e.props.hasSurvey || !(await read($, isShown))) return next(e)
    const n = await read($, count)
    const { Box, Text } = $.ui.resolve(e)
    const below = await next(e)
    const mine = (
      <Box key="decision-log" flexDirection="column">
        <Text wrap="truncate-end">
          <Text color="suggestion">{'◆ '}</Text>
          <Text bold>Decision</Text>
          <Text dimColor>{` · ${d.date} · ${n} logged`}</Text>
        </Text>
        <Text wrap="truncate-end">{d.text}</Text>
      </Box>
    )
    if (!below) return mine
    return (
      <Box flexDirection="column" rowGap={1}>
        {mine}
        {below}
      </Box>
    )
  })
}
