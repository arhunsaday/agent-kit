import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { isInside, normalize, parseArgs, parseFence, pathsOf, shown } from './register'

const run = ($: Engine, command: string, args = '') =>
  $.command.run({ command, args, origin: { kind: 'composer' } as never, presentation: { isFullscreen: false, columns: 120 } })
const wait = (ms = 5) => new Promise(done => (globalThis as any).setTimeout(done, ms))
const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} }
const CWD = '/proj'

describe('paths', () => {
  test('normalize', () => {
    expect(normalize('/a/./b//c/../d')).toBe('/a/b/d')
    expect(normalize('../x')).toBe('../x')
    expect(normalize('/../x')).toBe('/x')
  })

  test('inside the fence: files, folders, absolute entries, no sibling prefixes, no escapes', () => {
    const fence = ['src/api/', 'README.md', '/tmp/scratch']
    expect(isInside('src/api/routes.ts', fence, CWD)).toBe(true)
    expect(isInside('/proj/src/api/deep/x.ts', fence, CWD)).toBe(true)
    expect(isInside('src/api', fence, CWD)).toBe(true)
    expect(isInside('README.md', fence, CWD)).toBe(true)
    expect(isInside('/tmp/scratch/a', fence, CWD)).toBe(true)
    expect(isInside('src/api-v2/x.ts', fence, CWD)).toBe(false)
    expect(isInside('src/ui/x.ts', fence, CWD)).toBe(false)
    expect(isInside('src/api/../ui/x.ts', fence, CWD)).toBe(false)
    expect(isInside('../outside.ts', fence, CWD)).toBe(false)
    expect(isInside('anything', [], CWD)).toBe(true)
  })

  test('fence file, command words and call paths', () => {
    expect(parseFence('{"allow":["src/", " ", 3]}')).toEqual(['src/'])
    expect(parseFence('["a","b"]')).toEqual(['a', 'b'])
    expect(parseFence('nope')).toEqual([])
    expect(parseFence(null)).toEqual([])
    expect(parseArgs('')).toBe('show')
    expect(parseArgs('off')).toEqual([])
    expect(parseArgs('src/api/, tests/')).toEqual(['src/api/', 'tests/'])
    expect(pathsOf('Edit', { file_path: 'a.ts' })).toEqual(['a.ts'])
    expect(pathsOf('Bash', { command: 'ls' })).toEqual([])
    expect(shown('/proj/src/a.ts', CWD)).toBe('src/a.ts')
    expect(shown('/etc/x', CWD)).toBe('/etc/x')
  })
})

let files = new Map<string, string>()
let ran: string[] = []

function engine(on: any, surfaces = ['terminal']) {
  mock.clock(on)
  mock.store(on)
  files = new Map()
  ran = []
  on('session.cwd', () => ({ value: CWD }))
  on('fs.read', (_: any, e: any) => {
    const t = files.get(e.path)
    if (t === undefined) throw new Error('ENOENT')
    return { value: t }
  })
  on('fs.write', (_: any, e: any) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('process.run', async () => {
    await wait()
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('ui.render', ($: any, e: any) => (globalThis as any).h($.ui.resolve(e).Box, { key: 'engine-band' }))
  on('tool.call', (_: any, e: any) => {
    ran.push(e.file_path)
    return { result: {}, text: 'ok' }
  })
}

const mount = ($: Engine) => $.ui.mount({ plugin: 'scope-fence', surface: 'terminal', component: 'AbovePrompt', props: BAND } as never)

async function heldBand($: Engine, key: string) {
  for (let i = 0; i < 80; i++) {
    const ui = await mount($)
    if (await ui.find({ key })) return ui
    await ui.unmount()
    await wait()
  }
  throw new Error('nothing was held')
}

async function start($: Engine, on: any, fence: string | null, surfaces?: string[]) {
  engine(on, surfaces)
  if (fence) files.set('/proj/.claude/fence.json', fence)
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
}

describe('the fence', () => {
  test('inside passes, outside is held; Block refuses with a reason Claude can act on', async ($, on) => {
    await start($, on, '{"allow":["src/api/"]}')
    await $.tool.call({ tool: 'Write', file_path: 'src/api/a.ts', content: 'x' } as any)
    expect(ran).toEqual(['src/api/a.ts'])
    const call = $.tool.call({ tool: 'Edit', file_path: 'src/ui/b.ts', old_string: 'a', new_string: 'b' } as any)
    const ui = await heldBand($, 'block')
    expect(await ui.find({ type: 'Text', text: /Write outside the fence/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Edit · src\/ui\/b\.ts/ })).toBeDefined()
    await ui.press({ key: 'block' })
    const r: any = await call
    expect(r.deny).toMatch(/src\/ui\/b\.ts is outside the fence \(src\/api\/\)/)
    expect(ran).toEqual(['src/api/a.ts'])
    await ui.unmount()
  })

  test('Allow once lets that write through, and the next is held again', async ($, on) => {
    await start($, on, '{"allow":["src/api/"]}')
    const first = $.tool.call({ tool: 'MultiEdit', file_path: 'docs/x.md', edits: [] } as any)
    const ui = await heldBand($, 'allow')
    await ui.press({ key: 'allow' })
    await first
    await ui.unmount()
    expect(ran).toEqual(['docs/x.md'])
    const second = $.tool.call({ tool: 'Write', file_path: 'docs/y.md', content: '' } as any)
    const ui2 = await heldBand($, 'block')
    await ui2.press({ key: 'block' })
    expect(((await second) as any).deny).toBeDefined()
    await ui2.unmount()
  })

  test('no fence, no hold; no screen, an outside write is refused at once', async ($, on) => {
    await start($, on, null)
    await $.tool.call({ tool: 'Write', file_path: 'anywhere.ts', content: '' } as any)
    expect(ran).toEqual(['anywhere.ts'])
  })

  test('with no screen it denies', async ($, on) => {
    await start($, on, '["src/"]', [])
    const r: any = await $.tool.call({ tool: 'Write', file_path: 'other/x.ts', content: '' } as any)
    expect(r.deny).toMatch(/outside the fence/)
    expect(ran).toEqual([])
  })

  test('/scope-fence writes .claude/fence.json and the band shows the fence', async ($, on) => {
    await start($, on, null)
    expect(JSON.stringify(await run($, 'scope-fence'))).toContain('No fence')
    expect(JSON.stringify(await run($, 'scope-fence', 'src/api/ tests/'))).toContain('Fence set: src/api/, tests/')
    expect(JSON.parse(files.get('/proj/.claude/fence.json')!)).toEqual({ allow: ['src/api/', 'tests/'] })
    const ui = await mount($)
    expect(await ui.find({ type: 'Text', text: /2 paths/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^tests\/$/ })).toBeDefined()
    await ui.press({ key: 'collapse' })
    await wait(20)
    await ui.unmount()
    const folded = await mount($)
    expect(await folded.find({ type: 'Text', text: /^tests\/$/ })).toBeUndefined()
    expect(await folded.find({ type: 'Text', text: /2 paths/ })).toBeDefined()
    await folded.unmount()
    expect(JSON.stringify(await run($, 'scope-fence', 'off'))).toContain('cleared')
    await $.tool.call({ tool: 'Write', file_path: 'free.ts', content: '' } as any)
    expect(ran).toEqual(['free.ts'])
  })
})
