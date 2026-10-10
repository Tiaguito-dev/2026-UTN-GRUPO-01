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
      .overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
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
        await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
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

    const page1 = await get(`/materias?page=1&pageSize=1`, cookie);
    expect(page1.status).toBe(200);
    const body1 = await page1.json();
    expect(body1).toMatchObject({ page: 1, pageSize: 1 });
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0].id).toBe(first.id);

    const page2 = await get(`/materias?page=2&pageSize=1`, cookie);
    const body2 = await page2.json();
    expect(body2.items[0].id).toBe(second.id);
  });

  it("una materia soft-deleted no aparece en los resultados", async () => {
    const cookie = await sessionCookie();
    const visible = await createMateria();
    const deleted = await createMateria();
    await prisma.materia.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    const response = await get(`/materias?pageSize=100`, cookie);
    const body = await response.json();
    const ids = body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(deleted.id);
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
