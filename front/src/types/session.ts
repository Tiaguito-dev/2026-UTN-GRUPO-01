export interface SessionStatus {
  serverNow: string;
  warningAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export type SessionEndReason = "idle" | "absolute" | "logout" | "expired";
