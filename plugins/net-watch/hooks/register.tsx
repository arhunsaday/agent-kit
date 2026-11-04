// net-watch: the domains the session contacts, from WebFetch URLs and the hosts in Bash commands (curl, wget, npm,
// pip, git ...). Each domain can be allowed or denied; the answers live in .claude/net-watch.json and a denied
// domain (and its subdomains) is refused on the next call that names it. Unanswered domains are listed, not held.
// It reads the command, not the traffic: a script that opens its own connection is not seen.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SeenDomain } from '../types'
import { FILE, formatList, hostsOf, parseList, ranked, setStatus, statusOf } from './watch'
import { band } from './view'

export { bashHosts, hostsOf, statusOf, parseList, setStatus, covers, ranked } from './watch'

const seenAtom = atom({ plugin: 'net-watch', key: 'seen' } as const, {} as Record<string, SeenDomain>)
const allowAtom = atom({ plugin: 'net-watch', key: 'allow' } as const, [] as string[])
const denyAtom = atom({ plugin: 'net-watch', key: 'deny' } as const, [] as string[])
const blockedAtom = atom({ plugin: 'net-watch', key: 'blocked' } as const, 0)
const collapsedAtom = atom({ plugin: 'net-watch', key: 'isCollapsed' } as const, false)

const COMMANDS = [
  { name: 'net-watch', description: 'List domains; /net-watch allow|deny|forget <domain> answers one' },
  { name: 'net-watch-collapse', description: 'Net watch band: fold it to one line, or open it again' },
]

async function load($: EngineInterface) {
  const text = await $.fs.read(`${await $.session.cwd()}/${FILE}`).catch(() => null)
  const lists = parseList(typeof text === 'string' ? text : null)
  if (JSON.stringify(lists.allow) !== JSON.stringify(await read($, allowAtom))) await update($, allowAtom, () => lists.allow)
  if (JSON.stringify(lists.deny) !== JSON.stringify(await read($, denyAtom))) await update($, denyAtom, () => lists.deny)
  return lists
}

async function answer($: EngineInterface, domain: string, to: 'allow' | 'deny' | 'forget') {
  const lists = await load($)
  const next = setStatus(lists.allow, lists.deny, domain, to)
  await $.fs.write(`${await $.session.cwd()}/${FILE}`, formatList(next.allow, next.deny))
  await update($, allowAtom, () => next.allow)
  await update($, denyAtom, () => next.deny)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const c of COMMANDS) await $.command.register(c)
    if ((await $.store.get('isCollapsed')) === true) await update($, collapsedAtom, () => true)
    await load($)
    return next(e)
  })

  for (const tool of ['WebFetch', 'Bash'] as const) {
    on('tool.call', { tool: tool as 'Bash' }, async ($: EngineInterface, e: any, next: any) => {
      const hosts = hostsOf(tool, e as Record<string, unknown>)
      if (hosts.length === 0) return next(e)
      const { allow, deny } = await load($)
      const blocked = hosts.filter(h => statusOf(h.host, allow, deny) === 'denied')
      for (const h of hosts) {
        await update($, seenAtom, s => ({ ...s, [h.host]: { count: (s[h.host]?.count ?? 0) + 1, via: h.via } }))
      }
      if (blocked.length > 0) {
        await update($, blockedAtom, n => n + 1)
        const names = blocked.map(b => b.host).join(', ')
        return {
          deny: `net-watch: ${names} ${blocked.length === 1 ? 'is' : 'are'} denied in ${FILE}. Don't contact ${blocked.length === 1 ? 'it' : 'them'} again; ask the user to run /net-watch allow ${blocked[0]!.host} if it is needed.`,
        }
      }
      return next(e)
    })
  }

  on('command.run', { command: 'net-watch' }, async ($, e) => {
    const [word, domain] = String(e.args ?? '').trim().split(/\s+/)
    if (word === 'allow' || word === 'deny' || word === 'forget') {
      if (!domain) return { text: `Usage: /net-watch ${word} <domain>` }
      await answer($, domain, word)
      return { text: word === 'forget' ? `${domain}: answer removed.` : `${domain}: ${word === 'allow' ? 'allowed' : 'denied'} (saved in ${FILE}).` }
    }
    const [seen, allow, deny, blocked] = await Promise.all([read($, seenAtom), read($, allowAtom), read($, denyAtom), read($, blockedAtom)])
    const rows = ranked(seen, allow, deny)
    const lines = rows.map(r => `${r.host} · ${r.status} · ${r.count}× · ${r.via}`)
    const idle = [...allow, ...deny].filter(d => !rows.some(r => r.host === d || r.host.endsWith(`.${d}`)))
    return {
      text: [
        rows.length ? `${rows.length} domain${rows.length === 1 ? '' : 's'} contacted, ${blocked} call${blocked === 1 ? '' : 's'} blocked:` : 'No domains contacted yet.',
        ...lines,
        ...(idle.length ? [`In ${FILE}, not seen yet: ${idle.join(', ')}`] : []),
      ].join('\n'),
    }
  })

  on('command.run', { command: 'net-watch-collapse' }, async $ => {
    const isCollapsed = !(await read($, collapsedAtom))
    await update($, collapsedAtom, () => isCollapsed)
    await $.store.set('isCollapsed', isCollapsed)
    return { text: isCollapsed ? 'Net watch band collapsed to one line.' : 'Net watch band expanded.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId !== undefined) return next(e)
    const [seen, allow, deny, blocked, isCollapsed] = await Promise.all([
      read($, seenAtom), read($, allowAtom), read($, denyAtom), read($, blockedAtom), read($, collapsedAtom),
    ])
    const rows = ranked(seen, allow, deny)
    if (rows.length === 0) return next(e)
    const E = $.ui.resolve(e)
    const mine = band(E as Parameters<typeof band>[0], { rows, blocked, isCollapsed }, {
      toggle: () => {
        void (async () => {
          const was = await read($, collapsedAtom)
          await update($, collapsedAtom, () => !was)
          await $.store.set('isCollapsed', !was)
        })()
      },
      allow: host => void answer($, host, 'allow'),
      deny: host => void answer($, host, 'deny'),
    })
    const below = await next(e)
    if (!below) return mine
    const { Box } = E
    return (
      <Box flexDirection="column" rowGap={1}>
        {mine}
        {below}
      </Box>
    )
  })
}
