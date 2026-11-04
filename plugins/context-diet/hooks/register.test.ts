import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { addRead, addResult, labelOf, offenders, rereads, resultText, tokensOf } from './register'

const run = ($: Engine, command: string) =>
  $.command.run({ command, args: '', origin: { kind: 'composer' } as never, presentation: { isFullscreen: false, columns: 120 } })
const wait = (ms = 5) => new Promise(done => (globalThis as any).setTimeout(done, ms))
const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} }

describe('logic', () => {
  test('size estimate and labels', () => {
    expect(tokensOf('a'.repeat(400))).toBe(100)
    expect(tokensOf('')).toBe(0)
    expect(labelOf('Read', { file_path: '/a/b.ts' })).toBe('/a/b.ts')
    expect(labelOf('Bash', { command: 'npm   test\n --silent' })).toBe('npm test --silent')
    expect(labelOf('Bash', { command: 'x'.repeat(100) }).length).toBe(60)
    expect(labelOf('Agent', {})).toBe('Agent')
    expect(resultText({ text: 'abc' })).toBe('abc')
    expect(resultText({ result: { a: 1 } })).toBe('{"a":1}')
    expect(resultText(undefined)).toBe('')
  })

  test('the list keeps the largest, drops the small, caps at 20', () => {
    let l = addResult([], { id: '1', tool: 'Bash', label: 'a', tokens: 50 }, 100)
    expect(l).toEqual([])
    for (let i = 0; i < 25; i++) l = addResult(l, { id: String(i), tool: 'Bash', label: 'x', tokens: 100 + i }, 100)
    expect(l).toHaveLength(20)
    expect(l[0]!.tokens).toBe(124)
  })

  test('a file read three times is an offender; two is not', () => {
    let r = {}
    r = addRead(r, 'a.ts', 100)
    r = addRead(r, 'a.ts', 100)
    r = addRead(r, 'b.ts', 5000)
    expect(rereads(r)).toEqual([])
    r = addRead(r, 'a.ts', 100)
    expect(rereads(r)).toEqual([{ path: 'a.ts', count: 3, tokens: 300 }])
  })

  test('offenders rank both kinds by tokens', () => {
    const o = offenders([{ id: '1', tool: 'Bash', label: 'npm test', tokens: 9000 }], { 'a.ts': { count: 4, tokens: 12000 } })
    expect(o.map(x => x.kind)).toEqual(['reread', 'big'])
    expect(o[0]!.detail).toBe('read 4× · ~12k tokens')
  })
})

let toasts: string[] = []
let sizes: Record<string, number> = {}
let percent = 10

function engine(on: any) {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('ui.toast', (_: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.render', ($: any, e: any) => (globalThis as any).h($.ui.resolve(e).Box, { key: 'engine-band' }))
  on('tool.call', (_: any, e: any) => ({ result: {}, text: 'x'.repeat(sizes[e.file_path ?? e.command] ?? 40) }))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))
  on('session.measure', (_: any, e: any) => ({ changed: e.changed }))
}

async function start($: Engine, on: any) {
  toasts = []
  sizes = {}
  engine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

const mount = ($: Engine) => $.ui.mount({ plugin: 'context-diet', surface: 'terminal', component: 'AbovePrompt', props: BAND } as never)

describe('the band', () => {
  test('a big result is toasted and listed; a small one is ignored', async ($, on) => {
    await start($, on)
    sizes['npm test'] = 80_000 // 20k tokens
    await $.tool.call({ tool: 'Bash', command: 'ls' } as any)
    expect(await (await mount($)).find({ type: 'Text', text: /Context diet/ })).toBeUndefined()
    await $.tool.call({ tool: 'Bash', command: 'npm test' } as any)
    expect(toasts.join()).toMatch(/Big tool result: Bash npm test \(~20k tokens\)/)
    const ui = await mount($)
    expect(await ui.find({ type: 'Text', text: /1 offender/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Bash · ~20k tokens/ })).toBeDefined()
    expect(await ui.find({ key: 'compact' })).toBeUndefined()
    await ui.unmount()
    expect(JSON.stringify(await run($, 'context-diet'))).toContain('npm test')
  })

  test('the third read of a file is flagged', async ($, on) => {
    await start($, on)
    for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: '/src/a.ts' } as any)
    expect(toasts.join()).toMatch(/\/src\/a\.ts has been read 3 times/)
    const ui = await mount($)
    expect(await ui.find({ type: 'Text', text: /read 3×/ })).toBeDefined()
    await ui.unmount()
  })

  test('past the threshold the band suggests Compact, and compacting clears the list', async ($, on) => {
    await start($, on)
    sizes['big'] = 100_000
    await $.tool.call({ tool: 'Bash', command: 'big' } as any)
    percent = 64
    await $.session.measure({ context: { window: 1000, tokens: 640, percent }, rateLimits: [], changed: ['context'] } as never)
    expect(toasts.join()).toMatch(/Context is 64% full/)
    const ui = await mount($)
    expect(await ui.find({ type: 'Text', text: /over 60%/ })).toBeDefined()
    await ui.press({ key: 'compact' })
    await wait(20)
    await ui.unmount()
    const after = await mount($)
    expect(await after.find({ type: 'Text', text: /1 offender/ })).toBeUndefined()
    await after.unmount()
  })

  test('the chevron folds the band', async ($, on) => {
    await start($, on)
    sizes['big'] = 100_000
    await $.tool.call({ tool: 'Bash', command: 'big' } as any)
    const ui = await mount($)
    expect(await ui.find({ type: 'Text', text: /Bash · ~25k/ })).toBeDefined()
    await ui.press({ key: 'collapse' })
    await wait(20)
    await ui.unmount()
    const folded = await mount($)
    expect(await folded.find({ type: 'Text', text: /Bash · ~25k/ })).toBeUndefined()
    expect(await folded.find({ type: 'Text', text: /1 offender/ })).toBeDefined()
    await folded.unmount()
    expect(JSON.stringify(await run($, 'context-diet-collapse'))).toContain('expanded')
  })
})
