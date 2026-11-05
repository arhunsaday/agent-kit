import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { changeOf, commitPrompt, countLines, patchCounts, quote, record, totals } from './register'

const run = ($: Engine, command: string) =>
  $.command.run({ command, args: '', origin: { kind: 'composer' } as never, presentation: { isFullscreen: false, columns: 120 } })
const wait = (ms = 5) => new Promise(done => (globalThis as any).setTimeout(done, ms))
const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} }

describe('counting', () => {
  test('lines', () => {
    expect(countLines('')).toBe(0)
    expect(countLines('a')).toBe(1)
    expect(countLines('a\n')).toBe(1)
    expect(countLines('a\nb')).toBe(2)
    expect(countLines(undefined)).toBe(0)
  })

  test('a structured patch counts + and - lines, not headers', () => {
    expect(patchCounts([{ lines: [' ctx', '-old', '+new1', '+new2'] }, { lines: ['-gone'] }])).toEqual({ added: 2, removed: 2 })
    expect(patchCounts('nope')).toBeNull()
    expect(patchCounts([{}])).toBeNull()
  })

  test('Edit uses the result patch, else the two strings', () => {
    const e = { file_path: '/p/a.ts', old_string: 'a\nb', new_string: 'c' }
    expect(changeOf('Edit', e, { structuredPatch: [{ lines: ['-a', '-b', '+c'] }] })).toEqual({ path: '/p/a.ts', added: 1, removed: 2, isNew: false })
    expect(changeOf('Edit', e, {})).toEqual({ path: '/p/a.ts', added: 1, removed: 2, isNew: false })
  })

  test('Write: a new file is all additions, a rewrite uses the patch', () => {
    expect(changeOf('Write', { file_path: '/p/n.ts', content: 'x\ny\nz\n' }, { type: 'create', originalFile: null })).toEqual({ path: '/p/n.ts', added: 3, removed: 0, isNew: true })
    expect(changeOf('Write', { file_path: '/p/o.ts', content: 'q' }, { type: 'update', originalFile: 'a\nb', structuredPatch: [{ lines: ['-a', '-b', '+q'] }] })).toEqual({ path: '/p/o.ts', added: 1, removed: 2, isNew: false })
    expect(changeOf('Write', { file_path: '/p/o.ts', content: 'q\nr' }, { originalFile: 'a' })).toEqual({ path: '/p/o.ts', added: 2, removed: 1, isNew: false })
  })

  test('MultiEdit sums its edits; other tools and missing paths are nothing', () => {
    expect(changeOf('MultiEdit', { file_path: '/p/m.ts', edits: [{ old_string: 'a', new_string: 'b\nc' }, { old_string: 'd', new_string: '' }] }, {})).toEqual({ path: '/p/m.ts', added: 2, removed: 2, isNew: false })
    expect(changeOf('Bash', { command: 'ls' }, {})).toBeNull()
    expect(changeOf('Edit', {}, {})).toBeNull()
  })

  test('the batch keeps one entry per file with sums, and a file created then edited stays new', () => {
    let l = record([], { path: '/p/a', added: 3, removed: 0, isNew: true })
    l = record(l, { path: '/p/b', added: 1, removed: 1, isNew: false })
    l = record(l, { path: '/p/a', added: 1, removed: 2, isNew: false })
    expect(l).toEqual([
      { path: '/p/a', added: 4, removed: 2, edits: 2, isNew: true },
      { path: '/p/b', added: 1, removed: 1, edits: 1, isNew: false },
    ])
    expect(totals(l)).toEqual({ added: 5, removed: 3 })
  })

  test('the commit request names exactly the files, quoted, and says not to push', () => {
    const t = commitPrompt([{ path: '/p/src/a b.ts', added: 2, removed: 1, edits: 1, isNew: false }, { path: '/p/n.ts', added: 5, removed: 0, edits: 1, isNew: true }], '/p')
    expect(t).toContain("git add -- 'src/a b.ts' n.ts")
    expect(t).toContain('- n.ts (new, +5 −0)')
    expect(t).toContain('Do not push')
    expect(quote("it's")).toBe("'it'\\''s'")
  })
})

let sent: string[] = []

async function start($: Engine, on: any) {
  mock.clock(on)
  mock.store(on)
  sent = []
  on('session.cwd', () => ({ value: '/proj' }))
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('ui.render', ($: any, e: any) => (globalThis as any).h($.ui.resolve(e).Box, { key: 'engine-band' }))
  on('prompt.submit', (_: any, e: any) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('tool.call', (_: any, e: any) => {
    if (e.file_path === '/proj/fail.ts') return { result: {}, text: 'err', isError: true }
    return { result: e.tool === 'Write' ? { type: 'create', originalFile: null } : {}, text: 'ok' }
  })
  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })
}

const mount = ($: Engine) => $.ui.mount({ plugin: 'change-ledger', surface: 'terminal', component: 'AbovePrompt', props: BAND } as never)

describe('the band', () => {
  test('it lists touched files with lines; failed calls are not counted', async ($, on) => {
    await start($, on)
    await $.tool.call({ tool: 'Write', file_path: '/proj/src/new.ts', content: 'a\nb\nc\n' } as any)
    await $.tool.call({ tool: 'Edit', file_path: '/proj/src/old.ts', old_string: 'x', new_string: 'y\nz' } as any)
    await $.tool.call({ tool: 'Edit', file_path: '/proj/fail.ts', old_string: 'x', new_string: 'y' } as any)
    const ui = await mount($)
    expect(await ui.find({ type: 'Text', text: /Change ledger/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^src\/new\.ts/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^\+5$/ })).toBeDefined() // the total: 3 + 2
    expect(await ui.find({ type: 'Text', text: /fail\.ts/ })).toBeUndefined()
    expect(JSON.stringify(await run($, 'change-ledger'))).toContain('src/old.ts · +2 −1')
    await ui.unmount()
  })

  test('Commit this batch asks Claude to commit those files, then starts a new batch', async ($, on) => {
    await start($, on)
    await $.tool.call({ tool: 'Write', file_path: '/proj/a.ts', content: 'a' } as any)
    await $.tool.call({ tool: 'Edit', file_path: '/proj/b.ts', old_string: 'a', new_string: 'b' } as any)
    const ui = await mount($)
    await ui.press({ key: 'commit' })
    await wait(20)
    await ui.unmount()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('git add -- a.ts b.ts')
    const again = await mount($)
    expect(await again.find({ type: 'Text', text: /Change ledger/ })).toBeUndefined()
    await again.unmount()
    expect(JSON.stringify(await run($, 'change-ledger'))).toContain('No files')
  })

  test('Clear empties the batch without sending anything; the chevron folds', async ($, on) => {
    await start($, on)
    await $.tool.call({ tool: 'Edit', file_path: '/proj/b.ts', old_string: 'a', new_string: 'b' } as any)
    const ui = await mount($)
    await ui.press({ key: 'collapse' })
    await wait(20)
    await ui.unmount()
    const folded = await mount($)
    expect(await folded.find({ type: 'Text', text: /1 file/ })).toBeDefined()
    expect(await folded.find({ key: 'commit' })).toBeUndefined()
    await folded.press({ key: 'collapse' })
    await wait(20)
    await folded.unmount()
    const open = await mount($)
    await open.press({ key: 'clear' })
    await wait(20)
    await open.unmount()
    expect(sent).toEqual([])
    const empty = await mount($)
    expect(await empty.find({ type: 'Text', text: /Change ledger/ })).toBeUndefined()
    await empty.unmount()
  })
})
