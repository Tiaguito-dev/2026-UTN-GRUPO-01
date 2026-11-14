import { canAuthenticate } from "../../users/domain/user.js";
import type { UserRepository } from "../../users/domain/user.repository.js";
import type { UserRole } from "../../users/domain/user.js";
import type { SessionRepository } from "../domain/session.repository.js";
import type { AccessTokenService } from "../domain/access-token.js";
import { InvalidAccessTokenError, UnauthenticatedError } from "../domain/auth-errors.js";
import { sessionExpired } from "../domain/session-lifetime.js";

export interface AuthenticatedUser { id: string; email: string; displayName: string; role: UserRole; }

export class AuthenticateRequest {
  constructor(private readonly users: UserRepository, private readonly sessions: SessionRepository,
    private readonly tokens: AccessTokenService, private readonly now: () => Date = () => new Date(),
    private readonly idleTtlSeconds = 1800) {}

  async execute(token: string): Promise<AuthenticatedUser> {
    return (await this.executeWithSession(token)).user;
  }

  async executeWithSession(token: string): Promise<{ user: AuthenticatedUser; sessionId: string }> {
    let claims;
    try { claims = await this.tokens.verify(token); }
    catch (error) { if (error instanceof InvalidAccessTokenError) throw new UnauthenticatedError(); throw error; }
    const now = this.now();
    const session = await this.sessions.findValidById(claims.sessionId, now);
    if (!session || session.userId !== claims.userId || sessionExpired(session, now, this.idleTtlSeconds) ||
      claims.expiresAt * 1000 > session.expiresAt.getTime() || claims.issuedAt * 1000 < session.createdAt.getTime()) {
      throw new UnauthenticatedError();
    }
    const user = await this.users.findById(claims.userId);
    // Database lookups can outlive the remaining session window. Check again after the
    // last await so an otherwise valid JWT cannot admit a request past that deadline.
    const checkedAt = new Date(Math.max(now.getTime(), this.now().getTime()));
    if (!user || !canAuthenticate(user) || sessionExpired(session, checkedAt, this.idleTtlSeconds)) {
      throw new UnauthenticatedError();
    }
    return { user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role }, sessionId: session.id };
  }
}
