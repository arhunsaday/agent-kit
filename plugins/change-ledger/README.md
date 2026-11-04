# change-ledger

Which files did Claude touch, and by how much? A band above the prompt keeps the running batch, and one button asks Claude to commit exactly that batch.

```
± Change ledger · 3 files · +58 −12                           ▾
● src/api/routes.ts   +21 −8 · 2 edits
● src/api/auth.ts     +4 −4
● tests/auth.test.ts  +33 −0 · new

[ Commit this batch ] [ Clear ]
```

**Commit this batch** sends Claude a message that lists the files and the `git add -- …` line for exactly those, asks for one commit in the repository's style, and says not to push and to stop if other changes are staged. It then starts a new batch. **Clear** starts a new batch without sending anything. The chevron, or `/change-ledger-collapse`, folds the band to one line; the choice is kept across sessions.

## Install

```
/plugin marketplace add arhunsaday/claude-plugins
/plugin install change-ledger@arhun-plugins
```

## How the lines are counted

From the patch the tool returns when it gives one, otherwise from the lines of the text replaced and the text that replaced it. A `Write` that creates a file counts all its lines as added (marked `new`); one that overwrites a file counts its patch. A file touched again adds to its entry.

## Limits

- It sees `Write`, `Edit` and `MultiEdit` calls of the main conversation that succeeded. Changes made by `Bash` (`sed -i`, a formatter, `git checkout`, a code generator) and by subagents are not in the ledger, so a commit request can leave such files out.
- The ledger is the session's own list, not `git status`: a file already modified before the session, or one you edited by hand, is not in it.
- The batch is cleared when the commit request is sent, not when the commit succeeds; `/change-ledger` lists the current batch, and Claude's reply tells you if the commit failed.
- Line counts for a rewrite without a patch are approximate (all new lines added, all old lines removed).

## Commands

`/change-ledger` (list the batch), `/change-ledger-collapse`.

Develop with `claude --plugin-dir plugins/change-ledger`, test with `claude plugin test plugins/change-ledger`.
