import type { PasswordRecoveryRepository } from "../domain/password-recovery.repository.js";
import type { PasswordHasher } from "../domain/password-hasher.js";
import type { RefreshTokenService } from "../domain/refresh-token.service.js";
import { validateResetPasswordInput } from "../domain/password-input.js";
import { InvalidPasswordResetTokenError } from "../domain/password-errors.js";

export class ResetPassword {
  constructor(
    private readonly recovery: PasswordRecoveryRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokens: RefreshTokenService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: unknown): Promise<void> {
    const values = validateResetPasswordInput(input);
    const hash = this.tokens.hash(values.token);
    if (!hash) throw new InvalidPasswordResetTokenError();
    const credential = await this.recovery.findByHash(hash);
    if (!credential || credential.deliveredAt === null || credential.expiresAt <= this.now() || credential.consumedAt || credential.invalidatedAt) throw new InvalidPasswordResetTokenError();
    // Hash outside any database transaction; reset rechecks all state under its lock.
    const passwordHash = await this.passwords.hash(values.newPassword);
    if (!await this.recovery.reset(hash, passwordHash, this.now())) throw new InvalidPasswordResetTokenError();
  }
}
