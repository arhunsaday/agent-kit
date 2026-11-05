# decision-log

Decisions get made in prompts and forgotten by the next session: "on part sur Postgres", "we'll go with Vitest". This mod notices them and appends each one to `DECISIONS.md` at the project root, so the reasoning outlives the conversation.

```
◆ Decision · 2026-11-04 · 7 logged
On part sur Postgres pour le stockage.
```

## Install

```
/plugin marketplace add arhunsaday/claude-plugins
/plugin install decision-log@arhun-plugins
```

## What it logs

Cheap and local: a regex pass over each prompt you submit. No model call, nothing leaves your machine, no cost in tokens. The first sentence that states a decision is kept, with the sentence before it as context:

```markdown
# Decisions

- 2026-11-04 · On part sur Postgres pour le stockage.
  - context: SQLite ou Postgres, les deux tiennent la charge.
- 2026-11-06 · We'll go with Vitest.
```

| Language | Cues |
|---|---|
| Français | on part sur, on garde, on reste sur/avec, on retient/valide/choisit/opte pour/tranche, on y va avec, c'est décidé, on a décidé, décision :, on abandonne |
| English | we'll go with, we're going with, let's go with, we decided, decided:, decision:, we'll keep/stick with/use/adopt/drop, final call |

Questions ("should we go with…?"), negations ("on n'a pas encore décidé"), hypotheticals ("if we go with…"), slash commands, code blocks and quoted lines are skipped. The same decision is never logged twice (case and punctuation ignored). The file is plain markdown: edit or delete lines freely; the mod only appends, and keeps whatever you wrote around the entries.

## Commands

| Command | Does |
|---|---|
| `/decision-log [n]` | Lists the latest 15 decisions (or `n`), newest first |
| `/decision-log-band` | Shows or hides the band with the last decision (remembered) |

## Limits

- Regex catches stated decisions, not implied ones; a missed or false hit is one line to fix in `DECISIONS.md`.
- It reads your prompts only, not Claude's replies.
- The file is written at the session's working directory; commit it or add it to `.gitignore` as you like.
