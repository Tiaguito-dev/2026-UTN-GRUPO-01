import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AdministrarSugerencias } from "./application/administrar-sugerencias.js";
import { AuthenticationGuard, type AuthenticatedRequest } from "../auth/presentation/authentication.guard.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { Roles } from "../auth/presentation/roles.decorator.js";
import { ConsultarNormas } from "./application/consultar-normas.js";
import { ActualizarNormas } from "./application/actualizar-normas.js";
import { RegistrarSugerencia } from "./application/registrar-sugerencia.js";

@Controller("comunidad")
@UseGuards(AuthenticationGuard, RolesGuard)
export class ComunidadController {
  constructor(private readonly consultarNormas: ConsultarNormas, private readonly actualizarNormas: ActualizarNormas,
    private readonly registrarSugerencia: RegistrarSugerencia,
    private readonly administrarSugerencias: AdministrarSugerencias) {}

  @Get("sugerencias")
  @Roles("ADMIN")
  @Header("Cache-Control", "no-store")
  listarSugerencias(@Query() query: unknown) { return this.administrarSugerencias.listar(query); }

  @Put("sugerencias/:id/me-gusta")
  @Roles("ADMIN")
  @Header("Cache-Control", "no-store")
  cambiarMeGusta(@Param("id") id: string, @Body() body: unknown) {
    return this.administrarSugerencias.cambiarMeGusta(id, body);
  }

  @Delete("sugerencias/:id")
  @Roles("ADMIN")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  eliminarSugerencia(@Param("id") id: string) { return this.administrarSugerencias.eliminar(id); }

  @Get("normas")
  @Header("Cache-Control", "no-store")
  normas() {
    return this.consultarNormas.execute();
  }

  @Put("normas")
  @Roles("ADMIN")
  @Header("Cache-Control", "no-store")
  actualizar(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.actualizarNormas.execute(body, request.authUser?.id);
  }

  @Post("sugerencias")
  @Roles("USER")
  @Header("Cache-Control", "no-store")
  sugerencia(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.registrarSugerencia.execute(body, request.authUser?.id);
  }
}
