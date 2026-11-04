---
name: preflight-audit
description: Audit the user's AI-agent setup with the Preflight CLI (doctor and context-cost map) and explain what is wasteful or risky. Use when the user asks to audit, clean up, slim down or check their Claude Code setup, skills, MCP servers, subagents, CLAUDE.md or context cost.
---

# Preflight audit

Read-only analysis first; propose changes, never apply them without an explicit yes.

## Run Preflight

Use `preflight` when it is on PATH (`command -v preflight`), otherwise `npx -y @arhunsaday/preflight`. Below, `preflight` stands for whichever applies. Output is JSON.

```bash
preflight doctor --json
preflight context --json                 # --mode potential (default) | catalogue, --agent claude, --scope global|project
preflight unmanaged --json               # installed but not tracked, when the command exists
```

If a flag or command is rejected, run `preflight --help` and adapt; do not guess. Add `--connect` to `doctor` only if the user agrees: it starts each configured MCP server.

## What to look for

Report only what the output or the files support, each with its evidence (a file, a count, a token figure).

1. **Unused skills and MCP servers**: configured but never used (usage data, `preflight usage`, or the doctor findings). Each MCP server adds tool schemas to every session.
2. **Effort**: `effortLevel` / default effort set to `xhigh` or `max` in settings. Those cost far more per turn; suggest `high` as the default and raising it per task.
3. **Subagents without `model:`**: agent files in `.claude/agents/` or `~/.claude/agents/` whose frontmatter has no `model`. They inherit the main model; cheap read-only agents usually fit a smaller one.
4. **Global MCP servers that belong to one project**: servers in user scope whose purpose is project-specific (a database, a deploy target). Suggest project scope (`.mcp.json`).
5. **Long instructions**: `CLAUDE.md` (or `AGENTS.md`) over 200 lines. Check with `wc -l`. Suggest moving reference material to a skill or a sibling file loaded on demand.
6. **Overlapping skills**: two skills whose descriptions trigger on the same requests. Name both and which to keep.
7. **Drift**: managed files changed outside Preflight, flagged by doctor.

## Output

A short table: finding, evidence, estimated saving (tokens or tool schemas when `context` gives it), smallest fix. Order by saving. Then ask which fixes to apply.

## Applying

Make the smallest change per finding (one setting, one removed entry, one scope move). Show the exact diff first. For changes made through Preflight use the `preflight-setup` skill, which always dry-runs first. Never delete a skill, agent or MCP entry the user did not confirm by name.
