// The band: host elements and theme colours only, laid out as the other mods.

import type { Elements, RenderElement } from 'claude-code'

import type { Offender } from './diet'

type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export type Model = {
  percent: number | null
  threshold: number
  offenders: Offender[]
  isCollapsed: boolean
}

export type Actions = { toggle: () => void; compact: () => void }

export function band(E: Els, m: Model, a: Actions): RenderElement {
  const { Box, Text, Button } = E
  const isOver = m.percent !== null && m.percent >= m.threshold
  const color = isOver ? 'warning' : 'suggestion'
  const chevron = <Button key="collapse" plain dimColor label={m.isCollapsed ? '▸' : '▾'} onPress={a.toggle} />
  const n = m.offenders.length

  const header = (
    <Box flexDirection="row" columnGap={1}>
      <Text wrap="truncate-end">
        <Text color={color}>{'◆ '}</Text>
        <Text bold>Context diet</Text>
        <Text dimColor>
          {`${m.percent === null ? '' : ` · ${m.percent}% of the window`}${n ? ` · ${n} offender${n === 1 ? '' : 's'}` : ''}${isOver ? ` · over ${m.threshold}%` : ''}`}
        </Text>
      </Text>
      {chevron}
    </Box>
  )
  if (m.isCollapsed) return <Box key="context-diet">{header}</Box>

  return (
    <Box key="context-diet" flexDirection="column" rowGap={1}>
      <Box flexDirection="column">
        {header}
        {m.offenders.map(o => (
          <Text wrap="truncate-end">
            <Text color="warning">{'● '}</Text>
            <Text>{o.label}</Text>
            <Text dimColor>{` · ${o.detail}`}</Text>
          </Text>
        ))}
      </Box>
      {isOver ? (
        <Box flexDirection="row" columnGap={1}>
          <Button key="compact" label="Compact" hotkey="c" variant="primary" onPress={a.compact} />
        </Box>
      ) : null}
    </Box>
  )
}
