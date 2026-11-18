import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/presentation/authentication.guard.js";
import { ConsultarNormas } from "./application/consultar-normas.js";

@Controller("comunidad")
@UseGuards(AuthenticationGuard)
export class ComunidadController {
  constructor(private readonly consultarNormas: ConsultarNormas) {}

  @Get("normas")
  @Header("Cache-Control", "no-store")
  normas() {
    return this.consultarNormas.execute();
  }
}
