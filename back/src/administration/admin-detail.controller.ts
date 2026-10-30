import { Controller, Get, Header, Param, Query, UseGuards } from "@nestjs/common";
import { AuthenticationGuard } from "../auth/presentation/authentication.guard.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { Roles } from "../auth/presentation/roles.decorator.js";
import { AdminDetailService } from "./admin-detail.service.js";

@Controller("admin")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class AdminDetailController {
  constructor(private readonly detail: AdminDetailService) {}
  @Get(":kind/:id/detalle")
  @Header("Cache-Control", "no-store")
  get(@Param("kind") kind: string, @Param("id") id: string, @Query() query: unknown) {
    return this.detail.execute(kind, id, query);
  }
}
