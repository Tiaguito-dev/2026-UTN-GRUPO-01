import { randomUUID } from "node:crypto";
import type { UserRepository } from "../../users/domain/user.repository.js";
import { toPublicUser, type PublicUser } from "../../users/domain/user.js";
import type { PasswordHasher } from "../domain/password-hasher.js";
import type { RefreshCredentialRepository } from "../domain/refresh-credential.repository.js";
import type { RefreshTokenService } from "../domain/refresh-token.service.js";
import type { AccessTokenService } from "../domain/access-token.js";
import { InvalidCredentialsError } from "../domain/auth-errors.js";
import { validateLoginInput } from "../domain/login-input.js";

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
  expiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export class Login {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly credentials: RefreshCredentialRepository,
    private readonly tokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly dummyHash: string,
    private readonly accessTtlSeconds: number,
    private readonly sessionTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
    private readonly id: () => string = () => randomUUID(),
  ) {}

  async execute(input: unknown): Promise<LoginResult> {
    const values = validateLoginInput(input);
    const user = await this.users.findByEmail(values.email);
    const valid = await this.passwords.verify(user?.passwordHash ?? this.dummyHash, values.password);
    if (!user || !valid) throw new InvalidCredentialsError();
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const sessionExpiry = new Date((issuedAt + this.sessionTtlSeconds) * 1000);
    const expiresAt = Math.min(issuedAt + this.accessTtlSeconds, Math.floor(sessionExpiry.getTime() / 1000));
    const sessionId = this.id();
    const accessToken = await this.tokens.issue({ userId: user.id, sessionId, issuedAt, expiresAt });
    const expiry = new Date(expiresAt * 1000);
    const refresh = this.refreshTokens.generate();
    const createdAt = new Date(issuedAt * 1000);
    const created = await this.credentials.createSession(
      { id: sessionId, userId: user.id, createdAt, expiresAt: sessionExpiry, revokedAt: null },
      { id: this.id(), sessionId, tokenHash: refresh.hash, createdAt, expiresAt: sessionExpiry, consumedAt: null, invalidatedAt: null },
      user.passwordHash,
    );
    if (!created) throw new InvalidCredentialsError();
    return { user: toPublicUser(user), accessToken, expiresAt: expiry, refreshToken: refresh.value, refreshExpiresAt: sessionExpiry };
  }
}
