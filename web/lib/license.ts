/** Jawaban GET /v1/license. */
export type License = {
  mode: "cloud" | "self_host"
  phase: Phase
  allowed: boolean
  state?: string
  plan_name?: string
  expires_at?: string
  grace_until?: string
  checked_at?: string
}

export type Phase =
  | "NORMAL"
  | "GRACE"
  | "RESTRICTED"
  | "NOT_ACTIVATED"
  | "UNREACHABLE"
  | "UNLICENSED"
