import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
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
import { ListarCursadasPorMateria } from "./application/listar-cursadas-por-materia.js";
import { ListarComisionesPorCursada } from "./application/listar-comisiones-por-cursada.js";
import { ObtenerCursada, type CursadaDetalle } from "./application/obtener-cursada.js";
import { ObtenerComision } from "./application/obtener-comision.js";
import { CrearMateria } from "./application/crear-materia.js";
import { CrearProfesor } from "./application/crear-profesor.js";
import { CrearCursada } from "./application/crear-cursada.js";
import { CrearComision } from "./application/crear-comision.js";
import { AsignarProfesorComision } from "./application/asignar-profesor-comision.js";
import { QuitarProfesorComision } from "./application/quitar-profesor-comision.js";
import type { Materia } from "./domain/materia.js";
import type { Profesor } from "./domain/profesor.js";
import type { Cursada, CursadaResumen } from "./domain/cursada.js";
import type { Comision, ComisionDetalle, ProfesorAsignado } from "./domain/comision.js";

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
    private readonly obtenerCursada: ObtenerCursada,
    private readonly asignarProfesorComision: AsignarProfesorComision,
    private readonly quitarProfesorComision: QuitarProfesorComision,
    private readonly obtenerComision: ObtenerComision,
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
  @Roles("ADMIN")
  historial(@Param("materiaId") materiaId: string, @Query() query: unknown) {
    return this.listarHistorialMateria.execute(materiaId, query);
  }

  @Patch("materias/:materiaId")
  @Roles("ADMIN")
  editarMateria(@Param("materiaId") materiaId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.actualizarMateria.execute(materiaId, body, request.authUser?.id);
  }

  @Get("materias/:materiaId/cursadas")
  cursadas(@Param("materiaId") materiaId: string, @Query() query: unknown): Promise<PaginatedResult<CursadaResumen>> {
    return this.listarCursadasPorMateria.execute(materiaId, query);
  }

  @Get("cursadas/:cursadaId")
  cursada(@Param("cursadaId") cursadaId: string): Promise<CursadaDetalle> {
    return this.obtenerCursada.execute(cursadaId);
  }

  @Get("cursadas/:cursadaId/comisiones")
  comisiones(@Param("cursadaId") cursadaId: string, @Query() query: unknown): Promise<PaginatedResult<Comision>> {
    return this.listarComisionesPorCursada.execute(cursadaId, query);
  }

  @Get("comisiones/:comisionId")
  comision(@Param("comisionId") comisionId: string): Promise<ComisionDetalle> {
    return this.obtenerComision.execute(comisionId);
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

  @Put("comisiones/:comisionId/profesores/:profesorId")
  @Roles("ADMIN")
  asignarProfesor(@Param("comisionId") comisionId: string, @Param("profesorId") profesorId: string, @Body() body: unknown): Promise<ProfesorAsignado> {
    return this.asignarProfesorComision.execute(comisionId, profesorId, body);
  }

  @Delete("comisiones/:comisionId/profesores/:profesorId")
  @Roles("ADMIN")
  @HttpCode(204)
  quitarProfesor(@Param("comisionId") comisionId: string, @Param("profesorId") profesorId: string): Promise<void> {
    return this.quitarProfesorComision.execute(comisionId, profesorId);
  }
}
