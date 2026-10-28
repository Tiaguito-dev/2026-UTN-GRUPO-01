import { Controller, Delete, Get, HttpCode, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticationGuard, type AuthenticatedRequest } from "../auth/presentation/authentication.guard.js";
import { Roles } from "../auth/presentation/roles.decorator.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { EliminarAcademico } from "./application/eliminar-academico.js";
import { ListarHistorialAcademico } from "./application/listar-historial-academico.js";

@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class AcademicAdministrationController {
  constructor(private readonly eliminar: EliminarAcademico, private readonly historial: ListarHistorialAcademico) {}

  @Delete("materias/:id")
  @HttpCode(204)
  eliminarMateria(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.eliminar.execute("materia", id, request.authUser?.id);
  }

  @Delete("profesores/:id")
  @HttpCode(204)
  eliminarProfesor(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.eliminar.execute("profesor", id, request.authUser?.id);
  }

  @Delete("cursadas/:id")
  @HttpCode(204)
  eliminarCursada(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.eliminar.execute("cursada", id, request.authUser?.id);
  }

  @Delete("comisiones/:id")
  @HttpCode(204)
  eliminarComision(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.eliminar.execute("comision", id, request.authUser?.id);
  }

  @Get("profesores/:id/historial")
  historialProfesor(@Param("id") id: string, @Query() query: unknown) { return this.historial.execute("profesor", id, query); }

  @Get("cursadas/:id/historial")
  historialCursada(@Param("id") id: string, @Query() query: unknown) { return this.historial.execute("cursada", id, query); }

  @Get("comisiones/:id/historial")
  historialComision(@Param("id") id: string, @Query() query: unknown) { return this.historial.execute("comision", id, query); }
}
