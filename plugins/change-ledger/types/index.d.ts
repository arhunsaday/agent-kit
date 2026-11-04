// Contract for change-ledger: the values it keeps in $.state.

/** One file touched by Write, Edit or MultiEdit since the batch began. */
export type LedgerEntry = {
  /** Absolute path. */
  path: string
  /** Lines added, summed over the batch. */
  added: number
  /** Lines removed, summed over the batch. */
  removed: number
  /** How many calls touched it. */
  edits: number
  /** The file did not exist before the batch (its first touch was a Write that created it). */
  isNew: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'change-ledger': {
      /** The current batch, in order of first touch. */
      entries: LedgerEntry[]
      /** Batches handed to Claude to commit this session. */
      batches: number
      /** Folded to one line (the chevron, /change-ledger-collapse); mirrored to $.store. */
      isCollapsed: boolean
    }
  }
}
