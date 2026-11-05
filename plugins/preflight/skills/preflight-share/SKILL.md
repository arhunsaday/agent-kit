---
name: preflight-share
description: Export, share or import an AI setup with Preflight (a resource, a loadout or the whole configuration), previewing what an import would change. Use when the user wants to share their setup, send a config to a teammate, or import one from a file or share code.
---

# Preflight share

Use `preflight` if on PATH, otherwise `npx -y @arhunsaday/preflight`.

## Export

```bash
preflight share --out setup.json                     # whole configuration to a local file
preflight share --id <resource> --out one.json       # one resource
preflight share --loadout <name> --out loadout.json  # a resolved loadout
preflight share --scope project --out project.json   # only project (or global) resources
```

- Prefer `--out`: a local file the user can send themselves. Publishing needs a service and a token in the environment (`PREFLIGHT_SHARE_TOKEN` or what `preflight share --help` names); do not look for one or ask the user to paste it.
- Before sharing, open the payload and check it for secrets (tokens in MCP `env`, absolute home paths, private URLs). Remove or flag them; shares are `unlisted` by default, `--public` only on request.
- `preflight revoke <code>` withdraws a hosted share.

## Import

Importing changes the user's configuration, so it is two steps:

1. Preview: `preflight --dry-run apply <file-or-code-or-/s/ URL>`. Summarize each resource (type, scope, what it runs) and flag anything that executes code (hooks, MCP commands). Show the diff.
2. After an explicit yes, run it again without `--dry-run`, then `preflight doctor --json`.

Check `preflight --help` if `apply` is named `import` in this version. Undo with `preflight rollback`.
