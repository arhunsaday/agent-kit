// Contract for spend-meter: the values it keeps in $.state.

/** Token counts for one model, summed over the session (the API's four counts). */
export type ModelTokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** Dollars the fallback price table gave these tokens; null when the host's own cost is used. */
  estimateUsd: number | null
}

/** A prompt held because the budget is spent. */
export type HeldPrompt = {
  id: string
  spentUsd: number
  budgetUsd: number
}

declare module 'claude-code' {
  interface PluginState {
    'spend-meter': {
      /** Session cost in dollars, or null before any reading. */
      spentUsd: number | null
      /** What the last finished turn cost; null before one has. */
      turnUsd: number | null
      /** Finished turns this session. */
      turns: number
      /** Token counts by model id. */
      models: Record<string, ModelTokens>
      /** The session budget in dollars; 0 is none. */
      budgetUsd: number
      /** The 80% toast has been shown for this budget. */
      isWarned: boolean
      /** The person chose to go on past the budget; no more questions this session. */
      isAcknowledged: boolean
      /** The prompt waiting for an answer at 100%. */
      held: HeldPrompt | null
      /** Folded to one line (the chevron, /spend-meter-collapse); mirrored to $.store. */
      isCollapsed: boolean
    }
  }
}
