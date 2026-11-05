import { describe, expect, test } from 'claude-code/testing'

import { appendDecision, dayOf, detectDecision, formatEntry, listing, parseDecisions } from '../hooks/detect'

const text = (s: string) => detectDecision(s)?.text

describe('detectDecision', () => {
  test('French cues', () => {
    expect(text('On part sur Postgres pour le stockage.')).toBe('On part sur Postgres pour le stockage.')
    expect(text("Ok, on garde l'ancien routeur.")).toBe("Ok, on garde l'ancien routeur.")
    expect(text('Décision : pas de migration avant mars.')).toMatch(/^Décision/)
    expect(text("On a décidé d'abandonner Redis.")).toBeDefined()
    expect(text('On reste sur Vitest, pas de Jest.')).toBeDefined()
    expect(text("C'est décidé, on y va avec Bun.")).toBeDefined()
  })

  test('English cues', () => {
    expect(text("We'll go with Postgres.")).toBe("We'll go with Postgres.")
    expect(text('We decided to drop the legacy API.')).toBeDefined()
    expect(text('decided: tabs, not spaces')).toBeDefined()
    expect(text("Let's go with option B.")).toBeDefined()
    expect(text("We're going with the monorepo.")).toBeDefined()
    expect(text('Decision: ship on Friday')).toBeDefined()
  })

  test('only the deciding sentence is kept, the line before is context', () => {
    const f = detectDecision('Postgres and SQLite both fit our load. We will go with Postgres. Now add the migration.')
    expect(f).toEqual({ text: 'We will go with Postgres.', context: 'Postgres and SQLite both fit our load.' })
  })

  test('questions, negations, hypotheticals and noise are not decisions', () => {
    expect(detectDecision('Est-ce qu’on part sur Postgres ?')).toBeNull()
    expect(detectDecision('Should we go with Postgres?')).toBeNull()
    expect(detectDecision("On n'a pas encore décidé pour la base.")).toBeNull()
    expect(detectDecision("We haven't decided yet.")).toBeNull()
    expect(detectDecision('If we go with Postgres, what changes?')).toBeNull()
    expect(detectDecision('What was the decision about caching?')).toBeNull()
    expect(detectDecision('/decision-log')).toBeNull()
    expect(detectDecision('Fix the failing test in auth.ts')).toBeNull()
    expect(detectDecision('')).toBeNull()
    expect(detectDecision('```\nwe will go with x\n```')).toBeNull()
    expect(detectDecision('> we decided to leave\nrun the tests')).toBeNull()
  })
})

describe('the file', () => {
  const d = { date: '2026-11-04', text: 'On part sur Postgres.', context: 'SQLite ou Postgres ?' }

  test('starts with a header, then one entry per decision', () => {
    const md = appendDecision(null, d)!
    expect(md.startsWith('# Decisions')).toBe(true)
    expect(md).toContain('- 2026-11-04 · On part sur Postgres.\n  - context: SQLite ou Postgres ?\n')
    const md2 = appendDecision(md, { date: '2026-11-05', text: 'We will go with Vitest.', context: '' })!
    expect(parseDecisions(md2)).toEqual([d, { date: '2026-11-05', text: 'We will go with Vitest.', context: '' }])
  })

  test('the same decision is not logged twice, whatever the case or punctuation', () => {
    const md = appendDecision(null, d)!
    expect(appendDecision(md, { ...d, date: '2026-11-09', text: 'on part sur postgres' })).toBeNull()
  })

  test('keeps what the person wrote around the entries', () => {
    const md = '# Our decisions\n\nSome notes.\n\n- 2026-01-01 · Old one\n'
    const out = appendDecision(md, d)!
    expect(out.startsWith(md)).toBe(true)
    expect(out.endsWith(formatEntry(d))).toBe(true)
  })

  test('dates are local YYYY-MM-DD', () => {
    expect(dayOf(new Date(2026, 10, 4, 12).getTime())).toBe('2026-11-04')
  })

  test('the listing is newest first and says when empty', () => {
    expect(listing([], 5)).toMatch(/No decision logged yet/)
    const all = [1, 2, 3].map(i => ({ date: `2026-11-0${i}`, text: `d${i}`, context: '' }))
    const out = listing(all, 2)
    expect(out.indexOf('d3')).toBeLessThan(out.indexOf('d2'))
    expect(out).toContain('3 decisions')
    expect(out).toContain('and 1 older')
    expect(out).not.toContain('d1')
  })
})

describe('in the engine', () => {
  const start = async ($: any, on: any, files: Map<string, string>) => {
    on('session.cwd', () => ({ value: '/proj' }))
    on('fs.read', (_$: any, e: any) => {
      const t = files.get(e.path)
      if (t === undefined) throw new Error('ENOENT')
      return { value: t }
    })
    on('fs.write', (_$: any, e: any) => {
      files.set(e.path, e.text)
      return { value: undefined }
    })
    on('clock.now', () => ({ value: new Date(2026, 10, 4, 12).getTime() }))
    on('command.register', () => ({ value: { command: 'x' } }))
    on('store.get', () => ({ value: undefined }))
    on('prompt.submit', (_$: any, e: any) => ({ text: e.text }))
    on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })
  }

  test('a decision in a prompt lands in DECISIONS.md and the prompt goes through untouched', async ($, on) => {
    const files = new Map<string, string>()
    await start($, on, files)
    const r: any = await $.prompt.submit({ text: 'On part sur Postgres. Ajoute la migration.' })
    expect(r.text).toBe('On part sur Postgres. Ajoute la migration.')
    const md = files.get('/proj/DECISIONS.md')!
    expect(md).toContain('- 2026-11-04 · On part sur Postgres.')
  })

  test('a prompt with no decision writes nothing', async ($, on) => {
    const files = new Map<string, string>()
    await start($, on, files)
    await $.prompt.submit({ text: 'Fix the failing test' })
    expect(files.size).toBe(0)
  })

  test('/decision-log lists them', async ($, on) => {
    const files = new Map<string, string>([['/proj/DECISIONS.md', '# Decisions\n\n- 2026-11-01 · We will go with Vitest.\n']])
    await start($, on, files)
    const r = await $.command.run({ command: 'decision-log', args: '', origin: { kind: 'composer' } as never, presentation: { isFullscreen: false, columns: 120 } })
    expect(JSON.stringify(r)).toContain('We will go with Vitest.')
  })
})
