import { Body, Controller, Get, Header, Put, Req, UseGuards } from "@nestjs/common";
import { AuthenticationGuard, type AuthenticatedRequest } from "../auth/presentation/authentication.guard.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { Roles } from "../auth/presentation/roles.decorator.js";
import { ConsultarNormas } from "./application/consultar-normas.js";
import { ActualizarNormas } from "./application/actualizar-normas.js";

@Controller("comunidad")
@UseGuards(AuthenticationGuard, RolesGuard)
export class ComunidadController {
  constructor(private readonly consultarNormas: ConsultarNormas, private readonly actualizarNormas: ActualizarNormas) {}

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
}
