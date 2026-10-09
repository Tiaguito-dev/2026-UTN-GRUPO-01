import { randomUUID } from "node:crypto";
import type { UserRepository } from "../../users/domain/user.repository.js";
import type { PasswordRecoveryRepository } from "../domain/password-recovery.repository.js";
import type { PasswordResetEmail } from "../domain/password-reset-email.js";
import type { RefreshTokenService } from "../domain/refresh-token.service.js";
import { validateForgotPasswordInput } from "../domain/password-input.js";

export class RequestPasswordReset {
  constructor(
    private readonly users: UserRepository,
    private readonly recovery: PasswordRecoveryRepository,
    private readonly email: PasswordResetEmail,
    private readonly tokens: RefreshTokenService,
    private readonly ttlSeconds: number,
    private readonly minimumDurationMs: number,
    private readonly reportFailure: (code: string) => void = () => {},
    private readonly now: () => Date = () => new Date(),
    private readonly id: () => string = () => randomUUID(),
    private readonly delay: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  async execute(input: unknown): Promise<void> {
    const values = validateForgotPasswordInput(input);
    const started = performance.now();
    try {
      // Generate and digest even for an unknown account. Never expose the original.
      const token = this.tokens.generate();
      const user = await this.users.findByEmail(values.email);
      if (user) {
        const createdAt = this.now();
        const credentialId = this.id();
        const expiresAt = new Date(createdAt.getTime() + this.ttlSeconds * 1000);
        await this.recovery.issue({ id: credentialId, userId: user.id, tokenHash: token.hash, createdAt, expiresAt, consumedAt: null, invalidatedAt: null, deliveredAt: null });
        try {
          await this.email.send({ email: user.email, token: token.value, expiresAt });
          await this.recovery.markDelivered(credentialId, this.now());
        }
        catch {
          this.report("PASSWORD_RESET_DELIVERY_FAILED");
          try { await this.recovery.invalidate(credentialId, this.now()); }
          catch { this.report("PASSWORD_RESET_INVALIDATION_FAILED"); }
        }
      }
    } catch { this.report("PASSWORD_RESET_REQUEST_FAILED"); }
    finally {
      const remaining = this.minimumDurationMs - (performance.now() - started);
      if (remaining > 0) await this.delay(remaining);
    }
  }

  private report(code: string): void {
    // A failed logger must not turn a valid email into an account-enumerating error.
    try { this.reportFailure(code); } catch { /* Preserve the uniform public result. */ }
  }
}
