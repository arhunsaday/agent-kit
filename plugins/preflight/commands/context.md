---
description: Show what your agent configuration costs in context, per skill, MCP server and instruction file
argument-hint: "[--mode potential|catalogue] [--agent claude] [--scope global|project]"
---

Use the `preflight-audit` skill. Run `preflight context --json $ARGUMENTS` (or via `npx -y @arhunsaday/preflight` when `preflight` is not on PATH). Show a table of the biggest contributors (name, kind, scope, estimated tokens), the total, and what is unknown (MCP runtime tool schemas are not counted). Suggest the two or three cuts with the largest saving. Change nothing.
