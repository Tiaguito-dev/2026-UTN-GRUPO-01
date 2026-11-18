import type { Session } from "./session.js";
import type { IdleSessionPolicy } from "./session-lifetime.js";

export const SESSION_ACTIVITY_REPOSITORY = Symbol("SESSION_ACTIVITY_REPOSITORY");
export type SessionOperation = "read" | "activity" | "renew";

export interface SessionActivityRepository {
  access(sessionId: string, userId: string, operation: SessionOperation, now: Date,
    policy: IdleSessionPolicy): Promise<Session | null>;
}
