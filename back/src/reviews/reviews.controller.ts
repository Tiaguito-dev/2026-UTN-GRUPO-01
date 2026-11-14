import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthenticationGuard, type AuthenticatedRequest } from "../auth/presentation/authentication.guard.js";
import { RolesGuard } from "../auth/presentation/roles.guard.js";
import { FeedbackService } from "./application/feedback.service.js";
import { FeedbackFeedService } from "./application/feedback-feed.service.js";
import { FeedbackLikeService } from "./application/feedback-like.service.js";
import { FeedbackRespuestaService } from "./application/feedback-respuesta.service.js";

function user(request: AuthenticatedRequest): string {
  if (!request.authUser) throw new UnauthorizedException();
  return request.authUser.id;
}

@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly feedback: FeedbackService, private readonly feed: FeedbackFeedService, private readonly likes: FeedbackLikeService, private readonly respuestas: FeedbackRespuestaService) {}

  @Get("feedback/:id/respuestas")
  @Header("Cache-Control", "no-store")
  listRespuestas(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.respuestas.list(id, user(request), query);
  }

  @Patch("feedback/respuestas/:id")
  @Header("Cache-Control", "no-store")
  updateRespuesta(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.respuestas.update(id, user(request), body);
  }

  @Delete("feedback/respuestas/:id")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  removeRespuesta(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.respuestas.remove(id, user(request));
  }

  @Post("feedback/:id/respuestas")
  @Header("Cache-Control", "no-store")
  async createRespuesta(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await this.respuestas.create(id, user(request), body);
    response.status(result.created ? 201 : 200);
    return result.respuesta;
  }

  @Put("feedback/:id/like")
  @Header("Cache-Control", "no-store")
  like(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.likes.put(id, user(request));
  }

  @Delete("feedback/:id/like")
  @Header("Cache-Control", "no-store")
  unlike(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.likes.remove(id, user(request));
  }

  @Get("feedback/feed")
  @Header("Cache-Control", "no-store")
  listFeed(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.feed.list(user(request), query);
  }

  @Get("feedback")
  @Header("Cache-Control", "no-store")
  listGeneral(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.feedback.listGeneral(user(request), query);
  }

  @Get("comisiones/:id/feedback")
  @Header("Cache-Control", "no-store")
  list(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.feedback.listComision(id, user(request), query);
  }

  @Get("comisiones/:id/feedback/propio")
  @Header("Cache-Control", "no-store")
  async propio(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Res() response: Response) {
    // Nest otherwise serializes null as an empty body; the client contract requires JSON null.
    response.setHeader("Cache-Control", "no-store");
    response.json(await this.feedback.propio(id, user(request)));
  }

  @Post("comisiones/:id/feedback")
  @Header("Cache-Control", "no-store")
  create(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.feedback.create(id, user(request), body);
  }

  @Get("feedback/:id")
  @Header("Cache-Control", "no-store")
  get(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.feedback.get(id, user(request)); }

  @Patch("feedback/:id")
  @Header("Cache-Control", "no-store")
  update(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.feedback.update(id, user(request), body);
  }

  @Delete("feedback/:id")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.feedback.remove(id, user(request), request.authUser?.role); }

  @Get("feedback/:id/historial")
  @Header("Cache-Control", "no-store")
  history(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.feedback.history(id, user(request), query);
  }

}
