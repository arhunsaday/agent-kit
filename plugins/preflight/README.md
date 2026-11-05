# preflight

Lets Claude drive [Preflight](https://www.npmjs.com/package/@arhunsaday/preflight), the CLI that inventories and manages AI-agent configuration (skills, MCP servers, agents, hooks, plugins, instructions) for Claude Code, Codex and Cursor.

Claude calls `preflight` when it is on your PATH, and `npx -y @arhunsaday/preflight` otherwise. Nothing is written without a `--dry-run` preview and your yes.

## Install

```
/plugin marketplace add arhunsaday/claude-plugins
/plugin install preflight@arhun-plugins
```

## Contents

| Component | Path | What it does |
|---|---|---|
| Skill `preflight-audit` | `skills/preflight-audit/SKILL.md` | Runs `doctor` and `context`, explains unused skills and MCP servers, `xhigh`/`max` as default effort, subagents without `model:`, global MCP servers that belong to a project, a CLAUDE.md over 200 lines, overlapping skills; proposes the smallest change. |
| Skill `preflight-setup` | `skills/preflight-setup/SKILL.md` | Search, inspect, add and sync resources and loadouts: dry run first, diff shown, applied only after your yes. |
| Skill `preflight-share` | `skills/preflight-share/SKILL.md` | Export a setup to a file, check it for secrets, preview an import before applying it. |
| Command | `/preflight:doctor` | Doctor findings, explained. |
| Command | `/preflight:context` | Context-cost map: what your setup costs per session. |
| Command | `/preflight:apply` | Preview, then apply, a sync, a loadout or a share. |

## Notes

- Command names follow the Preflight CLI in development; the skills tell Claude to check `preflight --help` when a command is rejected.
- `doctor --connect` starts your MCP servers and is only run when you ask.
