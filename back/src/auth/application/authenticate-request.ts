import type { UserRepository } from "../../users/domain/user.repository.js";
import type { UserRole } from "../../users/domain/user.js";
import type { SessionRepository } from "../domain/session.repository.js";
import type { AccessTokenService } from "../domain/access-token.js";
import { InvalidAccessTokenError, UnauthenticatedError } from "../domain/auth-errors.js";

export interface AuthenticatedUser { id: string; email: string; displayName: string; role: UserRole; }

export class AuthenticateRequest {
  constructor(private readonly users: UserRepository, private readonly sessions: SessionRepository,
    private readonly tokens: AccessTokenService, private readonly now: () => Date = () => new Date()) {}

  async execute(token: string): Promise<AuthenticatedUser> {
    let claims;
    try { claims = await this.tokens.verify(token); }
    catch (error) { if (error instanceof InvalidAccessTokenError) throw new UnauthenticatedError(); throw error; }
    const now = this.now();
    const session = await this.sessions.findValidById(claims.sessionId, now);
    if (!session || session.userId !== claims.userId || session.revokedAt !== null || session.expiresAt <= now ||
      claims.expiresAt * 1000 > session.expiresAt.getTime() || claims.issuedAt * 1000 < session.createdAt.getTime()) {
      throw new UnauthenticatedError();
    }
    const user = await this.users.findById(claims.userId);
    if (!user) throw new UnauthenticatedError();
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
  }
}
