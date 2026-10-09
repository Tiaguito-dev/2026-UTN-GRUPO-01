import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Inject, InternalServerErrorException, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { EmailAlreadyRegisteredError } from "../users/domain/errors.js";
import type { PublicUser } from "../users/domain/user.js";
import { RegisterUser } from "./application/register-user.js";
import { InvalidRegistrationInputError } from "./domain/errors.js";
import { Login } from "./application/login.js";
import { RefreshSession } from "./application/refresh-session.js";
import { Logout } from "./application/logout.js";
import { AUTH_CONFIG, type AuthConfig } from "./auth.config.js";
import { InvalidCredentialsError, InvalidLoginInputError } from "./domain/auth-errors.js";
import { AuthenticationGuard, type AuthenticatedRequest } from "./presentation/authentication.guard.js";
import { InvalidRefreshCredentialError } from "./domain/refresh-errors.js";
import { clearAuthCookies, readAuthCookie, setAuthCookies } from "./presentation/auth-cookies.js";
import { RequestPasswordReset } from "./application/request-password-reset.js";
import { ResetPassword } from "./application/reset-password.js";
import { ChangePassword } from "./application/change-password.js";
import { InvalidPasswordChangeError, InvalidPasswordInputError, InvalidPasswordResetTokenError } from "./domain/password-errors.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(RegisterUser) private readonly registerUser: RegisterUser,
    @Inject(Login) private readonly loginUser: Login,
    @Inject(RefreshSession) private readonly refreshSession: RefreshSession,
    @Inject(Logout) private readonly logoutSession: Logout,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(RequestPasswordReset) private readonly requestPasswordReset: RequestPasswordReset,
    @Inject(ResetPassword) private readonly resetPassword: ResetPassword,
    @Inject(ChangePassword) private readonly changePassword: ChangePassword,
  ) {}

  @Post("forgot-password")
  @HttpCode(202)
  async forgotPassword(@Body() input: unknown): Promise<{ message: string }> {
    try {
      await this.requestPasswordReset.execute(input);
      return { message: "Si existe una cuenta asociada al email, recibirás instrucciones para recuperar tu contraseña." };
    } catch (error: unknown) {
      if (error instanceof InvalidPasswordInputError) throw new BadRequestException(error.message, { cause: error });
      throw new InternalServerErrorException("Lo sentimos. No pudimos procesar su solicitud, intente nuevamente.");
    }
  }

  @Post("reset-password")
  @HttpCode(204)
  async reset(@Body() input: unknown, @Res({ passthrough: true }) response: Response): Promise<void> {
    try {
      await this.resetPassword.execute(input);
      clearAuthCookies(response, this.config);
    } catch (error: unknown) {
      if (error instanceof InvalidPasswordInputError || error instanceof InvalidPasswordResetTokenError) {
        throw new BadRequestException(error.message, { cause: error });
      }
      throw new InternalServerErrorException("Lo sentimos. No pudimos restablecer su contraseña, intente nuevamente.");
    }
  }

  @Post("change-password")
  @HttpCode(204)
  @UseGuards(AuthenticationGuard)
  async change(@Req() request: AuthenticatedRequest, @Body() input: unknown, @Res({ passthrough: true }) response: Response): Promise<void> {
    if (!request.authUser) throw new UnauthorizedException("Debe iniciar sesión para acceder.");
    try {
      await this.changePassword.execute(request.authUser.id, input);
      clearAuthCookies(response, this.config);
    } catch (error: unknown) {
      if (error instanceof InvalidPasswordInputError || error instanceof InvalidPasswordChangeError) {
        throw new BadRequestException(error.message, { cause: error });
      }
      throw new InternalServerErrorException("Lo sentimos. No pudimos cambiar su contraseña, intente nuevamente.");
    }
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() input: unknown, @Res({ passthrough: true }) response: Response): Promise<PublicUser> {
    try {
      const result = await this.loginUser.execute(input);
      setAuthCookies(response, this.config, result);
      return result.user;
    } catch (error: unknown) {
      if (error instanceof InvalidLoginInputError) throw new BadRequestException(error.message, { cause: error });
      if (error instanceof InvalidCredentialsError) throw new UnauthorizedException("Email o contraseña incorrectos.");
      throw new InternalServerErrorException("Lo sentimos. No pudimos iniciar sesión, intente nuevamente.");
    }
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<PublicUser> {
    try {
      const result = await this.refreshSession.execute(readAuthCookie(request, this.config.refreshCookieName));
      setAuthCookies(response, this.config, result);
      return result.user;
    } catch (error: unknown) {
      if (error instanceof InvalidRefreshCredentialError) {
        clearAuthCookies(response, this.config);
        throw new UnauthorizedException("La credencial de renovación es inválida o venció. Inicie sesión nuevamente.");
      }
      throw new InternalServerErrorException("Lo sentimos. No pudimos renovar su sesión, intente nuevamente.");
    }
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    try {
      await this.logoutSession.execute({
        accessToken: readAuthCookie(request, this.config.cookieName),
        refreshToken: readAuthCookie(request, this.config.refreshCookieName),
      });
      clearAuthCookies(response, this.config);
    } catch (error: unknown) {
      throw new InternalServerErrorException("Lo sentimos. No pudimos cerrar su sesión, intente nuevamente.");
    }
  }

  @Get("me")
  @UseGuards(AuthenticationGuard)
  me(@Req() request: AuthenticatedRequest): NonNullable<AuthenticatedRequest["authUser"]> {
    if (!request.authUser) throw new UnauthorizedException("Debe iniciar sesión para acceder.");
    return request.authUser;
  }

  @Post("register")
  async register(@Body() input: unknown): Promise<PublicUser> {
    try {
      return await this.registerUser.execute(input);
    } catch (error: unknown) {
      if (error instanceof InvalidRegistrationInputError) {
        throw new BadRequestException(error.message, { cause: error });
      }
      if (error instanceof EmailAlreadyRegisteredError) {
        throw new ConflictException(error.message);
      }
      throw new InternalServerErrorException("Lo sentimos. No pudimos crear su cuenta, intente nuevamente.");
    }
  }
}
