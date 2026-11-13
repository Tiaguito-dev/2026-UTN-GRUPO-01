import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { VERIFICATION_EMAIL } from "../src/auth/domain/email-verification.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];

describe.skipIf(!databaseUrl)("Materias: resumen de estrellas HTTP/PostgreSQL aislado", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;
  let reader: { id: string; cookie: string };
  let admin: { id: string; cookie: string };
  const users: string[] = [];
  const voters: string[] = [];
  const materias: string[] = [];
  const cursadas: string[] = [];
  const comisiones: string[] = [];
  const config = testAuthConfig();
  const request = (path: string, method = "GET", body?: unknown, cookie?: string) => fetch(`${baseUrl}${path}`, {
    method, headers: { ...(method === "GET" ? {} : csrfHeaders), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  async function account(role: "USER" | "ADMIN") {
    const email = `rating-read-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const password = "isolated rating read password";
    const registered = await request("/auth/register", "POST", { email, password, displayName: "Persona de pruebas" });
    expect(registered.status).toBe(201);
    const { id } = await registered.json() as { id: string };
    users.push(id);
    await prisma.user.update({ where: { id }, data: { role, emailVerifiedAt: new Date() } });
    const logged = await request("/auth/login", "POST", { email, password });
    expect(logged.status).toBe(200);
    return { id, cookie: logged.headers.get("set-cookie")!.split(";")[0]! };
  }

  async function materia(prefix = "Materia") {
    const row = await prisma.materia.create({ data: { nombre: `${prefix} ${randomUUID()}`, modalidad: "PRIMERO",
      carreras: { create: [{ carrera: "S", anioCarrera: "1" }, { carrera: "I", anioCarrera: "2" }] },
    } });
    materias.push(row.id);
    return row;
  }

  async function vote(materiaId: string, index: number, puntuacion: number) {
    return prisma.valoracionMateria.create({ data: { materiaId, usuarioId: voters[index]!, puntuacion } });
  }

  async function detail(id: string) {
    const response = await request(`/materias/${id}`, "GET", undefined, reader.cookie);
    expect(response.status).toBe(200);
    return response.json();
  }

  async function list(query: Record<string, string>) {
    const response = await request(`/materias?${new URLSearchParams(query)}`, "GET", undefined, reader.cookie);
    expect(response.status).toBe(200);
    return response.json();
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
    reader = await account("USER");
    admin = await account("ADMIN");
    voters.push(reader.id);
    // Los votos adicionales prueban agregación; no necesitan sesión ni credenciales de acceso.
    for (let index = 0; index < 3; index++) {
      const user = await prisma.user.create({ data: { email: `voter-${randomUUID()}@alu.frlp.utn.edu.ar`,
        displayName: "Votante privado", passwordHash: "fixture-no-login", emailVerifiedAt: new Date(),
      } });
      users.push(user.id);
      voters.push(user.id);
    }
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.feedbackHistorial.deleteMany({ where: { feedback: { materiaId: { in: materias } } } });
      await prisma.feedback.deleteMany({ where: { materiaId: { in: materias } } });
      await prisma.valoracionMateria.deleteMany({ where: { materiaId: { in: materias } } });
      await prisma.comisionProfesor.deleteMany({ where: { comisionId: { in: comisiones } } });
      await prisma.comision.deleteMany({ where: { id: { in: comisiones } } });
      await prisma.cursada.deleteMany({ where: { id: { in: cursadas } } });
      await prisma.materiaHistorial.deleteMany({ where: { materiaId: { in: materias } } });
      await prisma.materiaCarrera.deleteMany({ where: { materiaId: { in: materias } } });
      await prisma.materia.deleteMany({ where: { id: { in: materias } } });
      await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: users } } } });
      await prisma.session.deleteMany({ where: { userId: { in: users } } });
      await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: users } } });
      await prisma.administracionHistorial.deleteMany({ where: { actorId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it("sin votos devuelve null/0 de forma equivalente en listado y detalle", async () => {
    const m = await materia();
    const result = await detail(m.id);
    expect(result.valoracion).toEqual({ promedio: null, cantidad: 0 });
    const page = await list({ q: m.nombre });
    expect(page.total).toBe(1);
    expect(page.items).toEqual([result]);
  });

  it.each([1, 5])("un voto de %i conserva el límite y cuenta una persona", async puntuacion => {
    const m = await materia();
    await vote(m.id, 0, puntuacion);
    expect((await detail(m.id)).valoracion).toEqual({ promedio: puntuacion, cantidad: 1 });
  });

  it.each([
    { scores: [1, 3, 4, 5], promedio: 3.3 },
    { scores: [1, 5], promedio: 3 },
  ])("agrega $scores y redondea exactamente a $promedio", async ({ scores, promedio }) => {
    const m = await materia();
    for (const [index, score] of scores.entries()) await vote(m.id, index, score);
    expect((await detail(m.id)).valoracion).toEqual({ promedio, cantidad: scores.length });
    expect((await list({ q: m.nombre })).items[0].valoracion).toEqual({ promedio, cantidad: scores.length });
  });

  it("excluye bajas lógicas y cuenta nuevamente la fila reactivada", async () => {
    const m = await materia();
    await vote(m.id, 0, 1);
    await vote(m.id, 1, 5);
    const where = { usuarioId_materiaId: { usuarioId: voters[0]!, materiaId: m.id } };
    expect((await detail(m.id)).valoracion).toEqual({ promedio: 3, cantidad: 2 });
    await prisma.valoracionMateria.update({ where, data: { deletedAt: new Date() } });
    expect((await detail(m.id)).valoracion).toEqual({ promedio: 5, cantidad: 1 });
    await prisma.valoracionMateria.update({ where, data: { puntuacion: 3, deletedAt: null } });
    expect((await detail(m.id)).valoracion).toEqual({ promedio: 4, cantidad: 2 });
  });

  it("carreras compartidas no filtran ni multiplican votos ni revelan personas", async () => {
    const m = await materia();
    await vote(m.id, 0, 2);
    await vote(m.id, 1, 5);
    const expected = { promedio: 3.5, cantidad: 2 };
    for (const carrera of ["S", "I"]) {
      const page = await list({ q: m.nombre, carrera });
      expect(page.total).toBe(1);
      expect(page.items[0].valoracion).toEqual(expected);
      for (const id of voters) expect(JSON.stringify(page)).not.toContain(id);
      expect(JSON.stringify(page)).not.toContain("Votante privado");
    }
    expect((await detail(m.id)).valoracion).toEqual(expected);
  });

  it("conserva orden, búsqueda, filtros y páginas aunque otra materia tenga más votos", async () => {
    const group = randomUUID();
    const a = await materia(`${group} A`);
    const b = await materia(`${group} B`);
    await vote(b.id, 0, 5);
    const first = await list({ q: group, carrera: "I", anioCarrera: "2", page: "1", pageSize: "1" });
    const second = await list({ q: group, carrera: "I", anioCarrera: "2", page: "2", pageSize: "1" });
    expect(first).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(second).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(first.items[0]).toMatchObject({ id: a.id, valoracion: { promedio: null, cantidad: 0 } });
    expect(second.items[0]).toMatchObject({ id: b.id, valoracion: { promedio: 5, cantidad: 1 } });
  });

  it("dos comentarios del mismo estudiante siguen contando una vez tras editar y retirar", async () => {
    const m = await materia();
    const cursada = await prisma.cursada.create({ data: { materiaId: m.id, anio: 2026, cuatrimestre: "PRIMERO" } });
    cursadas.push(cursada.id);
    const comments: string[] = [];
    for (const [index, score] of [2, 5].entries()) {
      const commission = await prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero: index + 1 } });
      comisiones.push(commission.id);
      const response = await request(`/comisiones/${commission.id}/feedback`, "POST", { texto: "Experiencia", anonimo: true, puntuacion: score }, reader.cookie);
      expect(response.status).toBe(201);
      comments.push((await response.json()).id);
    }
    expect((await detail(m.id)).valoracion).toEqual({ promedio: 5, cantidad: 1 });
    expect((await request(`/feedback/${comments[0]}`, "PATCH", { puntuacion: 4 }, reader.cookie)).status).toBe(200);
    expect((await detail(m.id)).valoracion).toEqual({ promedio: 4, cantidad: 1 });
    expect((await request(`/feedback/${comments[0]}`, "DELETE", undefined, reader.cookie)).status).toBe(204);
    expect((await detail(m.id)).valoracion).toEqual({ promedio: 4, cantidad: 1 });
    expect((await request(`/feedback/${comments[1]}`, "DELETE", undefined, reader.cookie)).status).toBe(204);
    expect((await detail(m.id)).valoracion).toEqual({ promedio: null, cantidad: 0 });
  });

  it("mantiene sesión, UUID y errores de materias inexistentes o eliminadas", async () => {
    const m = await materia();
    expect((await request("/materias")).status).toBe(401);
    expect((await request(`/materias/${m.id}`)).status).toBe(401);
    expect((await request(`/materias/${m.id}`, "GET", undefined, admin.cookie)).status).toBe(200);
    expect((await request("/materias/no-uuid", "GET", undefined, reader.cookie)).status).toBe(400);
    expect((await request(`/materias/${randomUUID()}`, "GET", undefined, reader.cookie)).status).toBe(404);
    await prisma.materia.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
    expect((await request(`/materias/${m.id}`, "GET", undefined, reader.cookie)).status).toBe(404);
    expect((await list({ q: m.nombre })).total).toBe(0);
  });

  it("altas y ediciones administrativas conservan respuestas base y permisos", async () => {
    const body = { nombre: `Admin ${randomUUID()}`, modalidad: "PRIMERO", carreras: [{ carrera: "S", anioCarrera: "1" }] };
    expect((await request("/materias", "POST", body, reader.cookie)).status).toBe(403);
    const created = await request("/materias", "POST", body, admin.cookie);
    expect(created.status).toBe(201);
    const result = await created.json();
    materias.push(result.id);
    expect(result).not.toHaveProperty("valoracion");
    await vote(result.id, 0, 4);
    const changed = await request(`/materias/${result.id}`, "PATCH", { nombre: `Admin editada ${randomUUID()}` }, admin.cookie);
    expect(changed.status).toBe(200);
    expect(await changed.json()).not.toHaveProperty("valoracion");
    expect((await detail(result.id)).valoracion).toEqual({ promedio: 4, cantidad: 1 });
  });
});
