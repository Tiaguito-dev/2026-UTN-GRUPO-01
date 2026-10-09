import { Inject, Injectable, InternalServerErrorException, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { parseCookie } from "cookie";
import type { Request } from "express";
import { AuthenticateRequest } from "../application/authenticate-request.js";
import { AUTH_CONFIG, type AuthConfig } from "../auth.config.js";
import { InvalidAccessTokenError, UnauthenticatedError } from "../domain/auth-errors.js";
import type { UserRole } from "../../users/domain/user.js";
import { hasAllowedAuthTransport } from "./http-security.js";

export interface AuthenticatedRequest extends Request {
  authUser?: { id: string; email: string; displayName: string; role: UserRole };
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(AuthenticateRequest) private readonly authenticate: AuthenticateRequest,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!hasAllowedAuthTransport(request, this.config)) throw new UnauthorizedException("La credencial requiere una conexión segura.");
    const raw = request.headers.cookie;
    if (!raw) throw new UnauthorizedException("Debe iniciar sesión para acceder.");
    const matching = raw.split(";").filter((entry) => entry.slice(0, entry.indexOf("=")).trim() === this.config.cookieName);
    if (matching.length !== 1) throw new UnauthorizedException("La credencial de acceso es inválida.");
    const token = parseCookie(raw)[this.config.cookieName];
    if (!token) throw new UnauthorizedException("La credencial de acceso es inválida.");
    try {
      const user = await this.authenticate.execute(token);
      request.authUser = { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthenticatedError || error instanceof InvalidAccessTokenError) {
        throw new UnauthorizedException("La credencial de acceso es inválida o venció. Inicie sesión nuevamente.");
      }
      throw new InternalServerErrorException("Lo sentimos. No pudimos validar su acceso, intente nuevamente.");
    }
  }
}
