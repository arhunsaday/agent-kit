---
description: Preview, then apply, a Preflight change (sync, a loadout, or a share file or code)
argument-hint: "<sync | loadout <name> | share file or code>"
---

Use the `preflight-setup` and `preflight-share` skills. For "$ARGUMENTS": `sync` means `preflight sync`, `loadout <name>` means `preflight loadouts install <name>`, anything else is a share file, code or URL for `preflight apply`. Always run it first with the global `--dry-run`, show me the files that would change as a diff, and wait for my yes before running it for real. Then run `preflight doctor --json` and report anything new.
