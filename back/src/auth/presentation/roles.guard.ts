import { ForbiddenException, Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../../users/domain/user.js";
import { ALLOWED_ROLES } from "./roles.decorator.js";
import type { AuthenticatedRequest } from "./authentication.guard.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().authUser;
    if (!user) throw new UnauthorizedException("Debe iniciar sesión para acceder.");
    const allowed = this.reflector.getAllAndOverride<UserRole[]>(ALLOWED_ROLES, [context.getHandler(), context.getClass()]);
    if (allowed && !allowed.includes(user.role)) {
      throw new ForbiddenException("No tiene permiso para realizar esta operación.");
    }
    return true;
  }
}
