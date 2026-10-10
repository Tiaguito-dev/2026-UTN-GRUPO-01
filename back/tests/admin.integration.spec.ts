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

describe.skipIf(!testDatabaseUrl)("Alta administrativa del catálogo académico (HU-11) sobre PostgreSQL real", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;
  let adminCookie: string;
  let userCookie: string;
  const userIds = new Set<string>();
  const materiaIds = new Set<string>();
  const profesorIds = new Set<string>();
  const cursadaIds = new Set<string>();
  const comisionIds = new Set<string>();
  const config = testAuthConfig();
  const password = " admin integration password ";
  const ANIO = 2026;

  const post = (path: string, body: unknown, cookie?: string) =>
    fetch(`${baseUrl}${path}`, { method: "POST", headers: cookie ? { ...csrfHeaders, Cookie: cookie } : csrfHeaders, body: JSON.stringify(body) });
  const get = (path: string, cookie?: string) => fetch(`${baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : {} });

  async function account() {
    const email = `admin-test-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const response = await post("/auth/register", { email, displayName: "Persona", password });
    const user = await response.json();
    expect(response.status).toBe(201);
    userIds.add(user.id);
    return user as { id: string; email: string };
  }

  async function sessionCookie(role: "ADMIN" | "USER") {
    const user = await account();
    // El rol se lee de la base en cada request (AuthenticateRequest), así que promover antes
    // de iniciar sesión alcanza y no hace falta tocar el token.
    if (role === "ADMIN") await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    const response = await post("/auth/login", { email: user.email, password });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie")!.split(";")[0]!;
  }

  /** Alta por HTTP como ADMIN, registrando el id creado para la limpieza. */
  async function crear(path: string, body: unknown, ids: Set<string>) {
    const response = await post(path, body, adminCookie);
    const creado = await response.json();
    expect(response.status, JSON.stringify(creado)).toBe(201);
    ids.add(creado.id);
    return creado;
  }
  const crearMateria = (nombre = `Materia ${randomUUID()}`) => crear("/materias", { nombre }, materiaIds);
  const crearProfesor = (nombreCompleto = `Profesor ${randomUUID()}`) => crear("/profesores", { nombreCompleto }, profesorIds);
  const crearCursada = (materiaId: string, profesorId: string, anio = ANIO, cuatrimestre = "PRIMERO") =>
    crear("/cursadas", { materiaId, profesorId, anio, cuatrimestre }, cursadaIds);
  const crearComision = (cursadaId: string, nombre = `Comisión ${randomUUID()}`) => crear("/comisiones", { cursadaId, nombre }, comisionIds);

  /** Materia + profesor + cursada recién creados por HTTP. */
  async function jerarquia() {
    const [materia, profesor] = await Promise.all([crearMateria(), crearProfesor()]);
    const cursada = await crearCursada(materia.id, profesor.id);
    return { materia, profesor, cursada };
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
    adminCookie = await sessionCookie("ADMIN");
    userCookie = await sessionCookie("USER");
  }, 30_000);

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

  describe("un ADMIN carga la jerarquía completa", () => {
    it("da de alta las 4 entidades con 201 y quedan visibles en el drill-down de lectura", async () => {
      const materia = await crearMateria();
      const profesor = await crearProfesor();
      const cursada = await crearCursada(materia.id, profesor.id);
      const comision = await crearComision(cursada.id, "Comisión 1 - Mañana");
      expect(comision).toMatchObject({ cursadaId: cursada.id, nombre: "Comisión 1 - Mañana", activa: true, deletedAt: null });

      const materias = await (await get(`/materias?pageSize=100`, adminCookie)).json();
      expect(materias.items.map((item: { id: string }) => item.id)).toContain(materia.id);

      const cursadas = await (await get(`/materias/${materia.id}/cursadas`, adminCookie)).json();
      expect(cursadas.items).toEqual([{ id: cursada.id, anio: ANIO, cuatrimestre: "PRIMERO", profesor: profesor.nombreCompleto }]);

      const comisiones = await (await get(`/cursadas/${cursada.id}/comisiones`, adminCookie)).json();
      expect(comisiones.items.map((item: { id: string }) => item.id)).toEqual([comision.id]);
    });

    it("GET /profesores lista los profesores dados de alta", async () => {
      const profesor = await crearProfesor();
      const response = await get(`/profesores?pageSize=100`, adminCookie);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ page: 1, pageSize: 100 });
      expect(body.items.map((item: { id: string }) => item.id)).toContain(profesor.id);
    });

    it("recorta los espacios del nombre antes de persistir", async () => {
      const nombre = `Materia ${randomUUID()}`;
      const materia = await crear("/materias", { nombre: `   ${nombre}   ` }, materiaIds);
      expect(materia.nombre).toBe(nombre);
      await expect(prisma.materia.findUnique({ where: { id: materia.id } })).resolves.toMatchObject({ nombre });
    });

    it("acepta dos profesores homónimos (no hay restricción única por nombre)", async () => {
      const nombreCompleto = `Juan Pérez ${randomUUID()}`;
      const primero = await crearProfesor(nombreCompleto);
      const segundo = await crearProfesor(nombreCompleto);
      expect(segundo.id).not.toBe(primero.id);
      expect(segundo.nombreCompleto).toBe(primero.nombreCompleto);
    });
  });

  describe("duplicados", () => {
    it("materia con nombre repetido devuelve 409", async () => {
      const materia = await crearMateria();
      const response = await post("/materias", { nombre: materia.nombre }, adminCookie);
      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe("Ya existe una materia con ese nombre.");
    });

    it("cursada con la misma materia, año y cuatrimestre devuelve 409", async () => {
      const { materia, cursada } = await jerarquia();
      const otroProfesor = await crearProfesor();
      const response = await post("/cursadas", { materiaId: materia.id, profesorId: otroProfesor.id, anio: cursada.anio, cuatrimestre: cursada.cuatrimestre }, adminCookie);
      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe("Ya existe una cursada de esa materia para ese año y cuatrimestre.");
    });

    it("comisión con el mismo nombre en la misma cursada devuelve 409", async () => {
      const { cursada } = await jerarquia();
      const comision = await crearComision(cursada.id);
      const response = await post("/comisiones", { cursadaId: cursada.id, nombre: comision.nombre }, adminCookie);
      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe("Ya existe una comisión con ese nombre en esa cursada.");
    });

    // Decisión 6 de TASK-019: la unicidad es (cursadaId, nombre). Sin este caso, una
    // implementación con unicidad global de nombres pasaría igual.
    it("el mismo nombre de comisión se acepta en otra cursada", async () => {
      const nombre = "Comisión 1 - Mañana";
      const primera = await jerarquia();
      const segunda = await jerarquia();
      const unaComision = await crearComision(primera.cursada.id, nombre);
      const otraComision = await crearComision(segunda.cursada.id, nombre);
      expect(otraComision.nombre).toBe(unaComision.nombre);
      expect(otraComision.cursadaId).toBe(segunda.cursada.id);
      expect(otraComision.id).not.toBe(unaComision.id);
    });
  });

  describe("referencias inexistentes y cuerpos inválidos", () => {
    it("POST /cursadas con materia inexistente devuelve 404 de materia", async () => {
      const profesor = await crearProfesor();
      const response = await post("/cursadas", { materiaId: randomUUID(), profesorId: profesor.id, anio: ANIO, cuatrimestre: "PRIMERO" }, adminCookie);
      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe("La materia solicitada no existe.");
    });

    it("POST /cursadas con profesor inexistente devuelve 404 de profesor", async () => {
      const materia = await crearMateria();
      const response = await post("/cursadas", { materiaId: materia.id, profesorId: randomUUID(), anio: ANIO, cuatrimestre: "PRIMERO" }, adminCookie);
      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe("El profesor solicitado no existe.");
    });

    it("POST /comisiones con cursada inexistente devuelve 404", async () => {
      const response = await post("/comisiones", { cursadaId: randomUUID(), nombre: "Comisión 1" }, adminCookie);
      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe("La cursada solicitada no existe.");
    });

    it.each([
      ["/materias", { nombre: "   " }],
      ["/materias", { nombre: "a".repeat(151) }],
      ["/materias", { nombre: "Álgebra", id: "x" }],
      ["/profesores", { nombreCompleto: "" }],
      ["/cursadas", { materiaId: randomUUID(), profesorId: randomUUID(), anio: 1999, cuatrimestre: "PRIMERO" }],
      ["/cursadas", { materiaId: randomUUID(), profesorId: randomUUID(), anio: 2026, cuatrimestre: "TERCERO" }],
      ["/comisiones", { cursadaId: "not-a-uuid", nombre: "Comisión 1" }],
      ["/comisiones", { cursadaId: randomUUID(), nombre: "a".repeat(101) }],
    ])("POST %s con cuerpo inválido devuelve 400", async (path, body) => {
      const response = await post(path, body, adminCookie);
      expect(response.status).toBe(400);
    });
  });

  describe("autorización", () => {
    const endpointsAdmin: [string, string, unknown][] = [
      ["POST", "/materias", { nombre: "Álgebra" }],
      ["POST", "/profesores", { nombreCompleto: "Ada Lovelace" }],
      ["POST", "/cursadas", { materiaId: randomUUID(), profesorId: randomUUID(), anio: ANIO, cuatrimestre: "PRIMERO" }],
      ["POST", "/comisiones", { cursadaId: randomUUID(), nombre: "Comisión 1" }],
      ["GET", "/profesores", undefined],
      ["GET", "/users", undefined],
    ];

    it.each(endpointsAdmin)("un USER común recibe 403 en %s %s", async (method, path, body) => {
      const response = method === "GET" ? await get(path, userCookie) : await post(path, body, userCookie);
      expect(response.status).toBe(403);
      expect((await response.json()).message).toBe("No tiene permiso para realizar esta operación.");
    });

    it.each(endpointsAdmin)("sin sesión, %s %s devuelve 401", async (method, path, body) => {
      const response = method === "GET" ? await get(path) : await post(path, body);
      expect(response.status).toBe(401);
    });

    it("el USER común no deja rastro: ninguna de las altas rechazadas se persistió", async () => {
      await post("/materias", { nombre: "Materia prohibida" }, userCookie);
      await post("/profesores", { nombreCompleto: "Profesor prohibido" }, userCookie);
      await expect(prisma.materia.findFirst({ where: { nombre: "Materia prohibida" } })).resolves.toBeNull();
      await expect(prisma.profesor.findFirst({ where: { nombreCompleto: "Profesor prohibido" } })).resolves.toBeNull();
    });

    it("la lectura del drill-down sigue abierta a un USER común", async () => {
      const { materia, cursada } = await jerarquia();
      await crearComision(cursada.id);
      for (const path of [`/materias`, `/materias/${materia.id}/cursadas`, `/cursadas/${cursada.id}/comisiones`]) {
        const response = await get(path, userCookie);
        expect(response.status, path).toBe(200);
        expect((await response.json()).items.length).toBeGreaterThan(0);
      }
    });
  });

  describe("GET /users", () => {
    it("devuelve el listado paginado sin exponer passwordHash", async () => {
      const response = await get(`/users?pageSize=100`, adminCookie);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({ page: 1, pageSize: 100 });
      expect(body.items.length).toBeGreaterThan(0);
      for (const item of body.items) {
        expect(Object.keys(item).sort()).toEqual(["createdAt", "displayName", "email", "id", "role"]);
      }
      expect(JSON.stringify(body)).not.toContain("passwordHash");
      expect(JSON.stringify(body)).not.toContain("$argon2");
    });

    it("respeta la paginación", async () => {
      const response = await get(`/users?page=1&pageSize=1`, adminCookie);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.total).toBeGreaterThan(1);
    });

    it("pageSize fuera de rango devuelve 400", async () => {
      const response = await get(`/users?pageSize=101`, adminCookie);
      expect(response.status).toBe(400);
    });
  });
});
