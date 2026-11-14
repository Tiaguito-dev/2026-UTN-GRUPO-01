import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication, ExecutionContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthenticationGuard, type AuthenticatedRequest } from "../src/auth/presentation/authentication.guard.js";
import { RolesGuard } from "../src/auth/presentation/roles.guard.js";
import { FeedbackService } from "../src/reviews/application/feedback.service.js";
import { FeedbackFeedService } from "../src/reviews/application/feedback-feed.service.js";
import { FeedbackLikeService } from "../src/reviews/application/feedback-like.service.js";
import { FeedbackRespuestaService } from "../src/reviews/application/feedback-respuesta.service.js";
import { validateFeedbackFeedQuery } from "../src/reviews/application/feedback-feed-input.js";
import { FeedbackInputError } from "../src/reviews/application/errors.js";
import { PrismaFeedbackFeedRepository } from "../src/reviews/infrastructure/prisma-feedback-feed.repository.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { ReviewsController } from "../src/reviews/reviews.controller.js";
import { SharedModule } from "../src/shared/shared.module.js";

const viewer = randomUUID();
const point = (id: string = randomUUID(), createdAt = "2026-11-12T12:00:00.000Z") => ({ id, createdAt });
const upper = point();
const after = point(randomUUID(), "2026-11-11T12:00:00.000Z");
const cursor = (overrides: Record<string, unknown> = {}) => Buffer.from(JSON.stringify({ v: 1, pageSize: 2, upper, after, ...overrides })).toString("base64url");

describe("Feed: entrada estricta", () => {
  it("usa nueve por defecto y admite límites válidos", () => {
    expect(validateFeedbackFeedQuery({})).toEqual({ pageSize: 9 });
    expect(validateFeedbackFeedQuery({ pageSize: "1" })).toEqual({ pageSize: 1 });
    expect(validateFeedbackFeedQuery({ pageSize: "9" })).toEqual({ pageSize: 9 });
  });
  it.each(["0", "10", "1.5", "-1", "", " 2", "2e0", true, null, ["2"], {}])("rechaza pageSize %j", (pageSize) => {
    expect(() => validateFeedbackFeedQuery({ pageSize })).toThrow(FeedbackInputError);
  });
  it("decodifica cursor validado y normaliza UUID", () => {
    expect(validateFeedbackFeedQuery({ pageSize: "2", cursor: cursor() })).toEqual({ pageSize: 2, cursor: { v: 1, pageSize: 2, upper, after } });
  });
  it.each(["", "!", "a".repeat(1025), "e30=", Buffer.from("no JSON").toString("base64url")])("rechaza cursor malformado %j", (value) => {
    expect(() => validateFeedbackFeedQuery({ cursor: value })).toThrow(FeedbackInputError);
  });
  it.each([
    { v: 2 }, { extra: true }, { pageSize: 3 }, { after: { ...after, id: "no-uuid" } },
    { upper: { ...upper, createdAt: "2026-02-30T00:00:00.000Z" } },
    { after: { ...after, createdAt: "2026-11-13T00:00:00.000Z" } },
    { after: { ...after, createdAt: "2026-11-11T12:00:00Z" } },
    { upper: { ...upper, extra: true } }, { after: null },
  ])("rechaza estructura o límites de cursor %j", (changes) => {
    expect(() => validateFeedbackFeedQuery({ pageSize: "2", cursor: cursor(changes) })).toThrow(FeedbackInputError);
  });
  it("rechaza UUID posterior al límite superior en un empate", () => {
    const same = "2026-11-12T12:00:00.000Z";
    expect(() => validateFeedbackFeedQuery({ pageSize: 2, cursor: cursor({
      upper: point("00000000-0000-4000-8000-000000000001", same),
      after: point("00000000-0000-4000-8000-000000000002", same),
    }) })).toThrow(FeedbackInputError);
  });
  it("rechaza filtros ajenos al feed y parámetros repetidos", () => {
    expect(() => validateFeedbackFeedQuery({ page: 1 })).toThrow(FeedbackInputError);
    expect(() => validateFeedbackFeedQuery({ cursor: [cursor()] })).toThrow(FeedbackInputError);
  });
});

