import type { RefreshCredential } from "./refresh-credential.js";
import type { Session } from "./session.js";
import type { PublicUser } from "../../users/domain/user.js";

export const REFRESH_CREDENTIAL_REPOSITORY = Symbol("REFRESH_CREDENTIAL_REPOSITORY");
export interface RefreshCredentialRepository {
  createSession(session: Session, credential: RefreshCredential, expectedPasswordHash: string): Promise<boolean>;
  findByHash(hash: string): Promise<RefreshCredential | null>;
  rotate(hash: string, now: Date, prepareReplacement: (session: Session, user: PublicUser | null) => Promise<RefreshCredential>): Promise<"rotated" | "invalid" | "reused">;
  revokeSession(sessionId: string, now: Date, expectedUserId?: string): Promise<void>;
}
