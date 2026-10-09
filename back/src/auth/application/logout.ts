import type { AccessTokenService } from "../domain/access-token.js";
import { InvalidAccessTokenError } from "../domain/auth-errors.js";
import type { SessionRepository } from "../domain/session.repository.js";
import type { RefreshCredentialRepository } from "../domain/refresh-credential.repository.js";
import type { RefreshTokenService } from "../domain/refresh-token.service.js";

export class Logout {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly credentials: RefreshCredentialRepository,
    private readonly tokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { accessToken?: string; refreshToken?: string }): Promise<void> {
    if (input.accessToken) {
      let claims;
      try { claims = await this.tokens.verify(input.accessToken); }
      catch (error) { if (!(error instanceof InvalidAccessTokenError)) throw error; }
      if (claims) {
        const session = await this.sessions.findById(claims.sessionId);
        if (session && session.userId === claims.userId && claims.issuedAt * 1000 >= session.createdAt.getTime() &&
          claims.expiresAt * 1000 <= session.expiresAt.getTime()) {
          await this.credentials.revokeSession(session.id, this.now(), claims.userId);
          return;
        }
      }
    }
    const hash = input.refreshToken === undefined ? null : this.refreshTokens.hash(input.refreshToken);
    if (!hash) return;
    const credential = await this.credentials.findByHash(hash);
    if (credential) await this.credentials.revokeSession(credential.sessionId, this.now());
  }
}
