import { Module } from "@nestjs/common";
import { PASSWORD_HASHER } from "../domain/password-hasher.js";
import { Argon2PasswordHasher } from "./argon2-password-hasher.js";

@Module({
  providers: [{ provide: PASSWORD_HASHER, useFactory: () => new Argon2PasswordHasher() }],
  exports: [PASSWORD_HASHER],
})
export class PasswordHashingModule {}
