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

// Nunca usar DATABASE_URL como fallback: esta suite exige una base de pruebas explícita.
const testDatabaseUrl = process.env["TEST_DATABASE_URL"];

describe.skipIf(!testDatabaseUrl)("Jerarquía académica HTTP y persistencia PostgreSQL real", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;
  const userIds = new Set<string>();
  const materiaIds = new Set<string>();
  const profesorIds = new Set<string>();
  const cursadaIds = new Set<string>();
  const comisionIds = new Set<string>();
  const config = testAuthConfig();
  const password = " academic integration password ";

  const post = (path: string, body: unknown) => fetch(`${baseUrl}${path}`, { method: "POST", headers: csrfHeaders, body: JSON.stringify(body) });
  const get = (path: string, cookie?: string) => fetch(`${baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : {} });

  async function account() {
    const email = `academic-test-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const response = await post("/auth/register", { email, displayName: "Persona", password });
    const user = await response.json();
    if (typeof user.id === "string") userIds.add(user.id);
    expect(response.status).toBe(201);
    // Fixture authenticated explicitly; registration itself remains pending.
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    // Authenticated fixtures explicitly verify their accounts.
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return user as { id: string; email: string };
  }
  async function sessionCookie() {
    const user = await account();
    const response = await post("/auth/login", { email: user.email, password });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    expect(response.status).toBe(200);
    return cookie!;
  }

  async function createMateria(nombre = `Materia ${randomUUID()}`) {
    const materia = await prisma.materia.create({ data: { nombre } });
    materiaIds.add(materia.id);
    return materia;
  }
  async function createProfesor(nombreCompleto = `Profesor ${randomUUID()}`) {
    const profesor = await prisma.profesor.create({ data: { nombreCompleto } });
    profesorIds.add(profesor.id);
    return profesor;
  }
  async function createCursada(materiaId: string, profesorId: string, anio = 2026) {
    const cursada = await prisma.cursada.create({ data: { materiaId, profesorId, anio, cuatrimestre: "PRIMERO" } });
    cursadaIds.add(cursada.id);
    return cursada;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  }, 20_000);

  afterAll(async () => {
    if (prisma) {
      if (comisionIds.size) await prisma.comision.deleteMany({ where: { id: { in: [...comisionIds] } } });
      if (cursadaIds.size) await prisma.cursada.deleteMany({ where: { id: { in: [...cursadaIds] } } });
      if (materiaIds.size) await prisma.materia.deleteMany({ where: { id: { in: [...materiaIds] } } });
      if (profesorIds.size) await prisma.profesor.deleteMany({ where: { id: { in: [...profesorIds] } } });
      if (userIds.size) {
        await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: [...userIds] } } } });
        await prisma.session.deleteMany({ where: { userId: { in: [...userIds] } } });
        await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: [...userIds] } } }); await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
      }
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it("GET /materias sin cookie de sesión devuelve 401", async () => {
    const response = await get("/materias");
    expect(response.status).toBe(401);
  });

  it("GET /materias con sesión válida devuelve los datos sembrados respetando paginación", async () => {
    const cookie = await sessionCookie();
    const nombreBase = randomUUID();
    const first = await createMateria(`A-${nombreBase}`);
    const second = await createMateria(`B-${nombreBase}`);
    await prisma.materia.updateMany({ where: { id: { in: [first.id, second.id] } }, data: { anioCarrera: "5" } });

    const page1 = await get(`/materias?anioCarrera=5&page=1&pageSize=1`, cookie);
    expect(page1.status).toBe(200);
    const body1 = await page1.json();
    expect(body1).toMatchObject({ page: 1, pageSize: 1 });
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0].id).toBe(first.id);

    const page2 = await get(`/materias?anioCarrera=5&page=2&pageSize=1`, cookie);
    const body2 = await page2.json();
    expect(body2.items[0].id).toBe(second.id);
    await prisma.materia.updateMany({ where: { id: { in: [first.id, second.id] } }, data: { deletedAt: new Date() } });
  });

  it("una materia soft-deleted no aparece en los resultados", async () => {
    const cookie = await sessionCookie();
    const visible = await createMateria();
    const deleted = await createMateria();
    await prisma.materia.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    const ids: string[] = [];
    let page = 1;
    while (true) {
      const response = await get(`/materias?pageSize=9&page=${page}`, cookie);
      const body = await response.json();
      ids.push(...body.items.map((item: { id: string }) => item.id));
      if (ids.length >= body.total) break;
      page++;
    }
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(deleted.id);
  });

  it("filtra y ordena en PostgreSQL antes de paginar, dejando Electiva y heredadas al final", async () => {
    const cookie = await sessionCookie();
    const prefix = randomUUID();
    const rows = [];
    for (const anioCarrera of [null, "ELECTIVA", "5", "2", "1"]) {
      const row = await prisma.materia.create({ data: { nombre: `A-${prefix}-${anioCarrera}`, anioCarrera } });
      materiaIds.add(row.id); rows.push(row);
    }
    const yearFive = [];
    for (let i = 11; i >= 0; i--) {
      const row = await prisma.materia.create({ data: { nombre: `Z-${prefix}-${String(i).padStart(2, "0")}`, anioCarrera: "5" } });
      materiaIds.add(row.id); yearFive.push(row);
    }
    const first = await (await get(`/materias?anioCarrera=5&q=${prefix}`, cookie)).json();
    const second = await (await get(`/materias?anioCarrera=5&page=2&q=${prefix}`, cookie)).json();
    expect(first).toMatchObject({ page: 1, pageSize: 9, total: 13 });
    expect(second).toMatchObject({ page: 2, pageSize: 9, total: 13 });
    const optionsResponse = await get(`/materias?anioCarrera=5&pageSize=100&q=${prefix}`, cookie);
    expect(optionsResponse.status).toBe(200);
    const options = await optionsResponse.json();
    expect(options).toMatchObject({ page: 1, pageSize: 100, total: 13 });
    expect(options.items).toHaveLength(13);
    expect((await get("/materias?pageSize=101", cookie)).status).toBe(400);
    const filtered = [...first.items, ...second.items];
    expect(filtered.every(item => item.anioCarrera === "5")).toBe(true);
    expect(filtered.map(item => item.nombre)).toEqual([rows[2]!.nombre, ...yearFive.map(row => row.nombre).sort()]);
    const ids: string[] = [];
    let page = 1;
    while (true) {
      const body = await (await get(`/materias?page=${page}`, cookie)).json();
      ids.push(...body.items.map((item: { id: string }) => item.id));
      if (ids.length >= body.total) break;
      page++;
    }
    const ordered = [...rows].reverse().map(row => ids.indexOf(row.id));
    expect(ordered.every(index => index >= 0)).toBe(true);
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    expect((await get("/materias?anioCarrera=6", cookie)).status).toBe(400);
    expect((await get("/materias?anioCarrera=1&anioCarrera=2", cookie)).status).toBe(400);
  });

  it("combina búsqueda literal sin distinguir mayúsculas, año y nivel antes de paginar", async () => {
    const cookie = await sessionCookie();
    const prefix = randomUUID();
    const expected: string[] = [];
    async function seed(nombre: string, nivelElectiva = "4", deletedAt: Date | null = null) {
      const row = await prisma.materia.create({ data: { nombre, anioCarrera: "ELECTIVA", nivelElectiva, deletedAt } });
      materiaIds.add(row.id); return row;
    }
    for (let i = 0; i < 12; i++) expected.push((await seed(`${prefix} Plan%_${String(i).padStart(2, "0")}`)).id);
    await seed(`${prefix} PlanXY`);
    await seed(`${prefix} Plan%X`);
    await seed(`${prefix} PlanY_`);
    await seed(`${prefix} Plan%_nivel3`, "3");
    await seed(`${prefix} Plan%_deleted`, "4", new Date());
    const query = new URLSearchParams({ q: `  ${prefix} PLAN%_  `, anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    const first = await (await get(`/materias?${query}`, cookie)).json();
    const second = await (await get(`/materias?${query}&page=2`, cookie)).json();
    expect(first).toMatchObject({ total: 12, pageSize: 9 });
    expect(first.items).toHaveLength(9);
    expect(second.items).toHaveLength(3);
    expect([...first.items, ...second.items].map((item: { id: string }) => item.id)).toEqual(expected);
    expect((await get("/materias?anioCarrera=2&nivelElectiva=4", cookie)).status).toBe(400);
  });

  it("GET /materias/:id/cursadas con UUID inexistente devuelve 404 con el mensaje de MateriaNotFoundError", async () => {
    const cookie = await sessionCookie();
    const response = await get(`/materias/${randomUUID()}/cursadas`, cookie);
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.message).toBe("La materia solicitada no existe.");
  });

  it("GET /materias/:id/cursadas con :id que no es UUID devuelve 400", async () => {
    const cookie = await sessionCookie();
    const response = await get(`/materias/not-a-uuid/cursadas`, cookie);
    expect(response.status).toBe(400);
  });

  it("GET /materias/:id/cursadas devuelve el nombre del profesor para una materia existente", async () => {
    const cookie = await sessionCookie();
    const materia = await createMateria();
    const profesor = await createProfesor();
    const cursada = await createCursada(materia.id, profesor.id);

    const response = await get(`/materias/${materia.id}/cursadas`, cookie);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toEqual([{ id: cursada.id, anio: cursada.anio, cuatrimestre: cursada.cuatrimestre, profesor: profesor.nombreCompleto }]);
  });
});
