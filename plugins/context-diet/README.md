# context-diet

Context fills up on a few big things: a test run that printed 20k tokens, the same file read five times. This mod watches the tool calls of the session, lists those, and suggests `/compact` once the window passes a threshold.

```
◆ Context diet · 64% of the window · 3 offenders · over 60%       ▾
● src/api/routes.ts · read 4× · ~14k tokens
● npm test · Bash · ~12k tokens
● https://docs.example.com/guide · WebFetch · ~9.1k tokens

[ Compact ]
```

- A **big tool result** (over 8000 tokens by default) gets a toast and a line in the band.
- A **file read 3 or more times** gets a toast on the third read and a line in the band.
- Past the **threshold** (60% of the window by default) a toast says so and the band shows **Compact**, which runs `/compact`. After a compaction, the list starts over.
- The chevron, or `/context-diet-collapse`, folds the band to one line. The choice is kept across sessions.

## Install

```
/plugin marketplace add arhunsaday/claude-plugins
/plugin install context-diet@arhun-plugins
```

## Limits

- Sizes are **estimates**: the text the model read, at 4 characters a token. The window fill is the host's own figure.
- It counts the main conversation's tool calls; a subagent's results never reach this context and are ignored.
- A file edited between reads still counts as re-read; the mod cannot tell why Claude read it again.
- Tool results from before the mod loaded (or before a resume) are not known.

## Commands and options

`/context-diet` (the top ten offenders), `/context-diet-collapse`. Options: `thresholdPercent` (default 60), `bigResultTokens` (default 8000).

Develop with `claude --plugin-dir plugins/context-diet`, test with `claude plugin test plugins/context-diet`.
