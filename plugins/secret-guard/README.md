# secret-guard

Claude sometimes pastes a key it was shown into a file, or into a `curl` command. This mod looks at every `Write`, `Edit`, `MultiEdit`, `NotebookEdit` and `Bash` call before it runs, and holds the ones that would put a credential on disk or on the network.

```
⚠ Secret about to be written · Write · config/settings.ts
● GitHub token  ghp_••••••••9c · line 12
● AWS access key  AKIA••••••••GH · line 14

[ Block ] [ Allow once ]
```

The secret is never shown, logged or sent back to Claude: only its first four and last two characters. **Block** (the default) refuses the call and tells Claude to use an environment variable or a secret manager. **Allow once** lets that one call through; the next one is checked again. Nobody answering within the timeout counts as Block, and a session with no screen (`claude -p`) blocks at once.

## Install

```
/plugin marketplace add arhunsaday/claude-plugins
/plugin install secret-guard@arhun-plugins
```

## What it finds

| Kind | Pattern |
|---|---|
| AWS | `AKIA…`/`ASIA…` access keys, `aws_secret_access_key = …` |
| GitHub | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_` |
| Anthropic / OpenAI | `sk-ant-…`, `sk-…` / `sk-proj-…` |
| Slack | `xoxb-`, `xoxp-`, `xapp-` … |
| Stripe | `sk_live_…`, `rk_live_…` |
| Google | `AIza…` API keys |
| Private keys | `-----BEGIN … PRIVATE KEY-----` |
| Generic | `password=`, `token:`, `api_key=`, `secret=` with a long, mixed, high-entropy value (placeholders, `$VARS`, `process.env.X` and code calls are ignored) |
| `.env` | values written to `.env`, `.env.local`, `.env.production` (not `.env.example`), and `curl -d @.env` uploads |

For `Bash`, a command is only held when it writes (`>`, `>>`, `tee`, `sed -i`) or sends (`curl`, `wget`, `http`, `nc`); `echo $KEY` or `git status` are left alone. Text Claude removes (`old_string`) is never scanned, only what it would write.

## Limits

- It reads the call, not what a command does at run time: `cat .env | curl …` is not caught, `curl -d @.env` is.
- A regex set has false negatives (unknown key formats, secrets split across strings) and a few false positives; Allow once is the way out of those.
- It does not scan `Read` results or MCP tool calls.

## Options

`timeoutSeconds` (default 60; 0 waits forever).

## Commands

None. Develop with `claude --plugin-dir plugins/secret-guard`, test with `claude plugin test plugins/secret-guard`.
