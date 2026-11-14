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

  describe("Block 5: reading and managing replies", () => {
    const replyPath = (id: string) => `/feedback/respuestas/${id}`;
    it("paginates visible replies deterministically without private identity", async () => {
      const f = await fixture();
      const first = await create(f.path); const second = await create(f.path, { ...body(), anonimo: false });
      const time = new Date("2026-11-01T00:00:00Z");
      await prisma.feedbackRespuesta.updateMany({ where: { feedbackId: f.id }, data: { createdAt: time } });
      const sorted = [first.id, second.id].sort().reverse();
      for (const [index, expected] of sorted.entries()) {
        const response = await request(f.path + `?page=${index + 1}&pageSize=1`, "GET", undefined, author.cookie);
        expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
        const page = await response.json();
        expect(page).toMatchObject({ total: 2, page: index + 1, pageSize: 1, items: [{ id: expected, propio: false }] });
        expect(page.items).toHaveLength(1);
        expect(JSON.stringify(page)).not.toMatch(/autorId|solicitudId|email|password|token/);
        expect(page.items[0].autor).toEqual(page.items[0].anonimo ? null : { displayName: "Persona de prueba" });
      }
      expect((await (await request(f.path + "?page=3&pageSize=1", "GET")).json()).items).toEqual([]);
      expect((await request(f.path, "GET", undefined, "")).status).toBe(401);
      for (const query of ["page=0", "pageSize=101", "page=1.5"]) expect((await request(f.path + "?" + query, "GET")).status).toBe(400);
      expect((await request("/feedback/invalid/respuestas", "GET")).status).toBe(400);
      expect((await request(`/feedback/${randomUUID()}/respuestas`, "GET")).status).toBe(404);
    });
    it("only the author edits and removes, without changing stars or initial retry snapshot", async () => {
      const f = await fixture(); const input = body(); const reply = await create(f.path, input);
      const rating = await prisma.valoracionMateria.findMany({ where: { materiaId: f.materiaId } });
      const path = replyPath(reply.id);
      expect((await request(path, "PATCH", { texto: "Changed" }, "")).status).toBe(401);
      expect((await request(path, "DELETE", undefined, "")).status).toBe(401);
      expect((await request(path, "PATCH", { texto: "Changed" }, author.cookie)).status).toBe(403);
      expect((await request(path, "DELETE", undefined, author.cookie)).status).toBe(403);
      await prisma.user.update({ where: { id: author.id }, data: { role: "ADMIN" } });
      expect((await request(path, "PATCH", { texto: "Changed" }, author.cookie)).status).toBe(403);
      expect((await request(path, "DELETE", undefined, author.cookie)).status).toBe(403);
      await prisma.user.update({ where: { id: author.id }, data: { role: "USER" } });
      for (const data of [{ texto: " " }, { puntuacion: 4 }, { versionNormas: "1" }, { solicitudId: randomUUID() }, { anonimo: null }]) expect((await request(path, "PATCH", data)).status).toBe(400);
      expect((await fetch(url + path, { method: "PATCH", headers: { Cookie: reader.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ texto: "No CSRF" }) })).status).toBe(403);
      const edited = await request(path, "PATCH", { texto: "  Changed  ", anonimo: false });
      expect(edited.status).toBe(200); expect(edited.headers.get("cache-control")).toBe("no-store");
      expect(await edited.json()).toMatchObject({ id: reply.id, texto: "Changed", anonimo: false, propio: true });
      expect(await create(f.path, input, 200)).toMatchObject({ texto: "Changed", anonimo: false });
      expect((await request(path, "PATCH", {})).status).toBe(200);
      const history = await prisma.feedbackRespuestaHistorial.findMany({ where: { respuestaId: reply.id }, orderBy: { createdAt: "asc" } });
      expect(history.map(h => h.accion)).toEqual(["CREACION", "EDICION"]);
      const audit = await prisma.administracionHistorial.findUniqueOrThrow({ where: { id: history[1]!.id } });
      expect(audit).toMatchObject({ entidad: "respuesta", actorId: reader.id, accion: "EDICION", cambios: expect.arrayContaining([{ campo: "texto", anterior: input.texto, nuevo: "Changed" }]) });
      await prisma.comision.update({ where: { id: f.comisionId }, data: { activa: false } });
      expect((await request(path, "PATCH", { texto: "Blocked" })).status).toBe(409);
      expect((await request(f.path, "GET")).status).toBe(200);
      for (let n = 0; n < 2; n++) { const deleted = await request(path, "DELETE"); expect(deleted.status).toBe(204); expect(deleted.headers.get("cache-control")).toBe("no-store"); }
      expect((await request(path, "PATCH", { texto: "Blocked" })).status).toBe(404);
      expect((await request(f.path, "POST", input)).status).toBe(409);
      expect((await (await request(f.path, "GET")).json()).total).toBe(0);
      expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: reply.id } })).toBe(3);
      const removed = await prisma.feedbackRespuestaHistorial.findFirstOrThrow({ where: { respuestaId: reply.id, accion: "ELIMINACION" } });
      expect(removed).toMatchObject({ texto: "Changed", anonimo: false });
      expect(await prisma.administracionHistorial.findUnique({ where: { id: removed.id } })).toMatchObject({ accion: "ELIMINACION", cambios: expect.arrayContaining([expect.objectContaining({ campo: "deletedAt", anterior: null })]) });
      expect(await prisma.valoracionMateria.findMany({ where: { materiaId: f.materiaId } })).toEqual(rating);
    });
    it("counts visible replies per feed page and hides everything after parent deletion", async () => {
      const f = await fixture(); const reply = await create(f.path);
      const count = async () => (await (await request("/feedback/feed", "GET")).json()).items.find((item: { id: string }) => item.id === f.id)?.cantidadRespuestas;
      expect(await count()).toBe(1);
      await request(replyPath(reply.id), "DELETE"); expect(await count()).toBe(0);
      const remaining = await create(f.path);
      expect((await request(`/feedback/${f.id}`, "DELETE", undefined, author.cookie)).status).toBe(204);
      expect((await request(f.path, "GET")).status).toBe(404);
      expect((await request(replyPath(remaining.id), "PATCH", { texto: "Hidden" })).status).toBe(404);
      expect((await request(replyPath(remaining.id), "DELETE")).status).toBe(404);
      expect((await request(`/feedback/${remaining.id}`, "GET")).status).toBe(404);
      expect((await request(`/feedback/${remaining.id}/historial`, "GET")).status).toBe(404);
    });
    it("serializes two edits and repeated concurrent deletes with one snapshot per real change", async () => {
      const f = await fixture(); const reply = await create(f.path); const path = replyPath(reply.id);
      const results = await Promise.all([request(path, "PATCH", { texto: "First" }), request(path, "PATCH", { texto: "Second" })]);
      expect(results.map(r => r.status)).toEqual([200, 200]);
      const row = await prisma.feedbackRespuesta.findUniqueOrThrow({ where: { id: reply.id } });
      const history = await prisma.feedbackRespuestaHistorial.findMany({ where: { respuestaId: reply.id, accion: "EDICION" }, orderBy: { createdAt: "asc" } });
      expect(history).toHaveLength(2); expect(history.map(h => h.texto).sort()).toEqual(["First", "Second"]);
      const events = await prisma.administracionHistorial.findMany({ where: { entidadId: reply.id, accion: "EDICION" }, orderBy: { createdAt: "asc" } });
      const changes = events.map(e => (e.cambios as { campo: string; anterior: string; nuevo: string }[]).find(c => c.campo === "texto")!);
      const initial = changes.find(change => change.anterior === reply.texto)!;
      const final = changes.find(change => change.anterior === initial.nuevo)!;
      expect(final.nuevo).toBe(row.texto);
      expect((await Promise.all([request(path, "DELETE"), request(path, "DELETE")])).map(r => r.status)).toEqual([204, 204]);
      expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: reply.id, accion: "ELIMINACION" } })).toBe(1);
    });
    it.each(["PATCH", "DELETE"])("revalidates hidden parent after real lock contention: %s", async method => {
      const f = await fixture(); const reply = await create(f.path);
      let reached!: () => void; let release!: () => void;
      const entered = new Promise<void>(resolve => { reached = resolve; }); const released = new Promise<void>(resolve => { release = resolve; });
      const deletion = prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Comision" WHERE "id"=${f.comisionId}::uuid FOR UPDATE`;
        await tx.feedback.update({ where: { id: f.id }, data: { deletedAt: new Date() } }); reached(); await released;
      });
      let pending: Promise<Response> | undefined;
      try { await Promise.race([entered, deletion.then(() => { throw new Error("Barrier not reached"); })]); pending = request(replyPath(reply.id), method, method === "PATCH" ? { texto: "Hidden" } : undefined); await waitForCommissionLock(); } finally { release(); }
      await deletion; expect((await pending)?.status).toBe(404);
      expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: reply.id } })).toBe(1);
    });

    it.each(["PATCH", "DELETE"])("commits a reply change before a waiting parent deletion: %s", async method => {
      const f = await fixture(); const reply = await create(f.path);
      let reached!: () => void; let release!: () => void;
      const entered = new Promise<void>(resolve => { reached = resolve; }); const released = new Promise<void>(resolve => { release = resolve; });
      const extended = prisma.$extends({ query: { feedbackRespuesta: { async update({ args, query }) {
        const result = await query(args); reached(); await released; return result;
      } } } });
      const repo = new PrismaFeedbackRespuestaRepository(extended as unknown as PrismaService);
      const mutation = method === "PATCH" ? repo.update(reply.id, reader.id, { texto: "Before parent deletion" }) : repo.remove(reply.id, reader.id);
      let removal: Promise<Response> | undefined;
      try {
        await Promise.race([entered, mutation.then(() => { throw new Error("Barrier not reached"); })]);
        removal = request(`/feedback/${f.id}`, "DELETE", undefined, author.cookie); await waitForCommissionLock();
      } finally { release(); }
      await mutation; expect((await removal)?.status).toBe(204);
      expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: reply.id } })).toBe(2);
      expect((await request(f.path, "GET")).status).toBe(404);
    });

    it.each([["PATCH", "audit"], ["DELETE", "audit"], ["PATCH", "snapshot"], ["DELETE", "snapshot"]])("rolls back response and snapshot on %s failure at %s", async (method, step) => {
      const f = await fixture(); const reply = await create(f.path);
      const before = await prisma.feedbackRespuesta.findUniqueOrThrow({ where: { id: reply.id } });
      const originalSnapshot = await prisma.feedbackRespuestaHistorial.findFirstOrThrow({ where: { respuestaId: reply.id } });
      const failing = step === "audit" ? prisma.$extends({ query: { administracionHistorial: { async create() { throw new Error("controlled audit failure"); } } } }) : prisma.$extends({ query: { feedbackRespuesta: { async update({ args, query }) {
        if (args.data.historial?.create && !Array.isArray(args.data.historial.create)) args.data.historial.create.id = originalSnapshot.id;
        return query(args);
      } } } });
      const repo = new PrismaFeedbackRespuestaRepository(failing as unknown as PrismaService);
      await expect(method === "PATCH" ? repo.update(reply.id, reader.id, { texto: "Rollback" }) : repo.remove(reply.id, reader.id)).rejects.toThrow();
      expect(await prisma.feedbackRespuesta.findUniqueOrThrow({ where: { id: reply.id } })).toEqual(before);
      expect(await prisma.feedbackRespuestaHistorial.count({ where: { respuestaId: reply.id } })).toBe(1);
      expect(await prisma.administracionHistorial.count({ where: { entidadId: reply.id } })).toBe(1);
    });
  });

});
