// Contract for context-diet: the values it keeps in $.state.

/** One tool result that took a lot of context. */
export type BigResult = {
  /** The tool call's id. */
  id: string
  tool: string
  /** What was asked, short: the command, the path, the URL. */
  label: string
  /** Estimated tokens (4 characters each). */
  tokens: number
}

/** A file Claude read more than once. */
export type RereadFile = {
  path: string
  /** How many times it was read. */
  count: number
  /** Estimated tokens over all the reads. */
  tokens: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-diet': {
      /** The biggest tool results this stretch of the session, largest first, at most 20. */
      results: BigResult[]
      /** Every file read, by path. */
      reads: Record<string, { count: number; tokens: number }>
      /** The context fill as a whole percentage; null before a reading. */
      percent: number | null
      /** Folded to one line (the chevron, /context-diet-collapse); mirrored to $.store. */
      isCollapsed: boolean
      /** The threshold toast has been shown since the fill last fell below it. */
      isSuggested: boolean
    }
  }
}
