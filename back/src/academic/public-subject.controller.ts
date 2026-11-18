import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ExplorarMaterias } from "./application/explorar-materias.js";

@Controller("materias/explorar")
export class PublicSubjectController {
  constructor(private readonly explore: ExplorarMaterias) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query() query: unknown) {
    return this.explore.list(query);
  }

  @Get(":id/experiencias")
  @Header("Cache-Control", "no-store")
  recentExperiences(@Param("id") id: string) {
    return this.explore.recentExperiences(id);
  }
}
