import { randomUUID } from "node:crypto";
import type { AccessTokenService } from "../domain/access-token.js";
import type { RefreshCredentialRepository } from "../domain/refresh-credential.repository.js";
import type { RefreshTokenService } from "../domain/refresh-token.service.js";
import { InvalidRefreshCredentialError } from "../domain/refresh-errors.js";
import type { LoginResult } from "./login.js";

export class RefreshSession {
  constructor(
    private readonly credentials: RefreshCredentialRepository,
    private readonly tokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly accessTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
    private readonly id: () => string = () => randomUUID(),
  ) {}

  async execute(refreshToken: string | undefined): Promise<LoginResult> {
    const hash = refreshToken === undefined ? null : this.refreshTokens.hash(refreshToken);
    if (!hash) throw new InvalidRefreshCredentialError();
    let result: LoginResult | undefined;
    const status = await this.credentials.rotate(hash, this.now(), async (session, user) => {
      if (!user || user.id !== session.userId) throw new InvalidRefreshCredentialError();
      const issuedAt = Math.floor(this.now().getTime() / 1000);
      const expiresAt = Math.min(issuedAt + this.accessTtlSeconds, Math.floor(session.expiresAt.getTime() / 1000));
      if (expiresAt <= issuedAt) throw new InvalidRefreshCredentialError();
      const refresh = this.refreshTokens.generate();
      const accessToken = await this.tokens.issue({ userId: user.id, sessionId: session.id, issuedAt, expiresAt });
      const createdAt = new Date(issuedAt * 1000);
      result = { user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt },
        accessToken, expiresAt: new Date(expiresAt * 1000), refreshToken: refresh.value, refreshExpiresAt: session.expiresAt };
      return { id: this.id(), sessionId: session.id, tokenHash: refresh.hash, createdAt,
        expiresAt: session.expiresAt, consumedAt: null, invalidatedAt: null };
    });
    if (status !== "rotated" || !result) throw new InvalidRefreshCredentialError();
    return result;
  }
}
