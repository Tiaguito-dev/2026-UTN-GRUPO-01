import { Body, Controller, Get, Header, Param, Post, Query, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthenticationGuard, type AuthenticatedRequest } from "../auth/presentation/authentication.guard.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { Roles } from "../auth/presentation/roles.decorator.js";
import { FeedbackReporteService } from "./application/feedback-reporte.service.js";

@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
export class FeedbackReportesController {
  constructor(private readonly reportes: FeedbackReporteService) {}

  @Post("feedback/:id/reportes")
  @Header("Cache-Control", "no-store")
  async create(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    if (!request.authUser) throw new UnauthorizedException();
    const result = await this.reportes.create(id, request.authUser.id, body);
    response.status(result.created ? 201 : 200);
    return result.reporte;
  }

  @Get("admin/feedback-reportes")
  @Roles("ADMIN")
  @Header("Cache-Control", "no-store")
  list(@Query() query: unknown) { return this.reportes.list(query); }

  @Get("admin/feedback-reportes/:id")
  @Roles("ADMIN")
  @Header("Cache-Control", "no-store")
  get(@Param("id") id: string, @Query() query: unknown) { return this.reportes.get(id, query); }

  @Post("admin/feedback-reportes/:id/resolucion")
  @Roles("ADMIN")
  @Header("Cache-Control", "no-store")
  async resolve(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    if (!request.authUser) throw new UnauthorizedException();
    const result = await this.reportes.resolve(id, { id: request.authUser.id, role: request.authUser.role }, body);
    response.status(200);
    return result;
  }
}
