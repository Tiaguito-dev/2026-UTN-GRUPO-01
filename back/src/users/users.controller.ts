import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/presentation/authentication.guard.js";
import { AuthenticationGuard } from "../auth/presentation/authentication.guard.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { Roles } from "../auth/presentation/roles.decorator.js";
import type { PaginatedResult } from "../shared/domain/pagination.js";
import { ListarUsuarios } from "./application/listar-usuarios.js";
import type { UsuarioAdministrativo } from "./domain/user-administration.repository.js";
import { CambiarEstadoUsuario } from "./application/cambiar-estado-usuario.js";
import { ListarHistorialUsuario } from "./application/listar-historial-usuario.js";

@Controller("users")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly listarUsuarios: ListarUsuarios, private readonly cambiarEstado: CambiarEstadoUsuario, private readonly listarHistorial: ListarHistorialUsuario) {}

  @Get()
  usuarios(@Query() query: unknown): Promise<PaginatedResult<UsuarioAdministrativo>> {
    return this.listarUsuarios.execute(query);
  }

  @Patch(":id/estado")
  estado(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.cambiarEstado.execute(id, body, request.authUser?.id);
  }

  @Get(":id/historial")
  historial(@Param("id") id: string, @Query() query: unknown) { return this.listarHistorial.execute(id, query); }
}
