// The band: host elements and theme colours only, laid out as the other mods.

import type { Elements, RenderElement } from 'claude-code'

import type { HeldPrompt } from '../types'
import { bar, fmtUsd, fraction, LEVEL_COLOR, levelOf } from './money'

type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export type Model = {
  spentUsd: number | null
  turnUsd: number | null
  turns: number
  budgetUsd: number
  held: HeldPrompt | null
  isCollapsed: boolean
}

export type Actions = { toggle: () => void; cancel: () => void; proceed: () => void }

export function band(E: Els, m: Model, width: number, a: Actions): RenderElement {
  const { Box, Text, Button } = E
  const f = fraction(m.spentUsd, m.budgetUsd)
  const color = LEVEL_COLOR[levelOf(f)]
  const chevron = <Button key="collapse" plain dimColor label={m.isCollapsed ? '▸' : '▾'} onPress={a.toggle} />
  const pct = f === null ? '' : `${Math.round(f * 100)}% of ${fmtUsd(m.budgetUsd)}`

  const header = (
    <Box flexDirection="row" columnGap={1}>
      <Text wrap="truncate-end">
        <Text color={m.held ? 'error' : color}>{m.held ? '⚠ ' : '$ '}</Text>
        <Text bold>{m.held ? 'Budget reached' : 'Spend'}</Text>
        <Text dimColor>{` · ${fmtUsd(m.spentUsd)} session · ${fmtUsd(m.turnUsd)} last turn`}</Text>
        {m.isCollapsed && pct ? <Text dimColor>{` · ${pct}`}</Text> : null}
      </Text>
      {chevron}
    </Box>
  )
  if (m.isCollapsed) return <Box key="spend-meter">{header}</Box>

  const b = bar(f ?? 0, Math.max(10, Math.min(40, width - 24)))
  return (
    <Box key="spend-meter" flexDirection="column" rowGap={1}>
      <Box flexDirection="column">
        {header}
        {f === null ? (
          <Text dimColor>{`No budget set · ${m.turns} turn${m.turns === 1 ? '' : 's'} · /spend-meter-budget 5`}</Text>
        ) : (
          <Text wrap="truncate-end">
            <Text dimColor>{'budget  '}</Text>
            <Text color={color}>{b.filled}</Text>
            <Text dimColor>{b.empty}</Text>
            <Text dimColor>{` ${pct}`}</Text>
          </Text>
        )}
      </Box>
      {m.held ? (
        <Box flexDirection="row" columnGap={1}>
          <Button key="cancel" label="Cancel prompt" hotkey="c" variant="primary" autoFocus onPress={a.cancel} />
          <Button key="proceed" label="Continue anyway" hotkey="a" onPress={a.proceed} />
        </Box>
      ) : null}
    </Box>
  )
}