function row(id: string, anonimo = true, puntuacion: number | null = 4) {
  return {
    id, autorId: viewer, autor: { displayName: "Identidad privada" }, anonimo, texto: "Comentario", puntuacion,
    comision: { carrera: "S" }, comisionId: randomUUID(), comisionNombre: "S-31", materiaId: randomUUID(),
    materiaNombre: "Materia", cursadaId: randomUUID(), anio: 2026, cuatrimestre: null, modalidad: "ANUAL",
    profesorId: null, profesorNombre: null, profesorCargo: null,
    createdAt: new Date(upper.createdAt), updatedAt: new Date(upper.createdAt), deletedAt: null,
  };
}

describe("Feed: consulta por clave y proyección pública", () => {
  function setup(rows: ReturnType<typeof row>[]) {
    const findMany = vi.fn().mockResolvedValue(rows);
    const aggregate = vi.fn().mockResolvedValue([]);
    const tx = { feedback: { findMany }, $queryRaw: aggregate };
    const transaction = vi.fn().mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const repository = new PrismaFeedbackFeedRepository({ ...tx, $transaction: transaction } as unknown as PrismaService);
    return { findMany, aggregate, transaction, service: new FeedbackFeedService(repository) };
  }
  it("consulta una vez pageSize + 1 y genera el cursor desde la última fila entregada", async () => {
    const rows = [row("00000000-0000-4000-8000-000000000003"), row("00000000-0000-4000-8000-000000000002"), row("00000000-0000-4000-8000-000000000001")];
    const { service, findMany } = setup(rows);
    const result = await service.list(viewer, { pageSize: 2 });
    expect(findMany).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ where: { deletedAt: null }, take: 3, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(result.items.map(item => item.id)).toEqual(rows.slice(0, 2).map(item => item.id));
    expect(result.hasMore).toBe(true);
    expect(validateFeedbackFeedQuery({ pageSize: 2, cursor: result.nextCursor }).cursor).toEqual({ v: 1, pageSize: 2, upper: point(rows[0]!.id), after: point(rows[1]!.id) });
    expect(result.items[0]).toMatchObject({ puntuacion: 4, autor: null, propio: true, contexto: { materiaNombre: "Materia" } });
    expect(JSON.stringify(result)).not.toMatch(/Identidad privada|autorId|email|password/);
  });
  it("aplica límites por valores sin buscar ni requerir la existencia del ancla", async () => {
    const { service, findMany } = setup([]);
    const result = await service.list(viewer, { pageSize: 2, cursor: cursor() });
    expect(result).toEqual({ items: [], hasMore: false, nextCursor: null });
    const query = findMany.mock.calls[0]![0];
    expect(query.where).toEqual({ deletedAt: null, AND: [
      { OR: [{ createdAt: { lt: new Date(upper.createdAt) } }, { createdAt: new Date(upper.createdAt), id: { lte: upper.id } }] },
      { OR: [{ createdAt: { lt: new Date(after.createdAt) } }, { createdAt: new Date(after.createdAt), id: { lt: after.id } }] },
    ] });
    expect(query).not.toHaveProperty("cursor");
    expect(query).not.toHaveProperty("skip");
  });
  it("no inventa puntuaciones históricas y termina sin cursor con una página completa", async () => {
    const historic = { ...row(randomUUID(), false), puntuacion: null };
    const { service } = setup([historic]);
    const result = await service.list(randomUUID(), { pageSize: 1 });
    expect(result).toMatchObject({ hasMore: false, nextCursor: null, items: [{ puntuacion: null, autor: { displayName: "Identidad privada" }, propio: false }] });
  });
  it("no consulta ante entrada inválida y propaga errores de persistencia", async () => {
    const { service, findMany } = setup([]);
    expect(() => service.list(viewer, { pageSize: 10 })).toThrow(FeedbackInputError);
    expect(findMany).not.toHaveBeenCalled();
    findMany.mockRejectedValueOnce(new Error("consulta fallida"));
    await expect(service.list(viewer, {})).rejects.toThrow("consulta fallida");
  });
  it("agrega likes por lote solo para la página, en el mismo snapshot", async () => {
    const rows = [row(randomUUID()), row(randomUUID()), row(randomUUID())];
    const { service, aggregate, transaction } = setup(rows);
    aggregate.mockResolvedValue([{ feedbackId: rows[0]!.id, cantidadLikes: 2n, meGusta: true }]);
    const result = await service.list(viewer, { pageSize: 2 });
    expect(result.items[0]).toMatchObject({ cantidadLikes: 2, meGusta: true });
    expect(result.items[1]).toMatchObject({ cantidadLikes: 0, meGusta: false });
    expect(aggregate).toHaveBeenCalledOnce();
    expect(aggregate.mock.calls[0]![0].values).toEqual(expect.arrayContaining([viewer, rows[0]!.id, rows[1]!.id]));
    expect(aggregate.mock.calls[0]![0].values).not.toContain(rows[2]!.id);
    expect(aggregate.mock.calls[0]![0].sql).toContain('"deletedAt" IS NULL');
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });
  it("no consulta likes en páginas vacías ni oculta errores de agregación", async () => {
    const empty = setup([]);
    await empty.service.list(viewer, {});
    expect(empty.aggregate).not.toHaveBeenCalled();
    const f = setup([row(randomUUID())]);
    f.aggregate.mockRejectedValueOnce(new Error("agregación fallida"));
    await expect(f.service.list(viewer, {})).rejects.toThrow("agregación fallida");
  });
});

