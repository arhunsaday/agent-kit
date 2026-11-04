// The band: the domains of the session, and a question for the newest one nobody has answered.

import type { Elements, RenderElement } from 'claude-code'

import type { Status } from './watch'

type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export type Row = { host: string; count: number; via: string; status: Status }
export type Model = { rows: Row[]; blocked: number; isCollapsed: boolean }
export type Actions = { toggle: () => void; allow: (host: string) => void; deny: (host: string) => void }

const COLOR = { new: 'warning', allowed: 'success', denied: 'error' } as const

export function band(E: Els, m: Model, a: Actions): RenderElement {
  const { Box, Text, Button } = E
  const n = m.rows.length
  const fresh = m.rows.filter(r => r.status === 'new')
  const denied = m.rows.filter(r => r.status === 'denied').length
  const chevron = <Button key="collapse" plain dimColor label={m.isCollapsed ? '▸' : '▾'} onPress={a.toggle} />

  const header = (
    <Box flexDirection="row" columnGap={1}>
      <Text wrap="truncate-end">
        <Text color={fresh.length ? 'warning' : 'claude'}>{'⌁ '}</Text>
        <Text bold>Net watch</Text>
        <Text dimColor>
          {` · ${n} domain${n === 1 ? '' : 's'}${fresh.length ? ` · ${fresh.length} new` : ''}${denied ? ` · ${denied} denied` : ''}${m.blocked ? ` · ${m.blocked} blocked` : ''}`}
        </Text>
      </Text>
      {chevron}
    </Box>
  )
  if (m.isCollapsed) return <Box key="net-watch">{header}</Box>

  const shown = m.rows.slice(0, 5)
  const hostW = Math.max(...shown.map(r => r.host.length))
  const next = fresh[0]
  return (
    <Box key="net-watch" flexDirection="column" rowGap={1}>
      <Box flexDirection="column">
        {header}
        {shown.map(r => (
          <Text wrap="truncate-end">
            <Text color={COLOR[r.status]}>{'● '}</Text>
            <Text>{r.host.padEnd(hostW + 2)}</Text>
            <Text dimColor>{`${r.status} · ${r.count}× · ${r.via}`}</Text>
          </Text>
        ))}
        {n > shown.length ? <Text dimColor>{`  … and ${n - shown.length} more (/net-watch)`}</Text> : null}
      </Box>
      {next ? (
        <Box flexDirection="row" columnGap={1}>
          <Button key="deny" label={`Deny ${next.host}`} hotkey="d" variant="primary" onPress={() => a.deny(next.host)} />
          <Button key="allow" label="Allow" hotkey="a" onPress={() => a.allow(next.host)} />
        </Box>
      ) : null}
    </Box>
  )
}
