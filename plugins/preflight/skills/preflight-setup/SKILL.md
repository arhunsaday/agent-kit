---
name: preflight-setup
description: Find, inspect and install skills, MCP servers, agents, hooks, plugins and loadouts with the Preflight CLI, always previewing with --dry-run and showing the diff before anything is written. Use when the user wants to add, change, remove or sync a resource or a loadout in their AI setup.
---

# Preflight setup

Use `preflight` if on PATH, otherwise `npx -y @arhunsaday/preflight`. Run `preflight --help` once if unsure of a command name; the CLI is young and names move.

## Flow

1. **Find**: `preflight search "<query>"` (`--type skill|mcp|agent|hook|plugin`, `--online`, `--github owner/repo`). `preflight loadouts list` for bundles.
2. **Inspect before trusting**: `preflight catalog-inspect <id>` or `preflight inspect <id>`. Read what it runs, which commands, which env vars, which network access. Say anything suspicious (shell hooks, unpinned `npx`, broad permissions) before going on.
3. **Preview**: run the write command with the global `--dry-run`, for example
   - `preflight --dry-run catalog-add <id>`
   - `preflight --dry-run loadouts install <name>` (`loadouts show <name> --explain` first)
   - `preflight --dry-run create <file>` / `update <id> <file>` / `delete <id>` / `move <id> <scope>`
   - `preflight --dry-run sync` to reconcile the desired config to harness files
4. **Show the diff**: the files that would change, with before/after of each. Name the scope (global or project) of every entry.
5. **Ask**: wait for an explicit yes.
6. **Apply**: the same command without `--dry-run`. Then `preflight doctor --json` and report any new finding.

Packages are installed only with `preflight install <id> --execute`; preview it without `--execute` first and tell the user it runs a package manager outside Preflight's rollback.

## Rules

- Default to project scope; use global only when asked.
- One resource at a time unless the user asked for a loadout.
- If something goes wrong: `preflight recover`, then `preflight rollback`; `preflight audit` shows the history.
- Never pass credentials on the command line or print them.
