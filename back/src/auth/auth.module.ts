import { Logger, Module } from "@nestjs/common";
import { APP_FILTER, HttpAdapterHost, Reflector } from "@nestjs/core";
import { randomBytes } from "node:crypto";
import { USER_REPOSITORY, type UserRepository } from "../users/domain/user.repository.js";
import { UsersModule } from "../users/users.module.js";
import { RegisterUser } from "./application/register-user.js";
import { Login } from "./application/login.js";
import { RefreshSession } from "./application/refresh-session.js";
import { Logout } from "./application/logout.js";
import { AuthenticateRequest } from "./application/authenticate-request.js";
import { AUTH_CONFIG, readAuthConfig, type AuthConfig } from "./auth.config.js";
import { AuthController } from "./auth.controller.js";
import { PASSWORD_HASHER, type PasswordHasher } from "./domain/password-hasher.js";
import { PasswordHashingModule } from "./infrastructure/password-hashing.module.js";
import { ACCESS_TOKEN_SERVICE, type AccessTokenService } from "./domain/access-token.js";
import { SESSION_REPOSITORY, type SessionRepository } from "./domain/session.repository.js";
import { JoseAccessTokenService } from "./infrastructure/jose-access-token.js";
import { PrismaSessionRepository } from "./infrastructure/prisma-session.repository.js";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { AuthenticationGuard } from "./presentation/authentication.guard.js";
import { RolesGuard } from "./presentation/roles.guard.js";
import { RegistrationBadRequestFilter } from "./registration-bad-request.filter.js";
import { REFRESH_CREDENTIAL_REPOSITORY, type RefreshCredentialRepository } from "./domain/refresh-credential.repository.js";
import { REFRESH_TOKEN_SERVICE, type RefreshTokenService } from "./domain/refresh-token.service.js";
import { PrismaRefreshCredentialRepository } from "./infrastructure/prisma-refresh-credential.repository.js";
import { CryptoRefreshTokenService } from "./infrastructure/crypto-refresh-token.service.js";
import { RequestPasswordReset } from "./application/request-password-reset.js";
import { ResetPassword } from "./application/reset-password.js";
import { ChangePassword } from "./application/change-password.js";
import { PASSWORD_RECOVERY_REPOSITORY, type PasswordRecoveryRepository } from "./domain/password-recovery.repository.js";
import { PASSWORD_RESET_EMAIL, type PasswordResetEmail } from "./domain/password-reset-email.js";
import { PrismaPasswordRecoveryRepository } from "./infrastructure/prisma-password-recovery.repository.js";
import { SMTP_CONFIG, readSmtpConfig, type SmtpConfig } from "./smtp.config.js";
import { SmtpPasswordResetEmail } from "./infrastructure/smtp-password-reset-email.js";

