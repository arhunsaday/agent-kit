// spend-meter: what the session has cost, and what the last turn cost, above the prompt, against a budget.
//
// The cost is the host's own ledger (`$.session.usage().cost.usd`, what /cost totals), so no price table is needed.
// Only when the host keeps no ledger does the mod fall back to token counts times the `prices` option (empty by
// default: see prices.ts). Tokens by model (in, out, cache read, cache write) come from `turn.complete`.
// 80% of the budget: a toast, once. 100%: the next prompt is held until the person cancels it or continues.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HeldPrompt, ModelTokens } from '../types'
import { cleanBudget, crossed, fmtTokens, fmtUsd, fraction } from './money'
import { estimate, parsePrices, type Price } from './prices'
import { band } from './view'

export { fmtUsd, fmtTokens, fraction, levelOf, bar, crossed, cleanBudget } from './money'
export { parsePrices, estimate } from './prices'

const spentAtom = atom({ plugin: 'spend-meter', key: 'spentUsd' } as const, null as number | null)
const turnAtom = atom({ plugin: 'spend-meter', key: 'turnUsd' } as const, null as number | null)
const turnsAtom = atom({ plugin: 'spend-meter', key: 'turns' } as const, 0)
const modelsAtom = atom({ plugin: 'spend-meter', key: 'models' } as const, {} as Record<string, ModelTokens>)
const budgetAtom = atom({ plugin: 'spend-meter', key: 'budgetUsd' } as const, 5)
const warnedAtom = atom({ plugin: 'spend-meter', key: 'isWarned' } as const, false)
const ackAtom = atom({ plugin: 'spend-meter', key: 'isAcknowledged' } as const, false)
const heldAtom = atom({ plugin: 'spend-meter', key: 'held' } as const, null as HeldPrompt | null)
const collapsedAtom = atom({ plugin: 'spend-meter', key: 'isCollapsed' } as const, false)

const COMMANDS = [
  { name: 'spend-meter', description: 'Session cost, last turn and tokens by model' },
  { name: 'spend-meter-budget', description: 'Set the session budget in dollars (0 turns it off)' },
  { name: 'spend-meter-collapse', description: 'Spend band: fold it to one line, or open it again' },
]

async function costNow($: EngineInterface): Promise<number | null> {
  try {
    const u = await $.session.usage()
    return typeof u.cost?.usd === 'number' ? u.cost.usd : null
  } catch {
    return null
  }
}

/** Moves the session figure and raises the 80% toast on the way past it. */
async function setSpent($: EngineInterface, usd: number) {
  const before = await read($, spentAtom)
  const budget = await read($, budgetAtom)
  await update($, spentAtom, () => usd)
  const hit = crossed(fraction(before, budget), fraction(usd, budget))
  if (hit && (hit === 'over' || !(await read($, warnedAtom)))) {
    await update($, warnedAtom, () => true)
    $.ui.toast(
      hit === 'over'
        ? `Budget reached: ${fmtUsd(usd)} of ${fmtUsd(budget)}. The next prompt asks first.`
        : `80% of the ${fmtUsd(budget)} budget spent (${fmtUsd(usd)}).`,
    )
  }
}

