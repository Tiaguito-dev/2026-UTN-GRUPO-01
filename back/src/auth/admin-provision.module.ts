import { Module } from "@nestjs/common";
import { USER_REPOSITORY, type UserRepository } from "../users/domain/user.repository.js";
import { UsersModule } from "../users/users.module.js";
import { ProvisionAdmin } from "./application/provision-admin.js";
import { PASSWORD_HASHER, type PasswordHasher } from "./domain/password-hasher.js";
import { PasswordHashingModule } from "./infrastructure/password-hashing.module.js";

// Operational CLI composition deliberately does not start HTTP or require JWT configuration.
@Module({
  imports: [UsersModule, PasswordHashingModule],
  providers: [{
    provide: ProvisionAdmin,
    useFactory: (users: UserRepository, passwords: PasswordHasher) => new ProvisionAdmin(users, passwords),
    inject: [USER_REPOSITORY, PASSWORD_HASHER],
  }],
  exports: [ProvisionAdmin],
})
export class AdminProvisionModule {}
