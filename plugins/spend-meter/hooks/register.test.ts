import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { bar, cleanBudget, crossed, estimate, fmtUsd, fraction, levelOf, parsePrices } from './register'

const run = ($: Engine, command: string, args = '') =>
  $.command.run({ command, args, origin: { kind: 'composer' } as never, presentation: { isFullscreen: false, columns: 120 } })

const wait = (ms = 5) => new Promise(done => (globalThis as any).setTimeout(done, ms))
const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} }

describe('figures', () => {
  test('money formatting and fractions', () => {
    expect(fmtUsd(null)).toBe('—')
    expect(fmtUsd(0.004)).toBe('<$0.01')
    expect(fmtUsd(1.234)).toBe('$1.23')
    expect(fraction(2.5, 5)).toBe(0.5)
    expect(fraction(2.5, 0)).toBeNull()
    expect(fraction(null, 5)).toBeNull()
    expect(levelOf(0.79)).toBe('ok')
    expect(levelOf(0.8)).toBe('near')
    expect(levelOf(1)).toBe('over')
  })

  test('the bar fills and clamps', () => {
    expect(bar(0.5, 10)).toEqual({ filled: '█████', empty: '░░░░░' })
    expect(bar(2, 4).filled).toBe('████')
    expect(bar(-1, 4).filled).toBe('')
  })

  test('thresholds fire once, on the way past', () => {
    expect(crossed(0.5, 0.79)).toBeNull()
    expect(crossed(0.5, 0.8)).toBe('near')
    expect(crossed(0.85, 0.95)).toBeNull()
    expect(crossed(0.9, 1.01)).toBe('over')
    expect(crossed(null, 1.2)).toBe('over')
    expect(crossed(1.1, 1.3)).toBeNull()
  })

  test('budget input', () => {
    expect(cleanBudget('$12.5')).toBe(12.5)
    expect(cleanBudget('0')).toBe(0)
    expect(cleanBudget('abc')).toBe(5)
    expect(cleanBudget(-3)).toBe(5)
  })

  test('the fallback table is empty until configured and never guesses', () => {
    expect(parsePrices(undefined)).toEqual({})
    expect(parsePrices('not json')).toEqual({})
    const t = parsePrices('{"m-1":{"input":3,"output":15,"cacheRead":0.3,"cacheWrite":3.75},"bad":{"input":"x"}}')
    expect(Object.keys(t)).toEqual(['m-1'])
    const tokens = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000 }
    expect(Math.abs((estimate(t, "m-1-20260101", tokens) ?? 0) - 22.05)).toBeLessThan(1e-9)
    expect(estimate(t, 'other', tokens)).toBeNull()
    expect(estimate({}, 'm-1', tokens)).toBeNull()
  })
})

let spent = 0
let toasts: string[] = []

async function start($: Engine, on: any, surfaces = ['terminal']) {
  mockEngine($, on, surfaces)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

function mockEngine(_$: Engine, on: any, surfaces: string[]) {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [], cost: { usd: spent } } }))
  mock.clock(on)
  mock.store(on)
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('ui.toast', (_: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.render', ($: any, e: any) => (globalThis as any).h($.ui.resolve(e).Box, { key: 'engine-band' }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('process.run', async () => {
    await wait()
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
}

async function turn($: Engine, usd: number) {
  const base = spent
  await $.turn.start({ text: 'hi', turnId: 't' })
  spent = base + usd
  await $.turn.complete({ answer: 'ok', durationMs: 5, isAborted: false, turnId: 't', reason: 'answer', usage: { model: 'm-1', input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 } } as never)
}

describe('the meter', () => {
  test('a turn moves the session and last-turn figures and /spend-meter lists tokens by model', async ($, on) => {
    spent = 0
    toasts = []
    await start($, on)
    await turn($, 0.42)
    const ui = await $.ui.mount({ plugin: 'spend-meter', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: /\$0\.42 session/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\$0\.42 last turn/ })).toBeDefined()
    await ui.unmount()
    const r = JSON.stringify(await run($, 'spend-meter'))
    expect(toasts).toEqual([])
    expect(r).toContain('m-1: in 10 · out 20 · cache read 30 · cache write 40')
  })

  test('the chevron folds the band to one line', async ($, on) => {
    spent = 0
    await start($, on)
    await turn($, 1)
    const ui = await $.ui.mount({ plugin: 'spend-meter', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: /budget/ })).toBeDefined()
    await ui.press({ key: 'collapse' })
    await wait(20)
    await ui.unmount()
    const again = await $.ui.mount({ plugin: 'spend-meter', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await again.find({ type: 'Text', text: /budget {2}/ })).toBeUndefined()
    expect(await again.find({ type: 'Text', text: /20% of \$5\.00/ })).toBeDefined()
    await again.unmount()
    expect(JSON.stringify(await run($, 'spend-meter-collapse'))).toContain('expanded')
  })

  test('/spend-meter-budget sets the budget', async ($, on) => {
    await start($, on)
    expect(JSON.stringify(await run($, 'spend-meter-budget', '10'))).toContain('$10.00')
    expect(JSON.stringify(await run($, 'spend-meter-budget', '0'))).toContain('off')
  })

  test('at 100% the next prompt waits; Cancel drops it, Continue sends it', async ($, on) => {
    spent = 0
    toasts = []
    await start($, on)
    await turn($, 4.2)
    expect(toasts.join()).toMatch(/80% of the \$5\.00 budget/)
    await turn($, 0.8)
    expect(toasts.join()).toMatch(/Budget reached/)
    const first = $.prompt.submit({ text: 'go on' })
    let ui: any
    for (let i = 0; i < 80 && !ui; i++) {
      const m = await $.ui.mount({ plugin: 'spend-meter', surface: 'terminal', component: 'AbovePrompt', props: BAND })
      if (await m.find({ key: 'cancel' })) ui = m
      else {
        await m.unmount()
        await wait()
      }
    }
    expect(ui).toBeDefined()
    await ui.press({ key: 'cancel' })
    expect(((await first) as any).drop).toMatch(/not sent/)
    await ui.unmount()

    const second = $.prompt.submit({ text: 'go on' })
    let ui2: any
    for (let i = 0; i < 80 && !ui2; i++) {
      const m = await $.ui.mount({ plugin: 'spend-meter', surface: 'terminal', component: 'AbovePrompt', props: BAND })
      if (await m.find({ key: 'proceed' })) ui2 = m
      else {
        await m.unmount()
        await wait()
      }
    }
    await ui2.press({ key: 'proceed' })
    expect(((await second) as any).text).toBe('go on')
    await ui2.unmount()
    // Acknowledged: the next one goes straight through.
    expect(((await $.prompt.submit({ text: 'again' })) as any).text).toBe('again')
  })

  test('under budget, and with nobody to ask, prompts behave', async ($, on) => {
    spent = 0
    await start($, on)
    await turn($, 1)
    expect(((await $.prompt.submit({ text: 'fine' })) as any).text).toBe('fine')
  })

  test('with no screen, a spent budget drops the prompt at once', async ($, on) => {
    spent = 0
    await start($, on, [])
    await turn($, 6)
    expect(((await $.prompt.submit({ text: 'x' })) as any).drop).toMatch(/nobody is here/)
  })
})
