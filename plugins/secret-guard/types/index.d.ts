// Contract for secret-guard: the values it keeps in $.state.

/** One secret found in a call, never the secret itself: only a masked preview. */
export type SecretFinding = {
  /** Short name of the kind ("AWS access key"). */
  kind: string
  /** The value with its middle hidden ("AKIA••••••••CD"). */
  preview: string
  /** 1-based line of the call's text. */
  line: number
}

export type HeldCall = {
  id: string
  tool: string
  /** Where it would go: a file path, or "curl" / "wget" / "shell redirect" for a command. */
  target: string
  /** "disk" or "network". */
  sink: 'disk' | 'network'
  findings: SecretFinding[]
  secondsLeft: number | null
  timeoutSeconds: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'secret-guard': {
      held: HeldCall | null
    }
  }
}
