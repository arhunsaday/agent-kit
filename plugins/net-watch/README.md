# net-watch

Which domains did this session reach? This mod lists them as Claude contacts them, and lets you allow or deny each one. A denied domain is refused on the next call that names it.

```
⌁ Net watch · 3 domains · 2 new · 1 denied                    ▾
● registry.npmjs.org  new · 2× · npm
● docs.example.com    new · 1× · WebFetch
● evil.example.net    denied · 1× · curl

[ Deny registry.npmjs.org ] [ Allow ]
```

The question is about the newest domain nobody has answered. Unanswered domains are listed, not held: the call goes through, so the session is never stopped for a docs page. Deny it and the next call to it (or to any subdomain) is refused with a reason Claude can act on.

## Install

```
/plugin marketplace add arhunsaday/claude-plugins
/plugin install net-watch@arhun-plugins
```

## What it sees

- `WebFetch` URLs.
- `Bash` commands that use `curl`, `wget`, `http`, `git`, `npm`, `npx`, `pnpm`, `yarn`, `bun`, `pip`, `pipx`, `uv`, `gem`, `cargo` or `go`: every URL in the command, `curl example.com/x`, `git@host:org/repo` remotes. An install with no URL names its default registry (`registry.npmjs.org`; `pypi.org` and `files.pythonhosted.org`).
- Not seen: `localhost` and loopback addresses.

## The answers

`.claude/net-watch.json`, read on every call, so a hand edit counts at once:

```json
{ "allow": ["docs.example.com"], "deny": ["example.net"] }
```

A domain covers its subdomains. The longest entry wins (`deny: a.com` with `allow: api.a.com` allows `api.a.com`); a tie denies. `/net-watch` lists the domains, `/net-watch allow|deny|forget <domain>` answers one.

## Limits

- It reads **commands and URLs, not traffic**. A script, a build step or a package's install hook that opens its own connection is not seen, and a URL assembled in a shell variable is not either. It is a tripwire, not a firewall; use a network policy where that matters.
- Only `WebFetch` and `Bash` are watched; MCP tools and subagents' own processes are not.
- A transitive download (an npm install fetching tarballs from another host) shows as the registry only.

## Commands

`/net-watch`, `/net-watch-collapse` (fold the band to one line; also the chevron, remembered across sessions).

Develop with `claude --plugin-dir plugins/net-watch`, test with `claude plugin test plugins/net-watch`.
