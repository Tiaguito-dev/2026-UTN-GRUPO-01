import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import type { PublicUser } from "../users/domain/user.js";
import { RegisterUser } from "./application/register-user.js";
import { Login } from "./application/login.js";
import { RefreshSession } from "./application/refresh-session.js";
import { Logout } from "./application/logout.js";
import { AUTH_CONFIG, type AuthConfig } from "./auth.config.js";
import { AuthenticationGuard, type AuthenticatedRequest } from "./presentation/authentication.guard.js";
import { clearAuthCookies, readAuthCookie, setAuthCookies } from "./presentation/auth-cookies.js";
import { RequestPasswordReset } from "./application/request-password-reset.js";
import { ResetPassword } from "./application/reset-password.js";
import { ChangePassword } from "./application/change-password.js";
import { InvalidRefreshCredentialError } from "./domain/refresh-errors.js";

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
    await this.requestPasswordReset.execute(input);
    return { message: "Si existe una cuenta asociada al email, recibirás instrucciones para recuperar tu contraseña." };
  }

  @Post("reset-password")
  @HttpCode(204)
  async reset(@Body() input: unknown, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.resetPassword.execute(input);
    clearAuthCookies(response, this.config);
  }

  @Post("change-password")
  @HttpCode(204)
  @UseGuards(AuthenticationGuard)
  async change(@Req() request: AuthenticatedRequest, @Body() input: unknown, @Res({ passthrough: true }) response: Response): Promise<void> {
    if (!request.authUser) throw new UnauthorizedException("Debe iniciar sesión para acceder.");
    await this.changePassword.execute(request.authUser.id, input);
    clearAuthCookies(response, this.config);
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() input: unknown, @Res({ passthrough: true }) response: Response): Promise<PublicUser> {
    const result = await this.loginUser.execute(input);
    setAuthCookies(response, this.config, result);
    return result.user;
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<PublicUser> {
    try {
      const result = await this.refreshSession.execute(readAuthCookie(request, this.config.refreshCookieName));
      setAuthCookies(response, this.config, result);
      return result.user;
    } catch (error: unknown) {
      if (error instanceof InvalidRefreshCredentialError) clearAuthCookies(response, this.config);
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.logoutSession.execute({
      accessToken: readAuthCookie(request, this.config.cookieName),
      refreshToken: readAuthCookie(request, this.config.refreshCookieName),
    });
    clearAuthCookies(response, this.config);
  }

  @Get("me")
  @UseGuards(AuthenticationGuard)
  me(@Req() request: AuthenticatedRequest): NonNullable<AuthenticatedRequest["authUser"]> {
    if (!request.authUser) throw new UnauthorizedException("Debe iniciar sesión para acceder.");
    return request.authUser;
  }

  @Post("register")
  async register(@Body() input: unknown): Promise<PublicUser> {
    return this.registerUser.execute(input);
  }
}
