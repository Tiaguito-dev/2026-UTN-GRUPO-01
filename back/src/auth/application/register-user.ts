import { EmailAlreadyRegisteredError } from "../../users/domain/errors.js";
import type { UserRepository } from "../../users/domain/user.repository.js";
import { toPublicUser, type PublicUser } from "../../users/domain/user.js";
import type { PasswordHasher } from "../domain/password-hasher.js";
import { validateRegistrationInput } from "../domain/registration-input.js";

export class RegisterUser {
  constructor(private readonly users: UserRepository, private readonly passwords: PasswordHasher) {}

  async execute(input: unknown): Promise<PublicUser> {
    const values = validateRegistrationInput(input);
    if (await this.users.findByEmail(values.email)) {
      throw new EmailAlreadyRegisteredError();
    }
    const passwordHash = await this.passwords.hash(values.password);
    const user = await this.users.create({
      email: values.email,
      displayName: values.displayName,
      passwordHash,
      role: "USER",
    });
    return toPublicUser(user);
  }
}
