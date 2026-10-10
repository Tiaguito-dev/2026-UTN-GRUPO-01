import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/presentation/authentication.guard.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { Roles } from "../auth/presentation/roles.decorator.js";
import type { PaginatedResult } from "../shared/domain/pagination.js";
import { ListarUsuarios } from "./application/listar-usuarios.js";
import type { PublicUser } from "./domain/user.js";

@Controller("users")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly listarUsuarios: ListarUsuarios) {}

  @Get()
  usuarios(@Query() query: unknown): Promise<PaginatedResult<PublicUser>> {
    return this.listarUsuarios.execute(query);
  }
}
