// Contract for scope-fence: the values it keeps in $.state.

/** A write held because it falls outside the fence. */
export type HeldWrite = {
  id: string
  /** Write, Edit or MultiEdit. */
  tool: string
  /** The path as Claude gave it. */
  path: string
}

declare module 'claude-code' {
  interface PluginState {
    'scope-fence': {
      /** The allowed paths, as written in .claude/fence.json; empty means no fence. */
      fence: string[]
      /** The write waiting for an answer. */
      held: HeldWrite | null
      /** Writes held this session, and how many were let through once. */
      counts: { held: number; allowed: number }
      /** Folded to one line (the chevron, /scope-fence-collapse); mirrored to $.store. */
      isCollapsed: boolean
    }
  }
}
