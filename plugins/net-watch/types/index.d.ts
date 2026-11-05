// Contract for net-watch: the values it keeps in $.state.

/** A domain contacted this session. */
export type SeenDomain = {
  /** How many calls named it. */
  count: number
  /** The tool of the latest call ("WebFetch", "curl", "npm", ...). */
  via: string
}

declare module 'claude-code' {
  interface PluginState {
    'net-watch': {
      /** Domains named by this session's calls, by host. */
      seen: Record<string, SeenDomain>
      /** Domains allowed, as written in .claude/net-watch.json. A domain covers its subdomains. */
      allow: string[]
      /** Domains denied, as written in .claude/net-watch.json. A domain covers its subdomains. */
      deny: string[]
      /** Calls blocked this session. */
      blocked: number
      /** Folded to one line (the chevron, /net-watch-collapse); mirrored to $.store. */
      isCollapsed: boolean
    }
  }
}
