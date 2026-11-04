---
description: Run Preflight's doctor on your AI setup and explain the findings
argument-hint: "[--connect]"
---

Use the `preflight-audit` skill. Run `preflight doctor --json $ARGUMENTS` (or `npx -y @arhunsaday/preflight doctor --json $ARGUMENTS` when `preflight` is not on PATH), group the findings by severity, explain each in one line with its evidence, and propose the smallest fix for each. Change nothing until I confirm.
