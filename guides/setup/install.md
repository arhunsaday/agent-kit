---
title: "Install"
---
```bash
git clone https://github.com/arhunsaday/agent-kit ~/Repos/agent-kit
cd ~/Repos/agent-kit
./install.sh
```

That symlinks everything into `~/.claude/`. Edit a file in the repo and the
change is live immediately — no re-run, no copy step. `git pull` updates every
machine that has run it.

## Flags

```bash
./install.sh --dry-run          # show what would happen, write nothing
./install.sh --force            # back up conflicting files, then link
./install.sh --unlink           # remove only the links this script made
./install.sh --project ~/repo   # copy the agent drop-in into a project
./install.sh --help
```

## What it refuses to do

The script never destroys anything:

| Situation | Behaviour |
| --- | --- |
| Destination is free | link it |
| Destination is a real file | warn, leave it, exit 1 |
| `--force` | move it to `~/.claude/backups/preflight-<timestamp>/`, then link |
| Destination links somewhere else | leave it alone |
| Kit file is empty or `.gitkeep` | skip — scaffolding must not shadow real config |
| You already have `settings.json` | **never** overwritten, not even with `--force` |

That last row matters. A `settings.json` holds permissions, hooks and MCP wiring
this kit knows nothing about, so it is merge-not-replace territory: bootstrap
fills a vacant slot and otherwise prints a `diff` command and leaves you to it.

## After installing

Restart Claude Code, or start a new session. Then:

```bash
/skills-sync     # pull the third-party skills up to date
```

Check the statusline is live — you should see
`📁 repo 🌿 branch | 🤖 model | ±diff | ████░░ 23%` at the bottom.
If not, your own `settings.json` needs the `statusLine` block from
[`claude/settings.base.json`](what-lands-where.md#settingsjson).