describe("Feed: enrutamiento HTTP real sin PostgreSQL", () => {
  let app: INestApplication;
  let url: string;
  const old = { listGeneral: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 9, total: 0 }), get: vi.fn().mockResolvedValue({ id: viewer }), history: vi.fn().mockResolvedValue({ items: [] }) };
  const feed = new FeedbackFeedService({ list: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }) });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [SharedModule], controllers: [ReviewsController], providers: [
      { provide: FeedbackService, useValue: old }, { provide: FeedbackFeedService, useValue: feed },
      { provide: FeedbackLikeService, useValue: {} },
      { provide: FeedbackRespuestaService, useValue: {} },
    ] }).overrideGuard(AuthenticationGuard).useValue({ canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      if (request.headers.cookie) request.authUser = { id: viewer, role: "USER", email: "test@example.test", displayName: "Test" };
      return true;
    } }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  it("mantiene RolesGuard y rechaza solicitudes sin sesión", async () => {
    expect(Reflect.getMetadata("__guards__", ReviewsController)).toContain(RolesGuard);
    expect((await fetch(`${url}/feedback/feed`)).status).toBe(401);
  });
  it("despacha /feedback/feed antes de /feedback/:id y devuelve no-store", async () => {
    const response = await fetch(`${url}/feedback/feed`, { headers: { Cookie: "test=1" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ items: [], hasMore: false, nextCursor: null });
    expect(old.get).not.toHaveBeenCalled();
  });
  it("devuelve 400 HTTP para query inválida", async () => {
    expect((await fetch(`${url}/feedback/feed?pageSize=10`, { headers: { Cookie: "test=1" } })).status).toBe(400);
  });
  it("conserva listado anterior y rutas dinámicas de detalle e historial", async () => {
    const headers = { Cookie: "test=1" };
    const response = await fetch(`${url}/feedback?page=1&pageSize=9`, { headers });
    expect(await response.json()).toEqual({ items: [], page: 1, pageSize: 9, total: 0 });
    expect((await fetch(`${url}/feedback/${viewer}`, { headers })).status).toBe(200);
    expect(old.get).toHaveBeenCalledWith(viewer, viewer);
    expect((await fetch(`${url}/feedback/${viewer}/historial`, { headers })).status).toBe(200);
    expect(old.history).toHaveBeenCalledWith(viewer, viewer, {});
  });
});
