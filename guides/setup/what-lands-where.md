---
title: "What lands where"
---
```
agent-kit/                          ~/.claude/
├── claude/
│   ├── CLAUDE.md          ────────→ CLAUDE.md          (global instructions)
│   ├── settings.base.json ──✗──────  settings.json      (never overwritten — merge by hand)
│   ├── hooks/*.sh         ────────→ hooks/              (+ chmod +x)
│   ├── commands/*.md      ────────→ commands/           (slash commands)
│   ├── agents/*.md        ────────→ agents/             (subagents)
│   └── statusline/*.sh    ────────→ statusline/
├── skills/<cat>/<n>/      ────────→ skills/<n>/         (category flattened away)
├── project-templates/shared/agent/  (copied into a project by --project)
├── third-party/THIRD-PARTY.md       (not installed — a manifest of what the CLI manages)
└── guides/                          (these pages)
```

## Skills: organised here, flat there

Skills live under a category folder in the repo for browsing, but Claude Code
discovers them **one level deep**. `install.sh` flattens on install:

```
skills/quality/verify-security/  →  ~/.claude/skills/verify-security/
```

Consequence: **two skills can never share a name**, whatever folders they sit in.

## settings.json

Bootstrap will not touch an existing one. To adopt the kit's hooks and
statusline, merge these blocks into `~/.claude/settings.json` yourself:

- `statusLine` → points at `~/.claude/statusline/statusline-gradient.sh`
- `hooks` → the `PreToolUse` / `PostToolUse` / `Notification` / `Stop` wiring
- `permissions.deny` → `.env`, `*.pem`, `*.key`, `credentials.json`

```bash
diff ~/.claude/settings.json ~/Repos/agent-kit/claude/settings.base.json
```

The `permissions.deny` block is worth merging first — it is the one that stops
secrets entering the context window at all, and it costs nothing.

## Scopes

Claude Code reads configuration from three places, most specific winning:

| Scope | Path | Use for |
| --- | --- | --- |
| Enterprise | managed policy | org-wide rules |
| **User** | `~/.claude/` | everything in this kit |
| **Project** | `<repo>/.claude/` | project skills, project hooks, per-repo permissions |

A slow test suite is the usual reason to put a hook at project scope instead of
user scope — see [hooks](../claude-code/hooks.md).
