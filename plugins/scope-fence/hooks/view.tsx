// The band: the fence, and a held write. Host elements and theme colours only.

import type { Elements, RenderElement } from 'claude-code'

import type { HeldWrite } from '../types'

type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export type Model = { fence: string[]; held: HeldWrite | null; shownPath: string; isCollapsed: boolean; secondsLeft: number | null }
export type Actions = { toggle: () => void; block: () => void; allow: () => void }

export function band(E: Els, m: Model, a: Actions): RenderElement {
  const { Box, Text, Button } = E
  const n = m.fence.length
  const chevron = <Button key="collapse" plain dimColor label={m.isCollapsed ? '▸' : '▾'} onPress={a.toggle} />
  const countdown = m.secondsLeft !== null ? ` · blocks in ${m.secondsLeft} s` : ''

  const header = (
    <Box flexDirection="row" columnGap={1}>
      <Text wrap="truncate-end">
        <Text color={m.held ? 'error' : 'claude'}>{m.held ? '⚠ ' : '▣ '}</Text>
        <Text bold>{m.held ? 'Write outside the fence' : 'Scope fence'}</Text>
        <Text dimColor>{m.held ? ` · ${m.held.tool} · ${m.shownPath}${countdown}` : ` · ${n} path${n === 1 ? '' : 's'}`}</Text>
      </Text>
      {chevron}
    </Box>
  )
  if (m.isCollapsed && !m.held) return <Box key="scope-fence">{header}</Box>

  return (
    <Box key="scope-fence" flexDirection="column" rowGap={1}>
      <Box flexDirection="column">
        {header}
        {m.fence.slice(0, 6).map(p => (
          <Text wrap="truncate-end">
            <Text color="success">{'● '}</Text>
            <Text>{p}</Text>
          </Text>
        ))}
        {n > 6 ? <Text dimColor>{`  … and ${n - 6} more`}</Text> : null}
      </Box>
      {m.held ? (
        <Box flexDirection="row" columnGap={1}>
          <Button key="block" label="Block" hotkey="b" variant="primary" autoFocus onPress={a.block} />
          <Button key="allow" label="Allow once" hotkey="a" onPress={a.allow} />
        </Box>
      ) : null}
    </Box>
  )
}
