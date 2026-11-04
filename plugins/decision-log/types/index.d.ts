// Contract for decision-log: the values it keeps in $.state.

/** One decision as it stands in DECISIONS.md. */
export type LoggedDecision = {
  /** YYYY-MM-DD. */
  date: string
  /** The decision, one sentence, as the user wrote it. */
  text: string
  /** One line of what it was about; empty when there was none. */
  context: string
}

declare module 'claude-code' {
  interface PluginState {
    'decision-log': {
      /** The newest decision, from this session or read from DECISIONS.md at start. */
      last: LoggedDecision | null
      /** How many decisions DECISIONS.md holds. */
      count: number
      /** Whether the band above the prompt is shown. */
      isShown: boolean
    }
  }
}
