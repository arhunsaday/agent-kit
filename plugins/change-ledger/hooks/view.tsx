// The band: the files of the batch with their +/- lines. Host elements and theme colours only.

import type { Elements, RenderElement } from 'claude-code'

import type { LedgerEntry } from '../types'
import { rel, totals } from './ledger'

type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export type Model = { entries: LedgerEntry[]; cwd: string; isCollapsed: boolean }
export type Actions = { toggle: () => void; commit: () => void; clear: () => void }

export function band(E: Els, m: Model, a: Actions): RenderElement {
  const { Box, Text, Button } = E
  const n = m.entries.length
  const t = totals(m.entries)
  const chevron = <Button key="collapse" plain dimColor label={m.isCollapsed ? '▸' : '▾'} onPress={a.toggle} />

  const header = (
    <Box flexDirection="row" columnGap={1}>
      <Text wrap="truncate-end">
        <Text color="merged">{'± '}</Text>
        <Text bold>Change ledger</Text>
        <Text dimColor>{` · ${n} file${n === 1 ? '' : 's'} · `}</Text>
        <Text color="success">{`+${t.added}`}</Text>
        <Text dimColor>{' '}</Text>
        <Text color="error">{`−${t.removed}`}</Text>
      </Text>
      {chevron}
    </Box>
  )
  if (m.isCollapsed) return <Box key="change-ledger">{header}</Box>

  const shown = m.entries.slice(0, 6)
  const names = shown.map(e => rel(e.path, m.cwd))
  const w = Math.min(48, Math.max(...names.map(s => s.length)))
  return (
    <Box key="change-ledger" flexDirection="column" rowGap={1}>
      <Box flexDirection="column">
        {header}
        {shown.map((e, i) => (
          <Text wrap="truncate-end">
            <Text color={e.isNew ? 'success' : 'merged'}>{'● '}</Text>
            <Text>{names[i]!.padEnd(w + 2)}</Text>
            <Text color="success">{`+${e.added}`}</Text>
            <Text dimColor>{' '}</Text>
            <Text color="error">{`−${e.removed}`}</Text>
            <Text dimColor>{e.isNew ? ' · new' : e.edits > 1 ? ` · ${e.edits} edits` : ''}</Text>
          </Text>
        ))}
        {n > shown.length ? <Text dimColor>{`  … and ${n - shown.length} more`}</Text> : null}
      </Box>
      <Box flexDirection="row" columnGap={1}>
        <Button key="commit" label="Commit this batch" hotkey="c" variant="primary" onPress={a.commit} />
        <Button key="clear" label="Clear" hotkey="x" onPress={a.clear} />
      </Box>
    </Box>
  )
}
