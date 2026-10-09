import { EmailAlreadyRegisteredError } from "../../users/domain/errors.js";
import type { UserRepository } from "../../users/domain/user.repository.js";
import { toPublicUser, type PublicUser, type User } from "../../users/domain/user.js";
import { AdminProvisionConflictError } from "../domain/errors.js";
import type { PasswordHasher } from "../domain/password-hasher.js";
import { validateRegistrationInput } from "../domain/registration-input.js";

export interface AdminProvisionResult {
  status: "created" | "already-exists";
  user: PublicUser;
}

function existingAdmin(user: User): AdminProvisionResult {
  if (user.role !== "ADMIN") throw new AdminProvisionConflictError();
  return { status: "already-exists", user: toPublicUser(user) };
}

export class ProvisionAdmin {
  constructor(private readonly users: UserRepository, private readonly passwords: PasswordHasher) {}

  async execute(input: unknown): Promise<AdminProvisionResult> {
    const values = validateRegistrationInput(input);
    const existing = await this.users.findByEmail(values.email);
    if (existing) return existingAdmin(existing);
    const passwordHash = await this.passwords.hash(values.password);
    try {
      const user = await this.users.create({
        email: values.email,
        displayName: values.displayName,
        passwordHash,
        role: "ADMIN",
      });
      return { status: "created", user: toPublicUser(user) };
    } catch (error: unknown) {
      if (error instanceof EmailAlreadyRegisteredError) {
        const concurrent = await this.users.findByEmail(values.email);
        if (concurrent) return existingAdmin(concurrent);
      }
      throw error;
    }
  }
}
