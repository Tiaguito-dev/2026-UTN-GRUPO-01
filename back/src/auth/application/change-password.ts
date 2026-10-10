import type { PasswordRecoveryRepository } from "../domain/password-recovery.repository.js";
import type { PasswordHasher } from "../domain/password-hasher.js";
import { validateChangePasswordInput } from "../domain/password-input.js";
import { InvalidPasswordChangeError } from "../domain/password-errors.js";

export class ChangePassword {
  constructor(
    private readonly recovery: PasswordRecoveryRepository,
    private readonly passwords: PasswordHasher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, input: unknown): Promise<void> {
    const values = validateChangePasswordInput(input);
    const user = await this.recovery.findPasswordByUserId(userId);
    if (!user || !await this.passwords.verify(user.passwordHash, values.currentPassword)) throw new InvalidPasswordChangeError();
    if (values.newPassword === values.currentPassword) throw new InvalidPasswordChangeError();
    const passwordHash = await this.passwords.hash(values.newPassword);
    if (!await this.recovery.change(userId, user.passwordHash, passwordHash, this.now())) throw new InvalidPasswordChangeError();
  }
}