@Module({
  imports: [UsersModule, PasswordHashingModule],
  controllers: [AuthController],
  providers: [
    {
      provide: APP_FILTER,
      useFactory: (adapter: HttpAdapterHost) => new RegistrationBadRequestFilter(adapter),
      inject: [HttpAdapterHost],
    },
    { provide: AUTH_CONFIG, useFactory: () => readAuthConfig(process.env) },
    { provide: SMTP_CONFIG, useFactory: () => readSmtpConfig(process.env) },
    {
      provide: PASSWORD_RECOVERY_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaPasswordRecoveryRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: PASSWORD_RESET_EMAIL,
      useFactory: (smtp: SmtpConfig, configuration: AuthConfig) => new SmtpPasswordResetEmail(smtp, configuration.passwordResetUrl),
      inject: [SMTP_CONFIG, AUTH_CONFIG],
    },
    {
      provide: RequestPasswordReset,
      useFactory: (users: UserRepository, recovery: PasswordRecoveryRepository, email: PasswordResetEmail, tokens: RefreshTokenService, configuration: AuthConfig) => {
        const logger = new Logger("PasswordRecovery");
        return new RequestPasswordReset(users, recovery, email, tokens, configuration.passwordResetTtlSeconds,
          configuration.passwordResetMinResponseMs, (code) => logger.error(code));
      },
      inject: [USER_REPOSITORY, PASSWORD_RECOVERY_REPOSITORY, PASSWORD_RESET_EMAIL, REFRESH_TOKEN_SERVICE, AUTH_CONFIG],
    },
    {
      provide: ResetPassword,
      useFactory: (recovery: PasswordRecoveryRepository, passwords: PasswordHasher, tokens: RefreshTokenService) => new ResetPassword(recovery, passwords, tokens),
      inject: [PASSWORD_RECOVERY_REPOSITORY, PASSWORD_HASHER, REFRESH_TOKEN_SERVICE],
    },
    {
      provide: ChangePassword,
      useFactory: (recovery: PasswordRecoveryRepository, passwords: PasswordHasher) => new ChangePassword(recovery, passwords),
      inject: [PASSWORD_RECOVERY_REPOSITORY, PASSWORD_HASHER],
    },
    { provide: REFRESH_TOKEN_SERVICE, useFactory: () => new CryptoRefreshTokenService() },
    {
      provide: REFRESH_CREDENTIAL_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaRefreshCredentialRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ACCESS_TOKEN_SERVICE,
      useFactory: (configuration: AuthConfig) => new JoseAccessTokenService(configuration),
      inject: [AUTH_CONFIG],
    },
    {
      provide: SESSION_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaSessionRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: RegisterUser,
      useFactory: (users: UserRepository, passwords: PasswordHasher) => new RegisterUser(users, passwords),
      inject: [USER_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: Login,
      useFactory: async (users: UserRepository, passwords: PasswordHasher, credentials: RefreshCredentialRepository, tokens: AccessTokenService, refreshTokens: RefreshTokenService, configuration: AuthConfig) => {
        const dummyHash = await passwords.hash(randomBytes(32).toString("base64url"));
        return new Login(users, passwords, credentials, tokens, refreshTokens, dummyHash, configuration.accessTtlSeconds, configuration.sessionTtlSeconds);
      },
      inject: [USER_REPOSITORY, PASSWORD_HASHER, REFRESH_CREDENTIAL_REPOSITORY, ACCESS_TOKEN_SERVICE, REFRESH_TOKEN_SERVICE, AUTH_CONFIG],
    },
    {
      provide: RefreshSession,
      useFactory: (credentials: RefreshCredentialRepository, tokens: AccessTokenService, refreshTokens: RefreshTokenService, configuration: AuthConfig) => new RefreshSession(credentials, tokens, refreshTokens, configuration.accessTtlSeconds),
      inject: [REFRESH_CREDENTIAL_REPOSITORY, ACCESS_TOKEN_SERVICE, REFRESH_TOKEN_SERVICE, AUTH_CONFIG],
    },
    {
      provide: Logout,
      useFactory: (sessions: SessionRepository, credentials: RefreshCredentialRepository, tokens: AccessTokenService, refreshTokens: RefreshTokenService) => new Logout(sessions, credentials, tokens, refreshTokens),
      inject: [SESSION_REPOSITORY, REFRESH_CREDENTIAL_REPOSITORY, ACCESS_TOKEN_SERVICE, REFRESH_TOKEN_SERVICE],
    },
    {
      provide: AuthenticateRequest,
      useFactory: (users: UserRepository, sessions: SessionRepository, tokens: AccessTokenService) => new AuthenticateRequest(users, sessions, tokens),
      inject: [USER_REPOSITORY, SESSION_REPOSITORY, ACCESS_TOKEN_SERVICE],
    },
    {
      provide: AuthenticationGuard,
      useFactory: (authenticate: AuthenticateRequest, configuration: AuthConfig) => new AuthenticationGuard(authenticate, configuration),
      inject: [AuthenticateRequest, AUTH_CONFIG],
    },
    { provide: RolesGuard, useFactory: (reflector: Reflector) => new RolesGuard(reflector), inject: [Reflector] },
  ],
  exports: [RegisterUser, Login, RefreshSession, Logout, RequestPasswordReset, ResetPassword, ChangePassword, AuthenticateRequest, AuthenticationGuard, RolesGuard, AUTH_CONFIG],
})
export class AuthModule {}
