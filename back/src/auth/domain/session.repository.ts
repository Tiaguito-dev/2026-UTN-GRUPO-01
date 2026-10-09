import type { Session } from "./session.js";

export const SESSION_REPOSITORY = Symbol("SESSION_REPOSITORY");

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  findValidById(id: string, now: Date): Promise<Session | null>;
}
