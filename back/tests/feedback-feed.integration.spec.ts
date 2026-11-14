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
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
type Page = { items: { id: string; puntuacion: number | null; autor: { displayName: string } | null; propio: boolean; contexto: { materiaId: string }; cantidadLikes: number; meGusta: boolean; cantidadRespuestas: number }[]; nextCursor: string | null; hasMore: boolean };

describe.skipIf(!databaseUrl)("Feed por cursor: HTTP y PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let url: string;
  let cookie: string;
  let authorId: string;
  let initial: Page;
  const ids = { users: [] as string[], materias: [] as string[], cursadas: [] as string[], comisiones: [] as string[], feedback: [] as string[] };
  const config = testAuthConfig();
  const request = (path: string, authenticated = true) => fetch(`${url}${path}`, { headers: authenticated ? { Cookie: cookie } : {} });
  async function read(path: string): Promise<Page> {
    const response = await request(path);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    return await response.json() as Page;
  }
  async function comment(createdAt: Date, anonimo = true, puntuacion: number | null = 4) {
    const materia = await prisma.materia.create({ data: { nombre: `Feed ${randomUUID()}`, carreras: { create: { carrera: "S", anioCarrera: "1" } } } });
    ids.materias.push(materia.id);
    const cursada = await prisma.cursada.create({ data: { materiaId: materia.id, anio: 2026, cuatrimestre: "ANUAL" } });
    ids.cursadas.push(cursada.id);
    const comision = await prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero: 31 } });
    ids.comisiones.push(comision.id);
    const row = await prisma.feedback.create({ data: {
      autorId: authorId, comisionId: comision.id, texto: "Snapshot público", anonimo, puntuacion, createdAt,
      materiaId: materia.id, materiaNombre: materia.nombre, comisionNombre: "S-31", cursadaId: cursada.id,
      anio: 2026, modalidad: "ANUAL", cuatrimestre: null,
    } });
    ids.feedback.push(row.id);
    return row;
  }
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    await prisma.$connect();
    // The test starts with an empty isolated Feedback table; it never deletes others' data.
    expect(await prisma.feedback.count()).toBe(0);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
    const email = `feed-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const password = "feed isolated integration password";
    const registered = await fetch(`${url}/auth/register`, { method: "POST", headers: csrfHeaders, body: JSON.stringify({ email, password, displayName: "Autor confidencial del feed" }) });
    expect(registered.status).toBe(201);
    authorId = (await registered.json() as { id: string }).id;
    ids.users.push(authorId);
    await prisma.user.update({ where: { id: authorId }, data: { emailVerifiedAt: new Date() } });
    const login = await fetch(`${url}/auth/login`, { method: "POST", headers: csrfHeaders, body: JSON.stringify({ email, password }) });
    expect(login.status).toBe(200);
    cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  }, 30_000);
  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.feedback.deleteMany({ where: { id: { in: ids.feedback } } });
        await prisma.comision.deleteMany({ where: { id: { in: ids.comisiones } } });
        await prisma.cursada.deleteMany({ where: { id: { in: ids.cursadas } } });
        await prisma.materiaCarrera.deleteMany({ where: { materiaId: { in: ids.materias } } });
        await prisma.materia.deleteMany({ where: { id: { in: ids.materias } } });
        await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: ids.users } } } });
        await prisma.session.deleteMany({ where: { userId: { in: ids.users } } });
        await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: ids.users } } });
        await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      }
    } finally {
      if (app) await app.close();
      if (prisma) await prisma.$disconnect();
    }
  });
  it("protege la ruta estática con sesión real y comienza vacío", async () => {
    expect((await request("/feedback/feed", false)).status).toBe(401);
    expect(await read("/feedback/feed")).toEqual({ items: [], nextCursor: null, hasMore: false });
  });
  it("rechaza parámetros inválidos mediante HTTP", async () => {
    for (const query of ["pageSize=0", "pageSize=10", "pageSize=1.5", "cursor=no-valido", "page=1", "pageSize=2&pageSize=3"]) {
      expect((await request(`/feedback/feed?${query}`)).status).toBe(400);
    }
  });
  it("ordena empates por UUID y preserva privacidad, contexto y puntuación propia", async () => {
    for (let i = 0; i < 5; i++) await comment(new Date("2026-01-01T00:00:00.000Z"));
    const removed = await comment(new Date("2026-02-01T00:00:00.000Z"));
    await prisma.feedback.update({ where: { id: removed.id }, data: { deletedAt: new Date() } });
    initial = await read("/feedback/feed?pageSize=2");
    const sorted = ids.feedback.slice(0, 5).sort().reverse();
    expect(initial.items.map(item => item.id)).toEqual(sorted.slice(0, 2));
    expect(initial.hasMore).toBe(true);
    expect(initial.nextCursor).toEqual(expect.any(String));
    expect(new Set(initial.items.map(item => item.contexto.materiaId)).size).toBe(2);
    for (const item of initial.items) expect(item).toMatchObject({ autor: null, propio: true, puntuacion: 4 });
    expect(JSON.stringify(initial)).not.toMatch(/Autor confidencial|autorId|email|password|token/i);
  });
  it("tolera inserciones y eliminación de ambas anclas sin duplicados ni omisiones", async () => {
    const upperId = initial.items[0]!.id;
    const afterId = initial.items[1]!.id;
    const inserted = await comment(new Date("2026-03-01T00:00:00.000Z"), false, 5);
    await prisma.feedback.updateMany({ where: { id: { in: [upperId, afterId] } }, data: { deletedAt: new Date() } });
    const next = await read(`/feedback/feed?pageSize=2&cursor=${initial.nextCursor}`);
    const last = await read(`/feedback/feed?pageSize=2&cursor=${next.nextCursor}`);
    const actual = [...next.items, ...last.items].map(item => item.id);
    expect(actual).toEqual(ids.feedback.slice(0, 5).filter(id => id !== upperId && id !== afterId).sort().reverse());
    expect(new Set(actual).size).toBe(actual.length);
    expect(actual).not.toContain(inserted.id);
    expect(last).toMatchObject({ hasMore: false, nextCursor: null });
    expect((await read("/feedback/feed")).items[0]).toMatchObject({ id: inserted.id, puntuacion: 5, autor: { displayName: "Autor confidencial del feed" } });
  });
  it("conserva históricos sin estrellas y el contrato anterior de Experiencias", async () => {
    const historic = await comment(new Date("2025-01-01T00:00:00.000Z"), true, null);
    const feed = await read("/feedback/feed");
    expect(feed.items.find(item => item.id === historic.id)?.puntuacion).toBeNull();
    const previous = await request("/feedback?page=1&pageSize=9");
    const body = await previous.json();
    expect(Object.keys(body).sort()).toEqual(["items", "page", "pageSize", "total"]);
    expect(body.items).toEqual(feed.items.map(({ cantidadLikes, meGusta, cantidadRespuestas, ...item }) => {
      expect(cantidadRespuestas).toBe(0);
      expect(cantidadLikes).toBe(0);
      expect(meGusta).toBe(false);
      return item;
    }));
    expect(body.total).toBe(feed.items.length);
    expect((await request(`/feedback/${historic.id}`)).status).toBe(200);
    expect((await request(`/feedback/${historic.id}/historial`)).status).toBe(200);
    expect((await request("/feedback/no-es-uuid")).status).toBe(400);
  });
});
