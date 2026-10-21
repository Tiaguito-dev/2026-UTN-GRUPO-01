import { validateInstitutionalEmailDomain } from "../domain/institutional-domain.js";
import { randomUUID } from "node:crypto";
import type { UserRepository } from "../../users/domain/user.repository.js";
import { canAuthenticate } from "../../users/domain/user.js";
import type { RefreshTokenService } from "../domain/refresh-token.service.js";
import { validateForgotPasswordInput } from "../domain/password-input.js";
import { InvalidEmailVerificationTokenError, VerificationDeliveryError, type EmailVerificationRepository, type VerificationEmail } from "../domain/email-verification.js";
export class EmailVerification {
  constructor(private readonly users: UserRepository, private readonly repository: EmailVerificationRepository,
    private readonly email: VerificationEmail, private readonly tokens: RefreshTokenService,
    private readonly now: () => Date = () => new Date(), private readonly id: () => string = () => randomUUID(),
    private readonly minimumDurationMs = 0, private readonly reportFailure: (code: string) => void = () => {}) {}

  async requestForUser(userId: string, email: string): Promise<void> {
    validateInstitutionalEmailDomain(email);
    const token = this.tokens.generate();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const id = this.id();
    if (!await this.repository.issue({ id, userId, tokenHash: token.hash, createdAt, expiresAt,
      consumedAt: null, invalidatedAt: null, deliveredAt: null })) return;
    try {
      await this.email.send({ email, token: token.value, expiresAt });
      await this.repository.markDelivered(id, this.now());
    } catch {
      this.report("VERIFICATION_EMAIL_DELIVERY_FAILED");
      try { await this.repository.invalidate(id, this.now()); } catch { this.report("VERIFICATION_INVALIDATION_FAILED"); }
      throw new VerificationDeliveryError();
    }
  }

  async resend(input: unknown): Promise<void> {
    const { email } = validateForgotPasswordInput(input);
    const started = performance.now();
    try {
      validateInstitutionalEmailDomain(email);
      const user = await this.users.findByEmail(email);
      if (user && !canAuthenticate(user)) await this.requestForUser(user.id, user.email);
    } catch { this.report("VERIFICATION_RESEND_FAILED"); }
    finally {
      const remaining = this.minimumDurationMs - (performance.now() - started);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  private report(code: string): void { try { this.reportFailure(code); } catch { /* Logging must not leak errors. */ } }

  async verify(input: unknown): Promise<void> {
    const token = typeof input === "object" && input !== null && "token" in input ? input.token : undefined;
    const hash = typeof token === "string" ? this.tokens.hash(token) : null;
    if (!hash || !await this.repository.verify(hash, this.now())) throw new InvalidEmailVerificationTokenError();
  }
}
