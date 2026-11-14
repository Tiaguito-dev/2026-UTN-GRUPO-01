import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { VERIFICATION_EMAIL } from "../src/auth/domain/email-verification.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { PrismaFeedbackRespuestaRepository } from "../src/reviews/infrastructure/prisma-feedback-respuesta.repository.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
type Reply = { id: string; feedbackId: string; texto: string; anonimo: boolean; autor: { displayName: string } | null; propio: boolean };
const body = () => ({ solicitudId: randomUUID(), texto: "Respuesta original", anonimo: true });
describe.skipIf(!databaseUrl)("Respuestas: creación HTTP/PostgreSQL aislado", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let url: string;
  let author: { id: string; cookie: string };
  let reader: { id: string; cookie: string };
  const ids = { users: [] as string[], materias: [] as string[], cursadas: [] as string[], comisiones: [] as string[], feedback: [] as string[] };
  const config = testAuthConfig();
  const request = (path: string, method = "POST", input?: unknown, cookie = reader.cookie) => fetch(`${url}${path}`, {
    method, headers: { ...(method === "GET" ? {} : csrfHeaders), ...(cookie ? { Cookie: cookie } : {}) },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  async function account() {
    const email = `reply-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const password = "isolated response integration password";
    const registered = await request("/auth/register", "POST", { email, password, displayName: "Persona de prueba" }, "");
    expect(registered.status).toBe(201);
    const { id } = await registered.json() as { id: string };
    ids.users.push(id);
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
    const login = await request("/auth/login", "POST", { email, password }, "");
    expect(login.status).toBe(200);
    return { id, cookie: login.headers.get("set-cookie")!.split(";")[0]! };
  }
  async function fixture(anonimo = true) {
    const materia = await prisma.materia.create({ data: { nombre: `Respuestas ${randomUUID()}`, carreras: { create: { carrera: "S", anioCarrera: "1" } } } });
    ids.materias.push(materia.id);
    const cursada = await prisma.cursada.create({ data: { materiaId: materia.id, anio: 2026, cuatrimestre: "ANUAL" } });
    ids.cursadas.push(cursada.id);
    const comision = await prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero: 31 } });
    ids.comisiones.push(comision.id);
    const response = await request(`/comisiones/${comision.id}/feedback`, "POST", { texto: "Comentario padre", puntuacion: 4, anonimo }, author.cookie);
    expect(response.status).toBe(201);
    const { id } = await response.json() as { id: string };
    ids.feedback.push(id);
    return { id, materiaId: materia.id, cursadaId: cursada.id, comisionId: comision.id, path: `/feedback/${id}/respuestas` };
  }
  async function create(path: string, input = body(), status = 201, cookie = reader.cookie): Promise<Reply> {
    const response = await request(path, "POST", input, cookie);
    expect(response.status, await response.clone().text()).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    return await response.json() as Reply;
  }
  async function waitForCommissionLock() {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<{ waiting: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
          AND pid<>pg_backend_pid() AND wait_event_type='Lock'
          AND query LIKE '%Comision%' AND query LIKE '%FOR UPDATE%') AS waiting`;
      if (rows[0]!.waiting) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error("No se observó contención real sobre comisión");
  }
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    await prisma.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1"); url = await app.getUrl();
    author = await account(); reader = await account();
  }, 30_000);
  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.feedbackRespuestaHistorial.deleteMany({ where: { respuesta: { feedbackId: { in: ids.feedback } } } });
        await prisma.feedbackRespuesta.deleteMany({ where: { feedbackId: { in: ids.feedback } } });
        await prisma.feedbackHistorial.deleteMany({ where: { feedbackId: { in: ids.feedback } } });
        await prisma.feedback.deleteMany({ where: { id: { in: ids.feedback } } });
        await prisma.valoracionMateria.deleteMany({ where: { materiaId: { in: ids.materias } } });
        await prisma.comision.deleteMany({ where: { id: { in: ids.comisiones } } });
        await prisma.cursada.deleteMany({ where: { id: { in: ids.cursadas } } });
        await prisma.materiaCarrera.deleteMany({ where: { materiaId: { in: ids.materias } } });
        await prisma.materia.deleteMany({ where: { id: { in: ids.materias } } });
        await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: ids.users } } } });
        await prisma.session.deleteMany({ where: { userId: { in: ids.users } } });
        await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: ids.users } } });
        await prisma.administracionHistorial.deleteMany({ where: { actorId: { in: ids.users } } });
        await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      }
    } finally { if (app) await app.close(); if (prisma) await prisma.$disconnect(); }
  });
  it("exige sesión, CSRF y cuerpo estricto sin identidad del cliente", async () => {
    const f = await fixture();
    expect((await request(f.path, "POST", body(), "")).status).toBe(401);
    expect((await fetch(`${url}${f.path}`, { method: "POST", headers: { Cookie: reader.cookie, "Content-Type": "application/json" }, body: JSON.stringify(body()) })).status).toBe(403);
    for (const input of [{ ...body(), autorId: author.id }, { ...body(), texto: " " }, { ...body(), solicitudId: null }, { ...body(), anonimo: 1 }]) {
      expect((await request(f.path, "POST", input)).status).toBe(400);
    }
    expect((await request("/feedback/invalid/respuestas", "POST", body())).status).toBe(400);
  });
  it.each([[true, false], [false, true]])("anonimato independiente: padre %s, respuesta %s", async (parentAnonymous, replyAnonymous) => {
    const f = await fixture(parentAnonymous);
    const rating = await prisma.valoracionMateria.findUniqueOrThrow({ where: { usuarioId_materiaId: { usuarioId: author.id, materiaId: f.materiaId } } });
    const input = { ...body(), anonimo: replyAnonymous };
    const reply = await create(f.path, input);
    expect(reply).toMatchObject({ feedbackId: f.id, texto: input.texto, anonimo: replyAnonymous, propio: true, autor: replyAnonymous ? null : { displayName: "Persona de prueba" } });
    expect(Object.keys(reply).sort()).toEqual(["anonimo", "autor", "createdAt", "feedbackId", "id", "propio", "texto", "updatedAt"]);
    expect(JSON.stringify(reply)).not.toMatch(/autorId|solicitudId|email|password|token/);
    const history = await prisma.feedbackRespuestaHistorial.findMany({ where: { respuestaId: reply.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ texto: input.texto, anonimo: replyAnonymous, accion: "CREACION" });
    expect(await prisma.administracionHistorial.findUnique({ where: { id: history[0]!.id } })).toMatchObject({ entidad: "respuesta", entidadId: reply.id, actorId: reader.id, accion: "CREACION" });
    expect(await prisma.valoracionMateria.findUniqueOrThrow({ where: { usuarioId_materiaId: { usuarioId: author.id, materiaId: f.materiaId } } })).toEqual(rating);
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.id } })).toBe(1);
  });
  it("reintento idéntico devuelve 200 sin cambios ni nuevos eventos", async () => {
    const f = await fixture(); const input = body();
    const first = await create(f.path, input);
    expect(await create(f.path, input, 200)).toEqual(first);
    expect(await prisma.feedbackRespuesta.count({ where: { feedbackId: f.id } })).toBe(1);
    expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: first.id } })).toBe(1);
    expect(await prisma.administracionHistorial.count({ where: { entidad: "respuesta", entidadId: first.id } })).toBe(1);
  });
  it("rechaza reutilización de clave con otro contenido o padre", async () => {
    const f = await fixture(); const other = await fixture(); const input = body();
    await create(f.path, input);
    for (const changed of [{ ...input, texto: "Distinta" }, { ...input, anonimo: false }]) expect((await request(f.path, "POST", changed)).status).toBe(409);
    expect((await request(other.path, "POST", input)).status).toBe(409);
  });
  it("compara el original y devuelve el recurso actual sin deshacer ediciones", async () => {
    const f = await fixture(); const input = body(); const first = await create(f.path, input);
    await prisma.feedbackRespuesta.update({ where: { id: first.id }, data: { texto: "Texto editado", anonimo: false, updatedAt: new Date() } });
    expect(await create(f.path, input, 200)).toMatchObject({ id: first.id, texto: "Texto editado", anonimo: false });
    expect((await request(f.path, "POST", { ...input, texto: "Texto editado", anonimo: false })).status).toBe(409);
    expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: first.id } })).toBe(1);
  });
  it("no reactiva respuestas eliminadas ni permite respuestas a respuestas", async () => {
    const f = await fixture(); const input = body(); const first = await create(f.path, input);
    expect((await request(`/feedback/${first.id}/respuestas`, "POST", body())).status).toBe(404);
    const deletedAt = new Date();
    await prisma.feedbackRespuesta.update({ where: { id: first.id }, data: { deletedAt } });
    expect((await request(f.path, "POST", input)).status).toBe(409);
    expect((await prisma.feedbackRespuesta.findUniqueOrThrow({ where: { id: first.id } })).deletedAt).toEqual(deletedAt);
  });
  it("padre inexistente o eliminado devuelve 404 incluso ante reintento", async () => {
    expect((await request(`/feedback/${randomUUID()}/respuestas`, "POST", body())).status).toBe(404);
    const f = await fixture(); const input = body(); await create(f.path, input);
    expect((await request(`/feedback/${f.id}`, "DELETE", undefined, author.cookie)).status).toBe(204);
    expect((await request(f.path, "POST", input)).status).toBe(404);
  });
  it("comisión inactiva devuelve 409", async () => {
    const f = await fixture();
    await prisma.comision.update({ where: { id: f.comisionId }, data: { activa: false } });
    expect((await request(f.path, "POST", body())).status).toBe(409);
  });
  it.each(["comision", "cursada", "materia"] as const)("rechaza contexto dado de baja: %s", async entity => {
    const f = await fixture();
    if (entity === "comision") await prisma.comision.update({ where: { id: f.comisionId }, data: { deletedAt: new Date() } });
    if (entity === "cursada") await prisma.cursada.update({ where: { id: f.cursadaId }, data: { deletedAt: new Date() } });
    if (entity === "materia") await prisma.materia.update({ where: { id: f.materiaId }, data: { deletedAt: new Date() } });
    expect((await request(f.path, "POST", body())).status).toBe(404);
  });
  it("dos solicitudes idénticas concurrentes producen una respuesta y un evento", async () => {
    const f = await fixture(); const input = body();
    const responses = await Promise.all([request(f.path, "POST", input), request(f.path, "POST", input)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
    const replies = await Promise.all(responses.map(response => response.json()));
    expect(replies[0]).toEqual(replies[1]);
    expect(await prisma.feedbackRespuesta.count({ where: { feedbackId: f.id } })).toBe(1);
    expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: replies[0].id } })).toBe(1);
    expect(await prisma.administracionHistorial.count({ where: { entidad: "respuesta", entidadId: replies[0].id } })).toBe(1);
  });
  it("dos solicitudes concurrentes con igual clave y distinto contenido devuelven 201 y 409", async () => {
    const f = await fixture(); const input = body();
    const responses = await Promise.all([request(f.path, "POST", input), request(f.path, "POST", { ...input, texto: "Otro contenido" })]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const reply = await prisma.feedbackRespuesta.findUniqueOrThrow({ where: { autorId_solicitudId: { autorId: reader.id, solicitudId: input.solicitudId } } });
    expect(await prisma.feedbackRespuesta.count({ where: { feedbackId: f.id } })).toBe(1);
    expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: reply.id } })).toBe(1);
    expect(await prisma.administracionHistorial.count({ where: { entidad: "respuesta", entidadId: reply.id } })).toBe(1);
  });
  it("la solicitud pertenece al autor: otro autor puede usar el mismo UUID", async () => {
    const f = await fixture(); const input = body();
    const first = await create(f.path, input);
    const second = await create(f.path, input, 201, author.cookie);
    expect(second.id).not.toBe(first.id);
  });
  it("resuelve colisión real P2002 entre comisiones fuera de la transacción abortada", async () => {
    const f = await fixture(); const other = await fixture(); const input = body();
    let arrivals = 0; let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const synchronized = prisma.$extends({ query: { feedbackRespuesta: { async create({ args, query }) {
      if (++arrivals === 2) release();
      await gate;
      return query(args);
    } } } });
    const repository = new PrismaFeedbackRespuestaRepository(synchronized as unknown as PrismaService);
    const results = await Promise.allSettled([repository.create(f.id, reader.id, input), repository.create(other.id, reader.id, input)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ httpStatus: 409 });
    expect(await prisma.feedbackRespuesta.count({ where: { autorId: reader.id, solicitudId: input.solicitudId } })).toBe(1);
  });
  it("creación y eliminación del padre se serializan sin pérdida de historial", async () => {
    const f = await fixture(); const input = body();
    let reached!: () => void; let release!: () => void;
    const entered = new Promise<void>(resolve => { reached = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    const paused = prisma.$extends({ query: { administracionHistorial: { async create({ args, query }) {
      const event = await query(args); reached(); await released; return event;
    } } } });
    const pending = new PrismaFeedbackRespuestaRepository(paused as unknown as PrismaService).create(f.id, reader.id, input);
    let removal: Promise<Response> | undefined;
    try {
      await Promise.race([entered, pending.then(() => { throw new Error("No se alcanzó barrera"); })]);
      removal = request(`/feedback/${f.id}`, "DELETE", undefined, author.cookie);
      await waitForCommissionLock();
    } finally { release(); }
    const [created, removed] = await Promise.all([pending, removal]);
    expect(created.created).toBe(true); expect(removed?.status).toBe(204);
    expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: created.respuesta.id } })).toBe(1);
    expect((await request(f.path, "POST", input)).status).toBe(404);
  });
  it("revalida comisión después de una desactivación concurrente", async () => {
    const f = await fixture();
    let reached!: () => void; let release!: () => void;
    const entered = new Promise<void>(resolve => { reached = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    const deactivation = prisma.$transaction(async tx => {
      await tx.comision.update({ where: { id: f.comisionId }, data: { activa: false } });
      reached(); await released;
    });
    let pending: Promise<Response> | undefined;
    try {
      await Promise.race([entered, deactivation.then(() => { throw new Error("No se alcanzó barrera"); })]);
      pending = request(f.path, "POST", body());
      await waitForCommissionLock();
    } finally { release(); }
    await deactivation;
    expect((await pending)?.status).toBe(409);
    expect(await prisma.feedbackRespuesta.count({ where: { feedbackId: f.id } })).toBe(0);
  });
  it("revierte respuesta e historial si falla auditoría", async () => {
    const f = await fixture();
    const auditCount = await prisma.administracionHistorial.count({ where: { entidad: "respuesta", actorId: reader.id } });
    const failing = prisma.$extends({ query: { administracionHistorial: { async create() { throw new Error("auditoría fallida"); } } } });
    const repository = new PrismaFeedbackRespuestaRepository(failing as unknown as PrismaService);
    await expect(repository.create(f.id, reader.id, body())).rejects.toThrow("auditoría fallida");
    expect(await prisma.feedbackRespuesta.count({ where: { feedbackId: f.id } })).toBe(0);
    expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuesta: { feedbackId: f.id } } })).toBe(0);
    expect(await prisma.administracionHistorial.count({ where: { entidad: "respuesta", actorId: reader.id } })).toBe(auditCount);
  });
});
