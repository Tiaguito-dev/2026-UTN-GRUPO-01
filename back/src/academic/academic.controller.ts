import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/presentation/authentication.guard.js";
import { ActualizarMateria } from "./application/actualizar-materia.js";
import { ObtenerMateria } from "./application/obtener-materia.js";
import { ListarHistorialMateria } from "./application/listar-historial-materia.js";
import { AuthenticationGuard } from "../auth/presentation/authentication.guard.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { Roles } from "../auth/presentation/roles.decorator.js";
import type { PaginatedResult } from "../shared/domain/pagination.js";
import { ListarMaterias } from "./application/listar-materias.js";
import { ListarProfesores } from "./application/listar-profesores.js";
import { ListarCursadasPorMateria, type CursadaConProfesor } from "./application/listar-cursadas-por-materia.js";
import { ListarComisionesPorCursada } from "./application/listar-comisiones-por-cursada.js";
import { CrearMateria } from "./application/crear-materia.js";
import { CrearProfesor } from "./application/crear-profesor.js";
import { CrearCursada } from "./application/crear-cursada.js";
import { CrearComision } from "./application/crear-comision.js";
import type { Materia } from "./domain/materia.js";
import type { Profesor } from "./domain/profesor.js";
import type { Cursada } from "./domain/cursada.js";
import type { Comision } from "./domain/comision.js";

// Las lecturas exigen sesión; las altas exigen además rol ADMIN vía @Roles + RolesGuard.
// Sin @Roles, RolesGuard solo confirma que haya usuario autenticado.
@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
export class AcademicController {
  constructor(
    private readonly listarMaterias: ListarMaterias,
    private readonly listarProfesores: ListarProfesores,
    private readonly listarCursadasPorMateria: ListarCursadasPorMateria,
    private readonly listarComisionesPorCursada: ListarComisionesPorCursada,
    private readonly crearMateria: CrearMateria,
    private readonly crearProfesor: CrearProfesor,
    private readonly crearCursada: CrearCursada,
    private readonly crearComision: CrearComision,
    private readonly obtenerMateria: ObtenerMateria,
    private readonly actualizarMateria: ActualizarMateria,
    private readonly listarHistorialMateria: ListarHistorialMateria,
  ) {}

  @Get("materias")
  materias(@Query() query: unknown): Promise<PaginatedResult<Materia>> {
    return this.listarMaterias.execute(query);
  }

  @Get("materias/:materiaId")
  materia(@Param("materiaId") materiaId: string): Promise<Materia> {
    return this.obtenerMateria.execute(materiaId);
  }

  @Get("materias/:materiaId/historial")
  historial(@Param("materiaId") materiaId: string, @Query() query: unknown) {
    return this.listarHistorialMateria.execute(materiaId, query);
  }

  @Patch("materias/:materiaId")
  @Roles("ADMIN")
  editarMateria(@Param("materiaId") materiaId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.actualizarMateria.execute(materiaId, body, request.authUser?.id);
  }

  @Get("materias/:materiaId/cursadas")
  cursadas(@Param("materiaId") materiaId: string, @Query() query: unknown): Promise<PaginatedResult<CursadaConProfesor>> {
    return this.listarCursadasPorMateria.execute(materiaId, query);
  }

  @Get("cursadas/:cursadaId/comisiones")
  comisiones(@Param("cursadaId") cursadaId: string, @Query() query: unknown): Promise<PaginatedResult<Comision>> {
    return this.listarComisionesPorCursada.execute(cursadaId, query);
  }

  @Get("profesores")
  @Roles("ADMIN")
  profesores(@Query() query: unknown): Promise<PaginatedResult<Profesor>> {
    return this.listarProfesores.execute(query);
  }

  @Post("materias")
  @Roles("ADMIN")
  nuevaMateria(@Body() body: unknown): Promise<Materia> {
    return this.crearMateria.execute(body);
  }

  @Post("profesores")
  @Roles("ADMIN")
  nuevoProfesor(@Body() body: unknown): Promise<Profesor> {
    return this.crearProfesor.execute(body);
  }

  @Post("cursadas")
  @Roles("ADMIN")
  nuevaCursada(@Body() body: unknown): Promise<Cursada> {
    return this.crearCursada.execute(body);
  }

  @Post("comisiones")
  @Roles("ADMIN")
  nuevaComision(@Body() body: unknown): Promise<Comision> {
    return this.crearComision.execute(body);
  }
}
