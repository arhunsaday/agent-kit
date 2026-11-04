# spend-meter

What this session has cost, and what the last turn cost, above the prompt, against a budget you set.

```
$ Spend · $3.91 session · $0.18 last turn                  ▾
budget  ████████████████░░░░ 78% of $5.00
```

- **80%** of the budget: a toast, once.
- **100%**: the next prompt is held. **Cancel prompt** drops it; **Continue anyway** sends it and stops asking for the rest of the session. A session with no screen (`claude -p`) drops the prompt instead.
- The chevron, or `/spend-meter-collapse`, folds the band to one line. The choice is kept across sessions.

## Install

```
/plugin marketplace add arhunsaday/claude-plugins
/plugin install spend-meter@arhun-plugins
```

## Where the numbers come from

The cost is the host's own ledger, `$.session.usage().cost.usd`, which is what `/cost` totals. No price table is needed, and none is guessed. A turn's cost is the ledger before and after it. Tokens by model (input, output, cache read, cache write) come from each finished turn and are listed by `/spend-meter`.

Only when the host keeps no ledger does the mod estimate, from those tokens and the `prices` option. **That table ships empty**: list prices change, and a wrong figure would pass for a measurement. Fill it in from your provider's price page and verify it (`hooks/prices.ts` explains the format). A model with no price adds nothing to the estimate.

## Limits

- The ledger is the session's, so the budget covers subagents' calls the host counts; the "last turn" figure is the main loop's turn only.
- After a resume, the ledger decides what "session" means.
- The 100% question holds a prompt in the band; a prompt a plugin or a command submits is not held.
- The band is drawn with the host's own text, on every surface; the desktop chevron chip and SVG variants are not drawn.

## Commands and options

`/spend-meter` (report), `/spend-meter-budget <dollars>` (0 = off, remembered), `/spend-meter-collapse`. Options: `budgetUsd` (default 5), `prices` (JSON, default empty).

Develop with `claude --plugin-dir plugins/spend-meter`, test with `claude plugin test plugins/spend-meter`.
