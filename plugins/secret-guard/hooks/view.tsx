// The held call, as a band above the prompt: host elements and theme colours only, laid out as the other mods.

import type { Elements, RenderElement } from 'claude-code'

import type { HeldCall } from '../types'

export type Decision = 'block' | 'allow'

type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export function report(E: Els, one: HeldCall, decide: (id: string, d: Decision) => void): RenderElement {
  const { Box, Text, Button } = E
  const shown = one.findings.slice(0, 5)
  const more = one.findings.length - shown.length
  const kindW = Math.max(...shown.map(f => f.kind.length))

  const countdown =
    one.secondsLeft !== null && one.timeoutSeconds ? (
      <Text dimColor={one.secondsLeft > 10} color={one.secondsLeft <= 10 ? 'warning' : undefined}>
        {` · blocks in ${one.secondsLeft} s`}
      </Text>
    ) : null

  return (
    <Box key="secret-guard" flexDirection="column" rowGap={1}>
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text color="error">{'⚠ '}</Text>
          <Text bold>{one.sink === 'network' ? 'Secret about to be sent' : 'Secret about to be written'}</Text>
          <Text dimColor>{` · ${one.tool} · ${one.target}`}</Text>
          {countdown}
        </Text>
        {shown.map(f => (
          <Text wrap="truncate-end">
            <Text color="error">{'● '}</Text>
            <Text>{f.kind.padEnd(kindW + 2)}</Text>
            <Text dimColor>{`${f.preview} · line ${f.line}`}</Text>
          </Text>
        ))}
        {more > 0 ? <Text dimColor>{`  … and ${more} more`}</Text> : null}
      </Box>
      <Box flexDirection="row" columnGap={1}>
        <Button key="block" label="Block" hotkey="b" variant="primary" autoFocus onPress={() => decide(one.id, 'block')} />
        <Button key="allow" label="Allow once" hotkey="a" onPress={() => decide(one.id, 'allow')} />
      </Box>
    </Box>
  )
}
