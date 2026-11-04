// change-ledger: the files Claude changed with Write, Edit and MultiEdit, with the lines added and removed, in a band
// above the prompt. "Commit this batch" asks Claude to stage exactly those files and commit them, then starts a new
// batch. Changes made by Bash (sed -i, a formatter, git checkout) are not seen: see the README.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LedgerEntry } from '../types'
import { changeOf, commitPrompt, record, rel, totals } from './ledger'
import { band } from './view'

export { countLines, patchCounts, changeOf, record, totals, commitPrompt, quote, rel } from './ledger'

const entriesAtom = atom({ plugin: 'change-ledger', key: 'entries' } as const, [] as LedgerEntry[])
const batchesAtom = atom({ plugin: 'change-ledger', key: 'batches' } as const, 0)
const collapsedAtom = atom({ plugin: 'change-ledger', key: 'isCollapsed' } as const, false)

const COMMANDS = [
  { name: 'change-ledger', description: 'List the files changed in this batch with +/- lines' },
  { name: 'change-ledger-collapse', description: 'Change ledger band: fold it to one line, or open it again' },
]

/** Hands the batch to Claude to commit, and starts the next one. */
async function commitBatch($: EngineInterface): Promise<boolean> {
  const entries = await read($, entriesAtom)
  if (entries.length === 0) return false
  const text = commitPrompt(entries, await $.session.cwd())
  try {
    await $.prompt.submit({ text })
  } catch {
    $.ui.toast('Could not send the commit request right now.')
    return false
  }
  await update($, entriesAtom, () => [])
  await update($, batchesAtom, n => n + 1)
  return true
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const c of COMMANDS) await $.command.register(c)
    if ((await $.store.get('isCollapsed')) === true) await update($, collapsedAtom, () => true)
    return next(e)
  })

  for (const tool of ['Write', 'Edit', 'MultiEdit'] as const) {
    on('tool.call', { tool: tool as 'Write' }, async ($: EngineInterface, e: any, next: any) => {
      const ran = await next(e)
      if (ran.deny !== undefined || ran.isError === true || e.agentId !== undefined) return ran
      const change = changeOf(tool, e as Record<string, unknown>, ran.result)
      if (change) await update($, entriesAtom, list => record(list, change))
      return ran
    }).catch(($: EngineInterface, e: any, next: any) => next(e))
  }

  on('command.run', { command: 'change-ledger' }, async $ => {
    const entries = await read($, entriesAtom)
    const cwd = await $.session.cwd()
    if (entries.length === 0) return { text: 'No files changed in this batch.' }
    const t = totals(entries)
    return { text: [`${entries.length} file${entries.length === 1 ? '' : 's'}, +${t.added} −${t.removed}:`, ...entries.map(e => `${rel(e.path, cwd)} · +${e.added} −${e.removed}${e.isNew ? ' · new' : ''}`)].join('\n') }
  })

  on('command.run', { command: 'change-ledger-collapse' }, async $ => {
    const isCollapsed = !(await read($, collapsedAtom))
    await update($, collapsedAtom, () => isCollapsed)
    await $.store.set('isCollapsed', isCollapsed)
    return { text: isCollapsed ? 'Change ledger band collapsed to one line.' : 'Change ledger band expanded.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId !== undefined) return next(e)
    const [entries, isCollapsed] = await Promise.all([read($, entriesAtom), read($, collapsedAtom)])
    if (entries.length === 0) return next(e)
    const E = $.ui.resolve(e)
    const mine = band(E as Parameters<typeof band>[0], { entries, cwd: await $.session.cwd(), isCollapsed }, {
      toggle: () => {
        void (async () => {
          const was = await read($, collapsedAtom)
          await update($, collapsedAtom, () => !was)
          await $.store.set('isCollapsed', !was)
        })()
      },
      commit: () => void commitBatch($),
      clear: () => void update($, entriesAtom, () => []),
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