export const register: Register = (on, options) => {
  const prices: Record<string, Price> = parsePrices(options.prices)
  const decisions = new Map<string, 'cancel' | 'proceed'>()
  let turnBase: number | null = null
  let fallbackTotal = 0
  let usedFallback = false
  let holder: string | null = null

  on('session.start', async ($, e, next) => {
    for (const c of COMMANDS) await $.command.register(c)
    const stored = await $.store.get('budgetUsd')
    await update($, budgetAtom, () => (typeof stored === 'number' ? cleanBudget(stored) : cleanBudget(options.budgetUsd ?? 5)))
    if ((await $.store.get('isCollapsed')) === true) await update($, collapsedAtom, () => true)
    const now = await costNow($)
    if (now !== null) await update($, spentAtom, () => now)
    return next(e)
  })

  // Live figure: the engine raises this when the ledger grows.
  on('session.measure', async ($, e, next) => {
    if (typeof e.cost?.usd === 'number') await setSpent($, e.cost.usd).catch(() => undefined)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) turnBase = await costNow($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const u = e.usage
    let turnUsd: number | null = null
    const after = await costNow($)
    if (after !== null && turnBase !== null) turnUsd = Math.max(0, after - turnBase)
    else if (after !== null) turnUsd = null

    let estimateUsd: number | null = null
    if (u) {
      const t = { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens }
      estimateUsd = after === null ? estimate(prices, u.model, t) : null
      await update($, modelsAtom, m => {
        const old = m[u.model] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, estimateUsd: null }
        return {
          ...m,
          [u.model]: {
            input: old.input + t.input,
            output: old.output + t.output,
            cacheRead: old.cacheRead + t.cacheRead,
            cacheWrite: old.cacheWrite + t.cacheWrite,
            estimateUsd: estimateUsd === null ? old.estimateUsd : (old.estimateUsd ?? 0) + estimateUsd,
          },
        }
      })
    }
    if (after !== null) {
      await setSpent($, after)
    } else if (estimateUsd !== null) {
      usedFallback = true
      fallbackTotal += estimateUsd
      turnUsd = estimateUsd
      await setSpent($, fallbackTotal)
    }
    if (turnUsd !== null) await update($, turnAtom, () => turnUsd)
    await update($, turnsAtom, n => n + 1)
    turnBase = null
    return next(e)
  })

  // At 100% the next prompt waits for an answer. Commands, plugin prompts and queued ones pass.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || e.origin?.kind === 'plugin') return next(e)
    const [spent, budget, isAck] = await Promise.all([read($, spentAtom), read($, budgetAtom), read($, ackAtom)])
    const f = fraction(spent, budget)
    if (f === null || f < 1 || isAck) return next(e)

    if ((await $.session.surfaces()).length === 0) {
      return { drop: `spend-meter: the ${fmtUsd(budget)} budget is spent (${fmtUsd(spent)}); nobody is here to confirm, so the prompt was not sent.` }
    }
    for (;;) {
      if ((next as { signal?: AbortSignal }).signal?.aborted) return { drop: 'spend-meter: the prompt was stopped before it was confirmed.' }
      if (holder === null && (await read($, heldAtom)) === null) break
      await $.process.run(['sleep', '0.25'])
    }
    const id = `p${await $.clock.now()}`
    holder = id
    try {
      await update($, heldAtom, () => ({ id, spentUsd: spent ?? 0, budgetUsd: budget }))
      while (!decisions.has(id) && !(next as { signal?: AbortSignal }).signal?.aborted) await $.process.run(['sleep', '0.25'])
      const d = decisions.get(id) ?? 'cancel'
      decisions.delete(id)
      await update($, heldAtom, () => null)
      if (d === 'cancel') return { drop: `spend-meter: not sent. ${fmtUsd(spent)} of the ${fmtUsd(budget)} budget is spent. /spend-meter-budget raises it.` }
      await update($, ackAtom, () => true)
      return next(e)
    } finally {
      holder = null
      await update($, heldAtom, h => (h && h.id === id ? null : h)).catch(() => undefined)
    }
  })

  on('command.run', { command: 'spend-meter' }, async $ => {
    const [spent, turn, turns, models, budget] = await Promise.all([read($, spentAtom), read($, turnAtom), read($, turnsAtom), read($, modelsAtom), read($, budgetAtom)])
    const lines = [
      `Session ${fmtUsd(spent)} · last turn ${fmtUsd(turn)} · ${turns} turn${turns === 1 ? '' : 's'} · budget ${budget > 0 ? fmtUsd(budget) : 'off'}`,
      usedFallback ? 'Cost: estimated from the prices option (the host reported no cost).' : 'Cost: the session ledger, as /cost totals it.',
    ]
    for (const [model, t] of Object.entries(models)) {
      lines.push(`${model}: in ${fmtTokens(t.input)} · out ${fmtTokens(t.output)} · cache read ${fmtTokens(t.cacheRead)} · cache write ${fmtTokens(t.cacheWrite)}${t.estimateUsd !== null ? ` · ~${fmtUsd(t.estimateUsd)}` : ''}`)
    }
    return { text: lines.join('\n') }
  })

  on('command.run', { command: 'spend-meter-budget' }, async ($, e) => {
    const arg = String(e.args ?? '').trim()
    if (arg === '') return { text: `Budget: ${(await read($, budgetAtom)) > 0 ? fmtUsd(await read($, budgetAtom)) : 'off'}. Usage: /spend-meter-budget 10` }
    const usd = cleanBudget(arg)
    await update($, budgetAtom, () => usd)
    await update($, warnedAtom, () => false)
    await update($, ackAtom, () => false)
    await $.store.set('budgetUsd', usd)
    return { text: usd > 0 ? `Budget set to ${fmtUsd(usd)}.` : 'Budget turned off.' }
  })

  on('command.run', { command: 'spend-meter-collapse' }, async $ => {
    const isCollapsed = !(await read($, collapsedAtom))
    await update($, collapsedAtom, () => isCollapsed)
    await $.store.set('isCollapsed', isCollapsed)
    return { text: isCollapsed ? 'Spend band collapsed to one line.' : 'Spend band expanded.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId !== undefined) return next(e)
    const [spentUsd, turnUsd, turns, budgetUsd, held, isCollapsed] = await Promise.all([
      read($, spentAtom), read($, turnAtom), read($, turnsAtom), read($, budgetAtom), read($, heldAtom), read($, collapsedAtom),
    ])
    if (spentUsd === null && !held) return next(e)
    const E = $.ui.resolve(e)
    const mine = band(
      E as Parameters<typeof band>[0],
      { spentUsd, turnUsd, turns, budgetUsd, held, isCollapsed },
      e.props.bodyColumns,
      {
        toggle: () => {
          void (async () => {
            const was = await read($, collapsedAtom)
            await update($, collapsedAtom, () => !was)
            await $.store.set('isCollapsed', !was)
          })()
        },
        cancel: () => held && decisions.set(held.id, 'cancel'),
        proceed: () => held && decisions.set(held.id, 'proceed'),
      },
    )
    const below = await next(e)
    if (!below) return mine
    const { Box } = E
    return (
      <Box flexDirection="column" rowGap={1}>
        {mine}
        {below}
      </Box>
    )
  })
}
