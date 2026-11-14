import type { Session } from "./session.js";

export interface IdleSessionPolicy {
  idleTtlSeconds: number;
  idleWarningSeconds: number;
}

export interface SessionStatus {
  serverNow: string;
  warningAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export function sessionExpired(session: Session, now: Date, idleTtlSeconds: number): boolean {
  return session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime()
    || session.lastActivityAt.getTime() + idleTtlSeconds * 1000 <= now.getTime();
}

export function sessionStatus(session: Session, now: Date, policy: IdleSessionPolicy): SessionStatus {
  const idleExpiry = session.lastActivityAt.getTime() + policy.idleTtlSeconds * 1000;
  const effectiveExpiry = Math.min(idleExpiry, session.expiresAt.getTime());
  return {
    serverNow: now.toISOString(),
    warningAt: new Date(effectiveExpiry - policy.idleWarningSeconds * 1000).toISOString(),
    idleExpiresAt: new Date(idleExpiry).toISOString(),
    absoluteExpiresAt: session.expiresAt.toISOString(),
  };
}
