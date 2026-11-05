# scope-fence

Tell Claude where it may change files. A `Write`, `Edit` or `MultiEdit` outside the fence is held in a band until you answer.

```
⚠ Write outside the fence · Edit · src/ui/button.ts           ▾
● src/api/
● tests/api/

[ Block ] [ Allow once ]
```

**Block** refuses the call and tells Claude to stay inside the fence or ask you to widen it. **Allow once** lets that one write through; the next one outside is held again. A session with no screen (`claude -p`) blocks at once.

## Declare the fence

In `.claude/fence.json` at the project root:

```json
{ "allow": ["src/api/", "tests/api/", "README.md"] }
```

or from the prompt: `/scope-fence src/api/ tests/api/` (writes that file), `/scope-fence` (shows it), `/scope-fence off` (clears it). The file is read on every call, so editing it by hand takes effect at once. No file, or an empty list, means no fence.

An entry is a folder, a file, or an absolute path. `src/api/` allows everything beneath it but not `src/api-v2/`; `..` is resolved before the check, so `src/api/../ui/x.ts` is outside.

## Install

```
/plugin marketplace add arhunsaday/claude-plugins
/plugin install scope-fence@arhun-plugins
```

## Limits

- It fences Claude's `Write`, `Edit` and `MultiEdit` calls only. `Bash` (`sed -i`, redirects, `git checkout`), `NotebookEdit`, MCP tools and subagents' own processes are not looked at; use a permission rule or a sandbox where that matters.
- Symbolic links are not followed: the check is on the path as given.
- The fence is read from the session's working directory.

## Commands and options

`/scope-fence`, `/scope-fence-collapse` (fold the band to one line; also the chevron). Option: `timeoutSeconds` (default 0, waits forever; set it to auto-block).

Develop with `claude --plugin-dir plugins/scope-fence`, test with `claude plugin test plugins/scope-fence`.
