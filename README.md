# agent-kit

Everything I install into AI coding agents, in one repository: skills, Claude
Code plugins and mods, hooks, subagents, slash commands, a status line, MCP
templates, loadouts, the global `CLAUDE.md`, project templates, prompts,
standards and evals.

One repository, three ways in:

| You want | Run |
|---|---|
| The Claude Code plugins and mods | `claude plugin marketplace add arhunsaday/agent-kit`, then `claude plugin install <plugin>@arhun-plugins` |
| The skills, in any agent (Claude Code, Codex, Cursor, ...) | `npx skills add arhunsaday/agent-kit` (add `--skill <name>` for one) |
| All of it, managed, previewed and reversible | `preflight source add github:arhunsaday/agent-kit@main`, then `preflight search`, `preflight loadouts list`, `preflight loadouts install base` |

[Preflight](https://github.com/arhunsaday/preflight) is the tool; this
repository is content. Preflight reads it through `catalog/index.json`, pinned
to the commit the ref names, and writes each file with a preview, a lock and a
rollback.

## Plugins (marketplace `arhun-plugins`)

In Claude Code, add the marketplace once and install from it:

```
/plugin marketplace add arhunsaday/agent-kit
/plugin install <plugin>@arhun-plugins
```

| Plugin | Kind | What it does |
|---|---|---|
| [plan-progress](plugins/plan-progress) | mod | Live plan progress bars above the prompt, with agent strips you can fold and soft sounds. |
| [where-am-i](plugins/where-am-i) | mod | A live recap above the prompt: goal, what Claude is doing now, next step, what waits on you. |
| [blast-radius](plugins/blast-radius) | mod | Holds destructive commands and shows what they would destroy before they run. Replaces the old `block-dangerous.sh` hook. |
| [context-cache](plugins/context-cache) | mod | Context usage, usage limits and prompt-cache warmth above the prompt, as rings; collapses to one line. |
| [cache-warm](plugins/cache-warm) | mod | Prompt-cache countdown, hit rate and savings above the prompt, with keep-warm pings, toggled by /cache-warm. |
| [assumptions](plugins/assumptions) | mod | Lists the small guesses Claude made without asking; mark each right or wrong, and a wrong one gets fixed on its own. |
| [bureau](plugins/bureau) | mod | Le Bureau des agents in a side pane: its pixel-art office and engine, playing your session's agents. |
| [secret-guard](plugins/secret-guard) | mod | Holds Write, Edit and Bash calls that would put API keys, tokens, private keys or .env contents on disk or on the network; masked preview, allow once. |
| [decision-log](plugins/decision-log) | mod | Spots decisions in your prompts (French and English) and appends them to DECISIONS.md; a band shows the last one. |
| [change-ledger](plugins/change-ledger) | mod | Files Claude touched with +/- lines, and a button that asks Claude to commit exactly that batch. |
| [net-watch](plugins/net-watch) | mod | Lists the domains a session contacts; allow or deny each in .claude/net-watch.json, and denied ones are blocked on the next call. |
| [scope-fence](plugins/scope-fence) | mod | Holds Write, Edit and MultiEdit outside the paths you declare (.claude/fence.json or /scope-fence); Allow once or Block. |
| [context-diet](plugins/context-diet) | mod | Flags big tool results and files read 3+ times, suggests /compact past a context threshold; a band lists the top offenders. |
| [spend-meter](plugins/spend-meter) | mod | Session and per-turn cost against a budget: bar, toast at 80%, confirmation at 100%; collapses to one line. |
| [preflight](plugins/preflight) | plugin | Lets Claude drive the Preflight CLI: audit your setup, install resources and loadouts with a dry run first, share or import a setup. |

## What is in it

|                    | Count   |                                                                                       |
| ------------------ | ------- | ------------------------------------------------------------------------------------- |
| Skills (mine)      | **56**  | communication · delivery · quality · architecture · design · stack · ai · ops · tools |
| Hooks              | 9       | 3 blocking by default (secret reads, protected files, red-tests-no-PR); `block-dangerous` is deprecated |
| Slash commands     | 3       | papercut · skills-sync · session-audit |
| Subagents          | 11      | specialised roles in `claude/agents/` |
| Instincts          | 5       | reviewed, situational lessons for the project template |
| Tool pointers      | 9       | Claude · Codex · Cursor · Copilot · Gemini · Windsurf · Zed · Cline · Aider |
| Loadouts           | 6       | role × stack bundles with a reason per item, see [loadouts/LOADOUTS.md](loadouts/LOADOUTS.md) |

Every skill records where it came from, and imported skills keep their
upstream `LICENSE`:

```yaml
source:
  upstream: JuliusBrussee/caveman@7bb7130
  license: MIT (JuliusBrussee)
  imported: 2026-08-02
```

Skills by other people are not copied here: [third-party/](third-party/)
lists them and installs them with `npx skills`.

## Layout

```
.claude-plugin/marketplace.json   the arhun-plugins marketplace
plugins/<name>/                   one plugin or mod per folder
scaffolds/{plugin,mod}/           starters for scripts/new-plugin.sh
skills/<category>/<name>/         skills (npx skills finds them two levels deep)
claude/                           CLAUDE.md, rules/, settings.base.json, hooks/,
                                  commands/, agents/, statusline/, mcp.json
loadouts/                         loadouts.json, profiles.json, LOADOUTS.md
third-party/                      registry of other people's skills + installers
project-templates/                project drop-in (AGENTS.md, instincts, CI), starters
agent-instructions/ prompts/ standards/ evals/
guides/                           how this content is meant to be used
catalog/index.json                generated by `preflight catalog build .`
install.sh                        transitional installer (symlinks into ~/.claude)
scripts/                          kit.py, loadouts.py, instincts.py, behavior_evals.py,
                                  doctor.sh, new-plugin.sh
```

## With Preflight

```bash
preflight source add github:arhunsaday/agent-kit@main   # pinned to today's commit
preflight search caveman                                # results show source:agent-kit
preflight loadouts show base
preflight --dry-run loadouts install base
preflight source update agent-kit                       # move to the ref's new commit
```

`claude/CLAUDE.md` is an `instructions` resource: Preflight writes it into
`~/.claude/CLAUDE.md` as a marked block, so anything you wrote around it stays
yours. Hosts, tokens and servers that are yours alone (work Jira, Grafana,
local tools) do not belong here; keep them in your dotfiles overlay and use the
`${VAR}` placeholders in `claude/mcp.json`.

After changing content, rebuild the index:

```bash
npx @arhunsaday/preflight catalog build . --repo arhunsaday/agent-kit
```

## Without Preflight (transitional)

```bash
git clone https://github.com/arhunsaday/agent-kit ~/Repos/agent-kit
cd ~/Repos/agent-kit && ./install.sh --dry-run && ./install.sh
./install.sh --project ../my-repo           # copy the agent drop-in into a project
./install.sh new next-shadcn ../my-app      # official starter + configuration packs
./scripts/doctor.sh                         # what is installed, wired, missing
```

`install.sh` links into free slots only, stops on conflicts, backs up with
`--force`, and never overwrites an existing `settings.json`. It goes away as
Preflight takes over each target. Guides: [guides/](guides/).

## Adding a plugin

```bash
scripts/new-plugin.sh my-plugin          # skills, commands, agents, hooks, MCP
scripts/new-plugin.sh my-mod mod         # a mod
claude plugin validate .
```

Run one from its folder while you work on it (`claude --plugin-dir plugins/<name>`),
and bump `version` in its `plugin.json` when you release a change.

## Checks

```bash
python3 scripts/kit.py check
python3 -m unittest discover -s tests
claude plugin validate .
```

## Licence

MIT, see [LICENSE](LICENSE). Plugins and skills adapted from other projects
keep their own licence file and credit the original authors.
