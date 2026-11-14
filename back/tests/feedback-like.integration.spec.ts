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
import { PrismaFeedbackLikeRepository } from "../src/reviews/infrastructure/prisma-feedback-like.repository.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
describe.skipIf(!databaseUrl)("Likes: HTTP y PostgreSQL aislado", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let url: string;
  let author: { id: string; cookie: string };
  let reader: { id: string; cookie: string };
  let other: { id: string; cookie: string };
  const ids = { users: [] as string[], materias: [] as string[], cursadas: [] as string[], comisiones: [] as string[], feedback: [] as string[] };
  const config = testAuthConfig();
  const request = (path: string, method = "GET", cookie = reader.cookie, body?: unknown) => fetch(`${url}${path}`, {
    method, headers: { ...(method === "GET" ? {} : csrfHeaders), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function account() {
    const email = `likes-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const password = "isolated likes test password";
    const registered = await request("/auth/register", "POST", "", { email, password, displayName: "Persona privada" });
    expect(registered.status).toBe(201);
    const { id } = await registered.json() as { id: string };
    ids.users.push(id);
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
    const logged = await request("/auth/login", "POST", "", { email, password });
    expect(logged.status).toBe(200);
    return { id, cookie: logged.headers.get("set-cookie")!.split(";")[0]! };
  }
  async function fixture(anonimo = true) {
    const materia = await prisma.materia.create({ data: { nombre: `Likes ${randomUUID()}`, carreras: { create: { carrera: "S", anioCarrera: "1" } } } });
    ids.materias.push(materia.id);
    const cursada = await prisma.cursada.create({ data: { materiaId: materia.id, anio: 2026, cuatrimestre: "ANUAL" } });
    ids.cursadas.push(cursada.id);
    const comision = await prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero: 31 } });
    ids.comisiones.push(comision.id);
    const normas = await request("/feedback/normas", "GET", author.cookie);
    expect(normas.status).toBe(200);
    const { version } = await normas.json() as { version: string };
    expect(version).toEqual(expect.any(String));
    const response = await request(`/comisiones/${comision.id}/feedback`, "POST", author.cookie, { texto: "Comentario con estrellas", anonimo, puntuacion: 4, versionNormas: version });
    expect(response.status).toBe(201);
    const feedback = await response.json() as { id: string };
    ids.feedback.push(feedback.id);
    return { id: feedback.id, comisionId: comision.id, materiaId: materia.id, path: `/feedback/${feedback.id}/like` };
  }
  async function state(path: string, method: "PUT" | "DELETE", expected: { meGusta: boolean; cantidadLikes: number }, cookie = reader.cookie) {
    const response = await request(path, method, cookie);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(expected);
  }
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    await prisma.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
    author = await account(); reader = await account(); other = await account();
  }, 30_000);
  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.feedbackLike.deleteMany({ where: { feedbackId: { in: ids.feedback } } });
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
        await prisma.aceptacionNormas.deleteMany({ where: { usuarioId: { in: ids.users } } });
        await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      }
    } finally { if (app) await app.close(); if (prisma) await prisma.$disconnect(); }
  });
  it("exige sesión, CSRF y UUID válido", async () => {
    const f = await fixture();
    for (const method of ["PUT", "DELETE"]) expect((await request(f.path, method, "")).status).toBe(401);
    expect((await fetch(`${url}${f.path}`, { method: "PUT", headers: { Cookie: reader.cookie } })).status).toBe(403);
    expect((await request("/feedback/invalid/like", "PUT")).status).toBe(400);
  });
  it("crea, repite, elimina y reactiva sin duplicados ni escrituras ficticias", async () => {
    const f = await fixture();
    const where = { usuarioId_feedbackId: { usuarioId: reader.id, feedbackId: f.id } };
    await state(f.path, "PUT", { meGusta: true, cantidadLikes: 1 });
    const first = await prisma.feedbackLike.findUniqueOrThrow({ where });
    const audits = await prisma.administracionHistorial.count({ where: { entidad: "feedbackLike", entidadId: f.id } });
    await state(f.path, "PUT", { meGusta: true, cantidadLikes: 1 });
    expect(await prisma.feedbackLike.findUniqueOrThrow({ where })).toEqual(first);
    expect(await prisma.administracionHistorial.count({ where: { entidad: "feedbackLike", entidadId: f.id } })).toBe(audits);
    await state(f.path, "DELETE", { meGusta: false, cantidadLikes: 0 });
    const deleted = await prisma.feedbackLike.findUniqueOrThrow({ where });
    await state(f.path, "DELETE", { meGusta: false, cantidadLikes: 0 });
    expect(await prisma.feedbackLike.findUniqueOrThrow({ where })).toEqual(deleted);
    await state(f.path, "PUT", { meGusta: true, cantidadLikes: 1 });
    expect(await prisma.feedbackLike.findUniqueOrThrow({ where })).toMatchObject({ createdAt: first.createdAt, deletedAt: null });
    expect(await prisma.feedbackLike.count({ where: { feedbackId: f.id } })).toBe(1);
    const empty = await fixture();
    await state(empty.path, "DELETE", { meGusta: false, cantidadLikes: 0 });
    expect(await prisma.feedbackLike.count({ where: { feedbackId: empty.id } })).toBe(0);
  });
  it.each([false, true])("impide autolike con anonimato %s", async anonimo => {
    const f = await fixture(anonimo);
    expect((await request(f.path, "PUT", author.cookie)).status).toBe(403);
    expect(await prisma.feedbackLike.count({ where: { feedbackId: f.id } })).toBe(0);
  });
  it("rechaza comentarios inexistentes y eliminados; oculta sus likes en el feed", async () => {
    const f = await fixture();
    await state(f.path, "PUT", { meGusta: true, cantidadLikes: 1 });
    expect((await request(`/feedback/${f.id}`, "DELETE", author.cookie)).status).toBe(204);
    for (const method of ["PUT", "DELETE"]) {
      expect((await request(f.path, method)).status).toBe(404);
      expect((await request(`/feedback/${randomUUID()}/like`, method)).status).toBe(404);
    }
    const feed = await (await request("/feedback/feed")).json();
    expect(feed.items.some((item: { id: string }) => item.id === f.id)).toBe(false);
    expect(await prisma.feedbackLike.count({ where: { feedbackId: f.id } })).toBe(1);
  });
  it("calcula cantidad y meGusta por usuario sin exponer identidades ni cambiar contratos o estrellas", async () => {
    const f = await fixture();
    const rating = await prisma.valoracionMateria.findUniqueOrThrow({ where: { usuarioId_materiaId: { usuarioId: author.id, materiaId: f.materiaId } } });
    await state(f.path, "PUT", { meGusta: true, cantidadLikes: 1 });
    await state(f.path, "PUT", { meGusta: true, cantidadLikes: 2 }, other.cookie);
    for (const [cookie, meGusta] of [[reader.cookie, true], [author.cookie, false]] as const) {
      const feed = await (await request("/feedback/feed", "GET", cookie)).json();
      expect(feed.items.find((item: { id: string }) => item.id === f.id)).toMatchObject({ cantidadLikes: 2, meGusta, puntuacion: 4, autor: null });
      for (const user of ids.users) expect(JSON.stringify(feed)).not.toContain(user);
      expect(JSON.stringify(feed)).not.toMatch(/usuarioId|autorId|email|password/i);
    }
    const old = await (await request("/feedback")).json();
    expect(old.items.find((item: { id: string }) => item.id === f.id)).not.toHaveProperty("cantidadLikes");
    expect(old.items.find((item: { id: string }) => item.id === f.id)).not.toHaveProperty("meGusta");
    expect(await prisma.valoracionMateria.findUniqueOrThrow({ where: { usuarioId_materiaId: { usuarioId: author.id, materiaId: f.materiaId } } })).toEqual(rating);
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.id } })).toBe(1);
  });
  it("serializa dos PUT simultáneos y tolera DELETE concurrentes", async () => {
    const f = await fixture();
    await Promise.all([state(f.path, "PUT", { meGusta: true, cantidadLikes: 1 }), state(f.path, "PUT", { meGusta: true, cantidadLikes: 1 })]);
    expect(await prisma.feedbackLike.count({ where: { feedbackId: f.id } })).toBe(1);
    expect(await prisma.administracionHistorial.count({ where: { entidad: "feedbackLike", entidadId: f.id } })).toBe(1);
    await Promise.all([state(f.path, "DELETE", { meGusta: false, cantidadLikes: 0 }), state(f.path, "DELETE", { meGusta: false, cantidadLikes: 0 })]);
  });
  it("coordina PUT con la eliminación real del padre sin deadlock", async () => {
    const f = await fixture();
    let reached!: () => void;
    let release!: () => void;
    const reachedCount = new Promise<void>(resolve => { reached = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    const paused = prisma.$extends({ query: { feedbackLike: { async count({ args, query }) {
      const count = await query(args);
      reached();
      await released;
      return count;
    } } } });
    const like = new PrismaFeedbackLikeRepository(paused as unknown as PrismaService).put(f.id, reader.id);
    let removal: Promise<Response> | undefined;
    try {
      await Promise.race([reachedCount, like.then(() => { throw new Error("No se alcanzó la barrera de concurrencia"); })]);
      removal = request(`/feedback/${f.id}`, "DELETE", author.cookie);
      // Prove actual lock contention instead of relying on scheduling Promise.all alone.
      let blocked = false;
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline && !blocked) {
        const rows = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
            AND pid<>pg_backend_pid() AND wait_event_type='Lock'
            AND query LIKE '%Comision%' AND query LIKE '%FOR UPDATE%') AS waiting`;
        blocked = rows[0]!.waiting;
        if (!blocked) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
    } finally {
      release();
      const [liked, removed] = await Promise.all([like, removal]);
      expect(liked).toEqual({ meGusta: true, cantidadLikes: 1 });
      expect(removed?.status).toBe(204);
    }
    expect((await request(f.path, "PUT")).status).toBe(404);
    expect(await prisma.feedbackLike.count({ where: { feedbackId: f.id } })).toBe(1);
  });
  it("hace rollback de like y auditoría cuando falla el conteo", async () => {
    const f = await fixture();
    const failing = prisma.$extends({ query: { feedbackLike: { async count() { throw new Error("conteo fallido"); } } } });
    const repository = new PrismaFeedbackLikeRepository(failing as unknown as PrismaService);
    await expect(repository.put(f.id, reader.id)).rejects.toThrow("conteo fallido");
    expect(await prisma.feedbackLike.count({ where: { feedbackId: f.id } })).toBe(0);
    expect(await prisma.administracionHistorial.count({ where: { entidad: "feedbackLike", entidadId: f.id } })).toBe(0);
  });
  it("permite reaccionar a comentarios visibles de comisiones inactivas", async () => {
    const f = await fixture();
    await prisma.comision.update({ where: { id: f.comisionId }, data: { activa: false } });
    await state(f.path, "PUT", { meGusta: true, cantidadLikes: 1 });
  });
});
