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
  const patch = (path: string, body: unknown, cookie?: string) => fetch(`${baseUrl}${path}`, {
    method: "PATCH", headers: { ...csrfHeaders, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  });
  const put = (path: string, body: unknown, cookie?: string) => fetch(`${baseUrl}${path}`, {
    method: "PUT", headers: { ...csrfHeaders, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  });
  const del = (path: string, cookie?: string) => fetch(`${baseUrl}${path}`, {
    method: "DELETE", headers: { ...csrfHeaders, ...(cookie ? { Cookie: cookie } : {}) },
  });

  async function account() {
    const email = `admin-test-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const response = await post("/auth/register", { email, displayName: "Persona", password });
    const user = await response.json();
    expect(response.status).toBe(201);
    userIds.add(user.id);
    // Authenticated fixtures explicitly verify their accounts.
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
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
  const crearMateria = (nombre = `Materia ${randomUUID()}`) => crear("/materias", { nombre, modalidad: "ANUAL", carreras: [{ carrera: "S", anioCarrera: "1" }] }, materiaIds);
  const crearProfesor = (nombreCompleto = `Profesor ${randomUUID()}`) => crear("/profesores", { nombreCompleto }, profesorIds);
  const crearCursada = (materiaId: string, anio = ANIO, cuatrimestre = "PRIMERO") =>
    crear("/cursadas", { materiaId, anio, cuatrimestre }, cursadaIds);
  const crearComision = (cursadaId: string, carrera = "S", numero = 1) => crear("/comisiones", { cursadaId, carrera, numero }, comisionIds);

  /** Materia + cursada recién creados por HTTP. */
  async function jerarquia() {
    const materia = await crearMateria();
    const cursada = await crearCursada(materia.id);
    return { materia, cursada };
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
    adminCookie = await sessionCookie("ADMIN");
    userCookie = await sessionCookie("USER");
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      if (materiaIds.size) await prisma.materiaHistorial.deleteMany({ where: { materiaId: { in: [...materiaIds] } } });
      if (materiaIds.size) await prisma.materiaCarrera.deleteMany({ where: { materiaId: { in: [...materiaIds] } } });
      if (comisionIds.size) await prisma.comisionProfesor.deleteMany({ where: { comisionId: { in: [...comisionIds] } } });
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

  describe("TASK-055 edición administrativa", () => {
    it("ANUAL roundtrip: crea, lista y edita conservando el período persistido", async () => {
      const materia = await crearMateria();
      const anual = await crearCursada(materia.id, ANIO, "ANUAL");
      expect(anual.cuatrimestre).toBe("ANUAL");
      const listado = await (await get(`/materias/${materia.id}/cursadas`, userCookie)).json();
      expect(listado.items).toContainEqual(expect.objectContaining({ id: anual.id, cuatrimestre: "ANUAL" }));
      const result = await patch(`/cursadas/${anual.id}`, { anio: ANIO + 1 }, adminCookie);
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ id: anual.id, anio: ANIO + 1, cuatrimestre: "ANUAL" });
      expect((await prisma.cursada.findUniqueOrThrow({ where: { id: anual.id } })).cuatrimestre).toBe("ANUAL");
      const semestral = await crearCursada(materia.id, ANIO, "PRIMERO");
      const editar = await patch(`/cursadas/${semestral.id}`, { cuatrimestre: "ANUAL" }, adminCookie);
      expect(editar.status).toBe(200);
      expect(await editar.json()).toMatchObject({ id: semestral.id, cuatrimestre: "ANUAL" });
    });
    it("serializa alta de comisión contra retiro concurrente de su carrera", async () => {
      const { materia, cursada } = await jerarquia();
      await prisma.materiaCarrera.create({ data: { materiaId: materia.id, carrera: "Q", anioCarrera: "1" } });
      const [alta, retiro] = await Promise.all([
        post("/comisiones", { cursadaId: cursada.id, carrera: "Q", numero: 21 }, adminCookie),
        patch(`/materias/${materia.id}`, { carreras: [{ carrera: "S", anioCarrera: "1" }] }, adminCookie),
      ]);
      if (alta.status === 201) comisionIds.add((await alta.json()).id);
      expect([201, 400]).toContain(alta.status);
      expect([200, 409]).toContain(retiro.status);
      const carreras = await prisma.materiaCarrera.findMany({ where: { materiaId: materia.id } });
      const comisiones = await prisma.comision.findMany({ where: { cursadaId: cursada.id, deletedAt: null } });
      expect(comisiones.every((c) => carreras.some((r) => r.carrera === c.carrera))).toBe(true);
      expect(alta.status === 201 && retiro.status === 200).toBe(false);
    });

    it("serializa movimiento de cursada contra alta concurrente de comisión", async () => {
      const { materia, cursada } = await jerarquia();
      await prisma.materiaCarrera.create({ data: { materiaId: materia.id, carrera: "Q", anioCarrera: "1" } });
      const destino = await crearMateria();
      const [alta, mover] = await Promise.all([
        post("/comisiones", { cursadaId: cursada.id, carrera: "Q", numero: 22 }, adminCookie),
        patch(`/cursadas/${cursada.id}`, { materiaId: destino.id }, adminCookie),
      ]);
      if (alta.status === 201) comisionIds.add((await alta.json()).id);
      expect([201, 400]).toContain(alta.status);
      expect([200, 400]).toContain(mover.status);
      const actual = await prisma.cursada.findUniqueOrThrow({ where: { id: cursada.id } });
      const carreras = await prisma.materiaCarrera.findMany({ where: { materiaId: actual.materiaId } });
      const comisiones = await prisma.comision.findMany({ where: { cursadaId: cursada.id, deletedAt: null } });
      expect(comisiones.every((c) => carreras.some((r) => r.carrera === c.carrera))).toBe(true);
      expect(alta.status === 201 && mover.status === 200).toBe(false);
    });

    it("consulta y edita un profesor y protege GET/PATCH por rol", async () => {
      const profesor = await crearProfesor();
      expect((await get(`/profesores/${profesor.id}`)).status).toBe(401);
      expect((await get(`/profesores/${profesor.id}`, userCookie)).status).toBe(403);
      expect((await get(`/profesores/${profesor.id}`, adminCookie)).status).toBe(200);
      expect((await patch(`/profesores/${profesor.id}`, { nombreCompleto: "Otro" })).status).toBe(401);
      expect((await patch(`/profesores/${profesor.id}`, { nombreCompleto: "Otro" }, userCookie)).status).toBe(403);
      const result = await patch(`/profesores/${profesor.id}`, { nombreCompleto: " Ada Lovelace " }, adminCookie);
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ id: profesor.id, nombreCompleto: "Ada Lovelace" });
      expect((await patch(`/profesores/${randomUUID()}`, { nombreCompleto: "Ada" }, adminCookie)).status).toBe(404);
    });

    it("mueve una cursada compatible preservando comisión y docentes", async () => {
      const { cursada } = await jerarquia();
      const destino = await crearMateria();
      const comision = await crearComision(cursada.id);
      const profesor = await crearProfesor();
      await prisma.comisionProfesor.create({ data: { comisionId: comision.id, profesorId: profesor.id, cargo: "TITULAR" } });
      const result = await patch(`/cursadas/${cursada.id}`, { materiaId: destino.id, cuatrimestre: "SEGUNDO" }, adminCookie);
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ id: cursada.id, materiaId: destino.id, cuatrimestre: "SEGUNDO" });
      const detalle = await (await get(`/comisiones/${comision.id}`, userCookie)).json();
      expect(detalle.cursada.materia.id).toBe(destino.id);
      expect(detalle.profesores).toEqual([expect.objectContaining({ id: profesor.id, cargo: "TITULAR" })]);
      expect((await get(`/cursadas/${cursada.id}`, userCookie)).status).toBe(200);
    });

    it("impide mover a una materia sin carreras de comisiones incluso inactivas", async () => {
      const { cursada } = await jerarquia();
      const comision = await crearComision(cursada.id);
      await prisma.comision.update({ where: { id: comision.id }, data: { activa: false } });
      const destino = await crear("/materias", { modalidad: "ANUAL", nombre: `Química ${randomUUID()}`, carreras: [{ carrera: "Q", anioCarrera: "1" }] }, materiaIds);
      expect((await patch(`/cursadas/${cursada.id}`, { materiaId: destino.id }, adminCookie)).status).toBe(400);
      expect((await prisma.cursada.findUniqueOrThrow({ where: { id: cursada.id } })).materiaId).toBe(cursada.materiaId);
    });

    it("edita carrera y número y mantiene cursada, activa y docentes", async () => {
      const { materia, cursada } = await jerarquia();
      await prisma.materiaCarrera.create({ data: { materiaId: materia.id, carrera: "Q", anioCarrera: "1" } });
      const comision = await crearComision(cursada.id);
      const profesor = await crearProfesor();
      await prisma.comisionProfesor.create({ data: { comisionId: comision.id, profesorId: profesor.id, cargo: "ADJUNTO" } });
      const result = await patch(`/comisiones/${comision.id}`, { carrera: "Q", numero: 31 }, adminCookie);
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ id: comision.id, nombre: "Q-31", cursadaId: cursada.id, activa: true, profesores: [expect.objectContaining({ id: profesor.id, cargo: "ADJUNTO" })] });
      expect((await get(`/comisiones/${comision.id}`, userCookie)).status).toBe(200);
    });

    it("rechaza duplicados de cursada y comisión con 409 y carreras ajenas con 400", async () => {
      const { cursada, materia } = await jerarquia();
      await crearCursada(materia.id, ANIO, "SEGUNDO");
      expect((await patch(`/cursadas/${cursada.id}`, { cuatrimestre: "SEGUNDO" }, adminCookie)).status).toBe(409);
      const comision = await crearComision(cursada.id, "S", 1);
      await crearComision(cursada.id, "S", 2);
      expect((await patch(`/comisiones/${comision.id}`, { numero: 2 }, adminCookie)).status).toBe(409);
      expect((await patch(`/comisiones/${comision.id}`, { carrera: "Q" }, adminCookie)).status).toBe(400);
    });

    it("rechaza PATCH vacíos, propiedades retiradas y ausencia de CSRF", async () => {
      const profesor = await crearProfesor();
      const { cursada } = await jerarquia();
      const comision = await crearComision(cursada.id);
      for (const [path, body] of [
        [`/profesores/${profesor.id}`, {}], [`/profesores/${profesor.id}`, { nombreCompleto: "Ada", role: "ADMIN" }],
        [`/cursadas/${cursada.id}`, {}], [`/cursadas/${cursada.id}`, { profesorId: profesor.id }],
        [`/comisiones/${comision.id}`, {}], [`/comisiones/${comision.id}`, { nombre: "Otra" }],
        [`/comisiones/${comision.id}`, { activa: false }], [`/comisiones/${comision.id}`, { cursadaId: cursada.id }],
      ] as const) expect((await patch(path, body, adminCookie)).status, path).toBe(400);
      for (const [path, body] of [[`/cursadas/${cursada.id}`, { anio: ANIO }], [`/comisiones/${comision.id}`, { numero: 3 }]] as const) {
        expect((await patch(path, body)).status).toBe(401);
        expect((await patch(path, body, userCookie)).status).toBe(403);
        expect((await fetch(`${baseUrl}${path}`, { method: "PATCH", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify(body) })).status).toBe(403);
      }
      expect((await patch(`/cursadas/${randomUUID()}`, { anio: ANIO }, adminCookie)).status).toBe(404);
      expect((await patch(`/comisiones/${randomUUID()}`, { numero: 3 }, adminCookie)).status).toBe(404);
    });
  });

  describe("un ADMIN carga la jerarquía completa", () => {
    it("da de alta las 4 entidades con 201 y quedan visibles en el drill-down de lectura", async () => {
      const materia = await crearMateria();
      await crearProfesor();
      const cursada = await crearCursada(materia.id);
      const comision = await crearComision(cursada.id, "S", 1);
      expect(comision).toMatchObject({ cursadaId: cursada.id, nombre: "S-1", carrera: "S", numero: 1, activa: true, deletedAt: null });

      const materias = await (await get(`/materias?pageSize=9&q=${encodeURIComponent(materia.nombre)}`, adminCookie)).json();
      expect(materias.items.map((item: { id: string }) => item.id)).toContain(materia.id);

      const cursadas = await (await get(`/materias/${materia.id}/cursadas`, adminCookie)).json();
      expect(cursadas.items).toEqual([{ id: cursada.id, anio: ANIO, cuatrimestre: "PRIMERO", comisiones: 1, profesores: 0, carreras: ["S"] }]);

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
      const materia = await crear("/materias", { modalidad: "ANUAL", nombre: `   ${nombre}   `, carreras: [{ carrera: "S", anioCarrera: "1" }] }, materiaIds);
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
      const response = await post("/materias", { modalidad: "ANUAL", nombre: materia.nombre, carreras: [{ carrera: "S", anioCarrera: "1" }] }, adminCookie);
      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe("Ya existe una materia con ese nombre.");
    });

    it("cursada con la misma materia, año devuelve 409", async () => {
      const { materia, cursada } = await jerarquia();
      const response = await post("/cursadas", { materiaId: materia.id, anio: cursada.anio, cuatrimestre: "PRIMERO" }, adminCookie);
      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe("Ya existe una cursada de esa materia para ese año y período.");
    });

    it("comisión con la misma carrera y número en la misma cursada devuelve 409", async () => {
      const { cursada } = await jerarquia();
      await crearComision(cursada.id, "S", 1);
      const response = await post("/comisiones", { cursadaId: cursada.id, carrera: "S", numero: 1 }, adminCookie);
      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe("Ya existe esa comisión en esa cursada.");
    });

    it("la misma comisión (carrera y número) se acepta en otra cursada", async () => {
      const primera = await jerarquia();
      const segunda = await jerarquia();
      const unaComision = await crearComision(primera.cursada.id, "S", 1);
      const otraComision = await crearComision(segunda.cursada.id, "S", 1);
      expect(otraComision.nombre).toBe(unaComision.nombre);
      expect(otraComision.cursadaId).toBe(segunda.cursada.id);
      expect(otraComision.id).not.toBe(unaComision.id);
    });
  });

  describe("referencias inexistentes y cuerpos inválidos", () => {
    it("POST /cursadas con materia inexistente devuelve 404 de materia", async () => {
      const response = await post("/cursadas", { materiaId: randomUUID(), anio: ANIO, cuatrimestre: "PRIMERO" }, adminCookie);
      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe("La materia solicitada no existe.");
    });

    it("POST /comisiones con cursada inexistente devuelve 404", async () => {
      const response = await post("/comisiones", { cursadaId: randomUUID(), carrera: "S", numero: 1 }, adminCookie);
      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe("La cursada solicitada no existe.");
    });

    it.each([
      ["/materias", { modalidad: "ANUAL", nombre: "   ", carreras: [{ carrera: "S", anioCarrera: "1" }] }],
      ["/materias", { modalidad: "ANUAL", nombre: "a".repeat(151), carreras: [{ carrera: "S", anioCarrera: "1" }] }],
      ["/materias", { modalidad: "ANUAL", nombre: "Álgebra", id: "x", carreras: [{ carrera: "S", anioCarrera: "1" }] }],
      ["/materias", { modalidad: "ANUAL", nombre: "Álgebra", anioCarrera: "1" }],
      ["/profesores", { nombreCompleto: "" }],
      ["/cursadas", { materiaId: randomUUID(), anio: 1999 }],
      ["/cursadas", { materiaId: randomUUID(), anio: 2026, cuatrimestre: "TERCERO" }],
      ["/cursadas", { materiaId: randomUUID(), profesorId: randomUUID(), anio: 2026 }],
      ["/comisiones", { cursadaId: "not-a-uuid", carrera: "S", numero: 1 }],
      ["/comisiones", { cursadaId: randomUUID(), carrera: "S", numero: 1000 }],
      ["/comisiones", { cursadaId: randomUUID(), nombre: "Comisión 1" }],
    ])("POST %s con cuerpo inválido devuelve 400", async (path, body) => {
      const response = await post(path, body, adminCookie);
      expect(response.status).toBe(400);
    });
  });

  describe("autorización", () => {
    const endpointsAdmin: [string, string, unknown][] = [
      ["POST", "/materias", { modalidad: "ANUAL", nombre: "Álgebra", carreras: [{ carrera: "S", anioCarrera: "1" }] }],
      ["POST", "/profesores", { nombreCompleto: "Ada Lovelace" }],
      ["POST", "/cursadas", { materiaId: randomUUID(), anio: ANIO }],
      ["POST", "/comisiones", { cursadaId: randomUUID(), carrera: "S", numero: 1 }],
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
      await post("/materias", { modalidad: "ANUAL", nombre: "Materia prohibida" }, userCookie);
      await post("/profesores", { nombreCompleto: "Profesor prohibido" }, userCookie);
      await expect(prisma.materia.findFirst({ where: { modalidad: "ANUAL", nombre: "Materia prohibida" } })).resolves.toBeNull();
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

  describe("Edición y trazabilidad de materias", () => {
    it("solo ADMIN puede editar; requiere sesión y protección CSRF", async () => {
      const materia = await crearMateria();
      const path = `/materias/${materia.id}`;
      expect((await patch(path, { modalidad: "ANUAL", nombre: "Nuevo" })).status).toBe(401);
      expect((await patch(path, { modalidad: "ANUAL", nombre: "Nuevo" }, userCookie)).status).toBe(403);
      expect((await fetch(`${baseUrl}${path}`, { method: "PATCH", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ modalidad: "ANUAL", nombre: "Nuevo" }) })).status).toBe(403);
      expect((await get(path, userCookie)).status).toBe(200);
    });

    it("alta exige al menos una carrera y no admite valores fuera del contrato", async () => {
      for (const carreras of [undefined, null, [], [{ carrera: "X", anioCarrera: "1" }]]) {
        expect((await post("/materias", { modalidad: "ANUAL", nombre: `Inválida ${randomUUID()}`, carreras }, adminCookie)).status).toBe(400);
      }
    });

    it("historial solo registra diferencias reales, con actor (sin actorId) y páginas de tres", async () => {
      const materia = await crearMateria();
      const path = `/materias/${materia.id}`;
      for (const anio of ["2", "3", "4", "5"]) {
        expect((await patch(path, { carreras: [{ carrera: "S", anioCarrera: anio }] }, adminCookie)).status).toBe(200);
      }
      expect((await patch(path, { carreras: [{ carrera: "S", anioCarrera: "5" }] }, adminCookie)).status).toBe(200);
      expect((await patch(path, {}, adminCookie)).status).toBe(200);
      expect((await patch(path, { carreras: [] }, adminCookie)).status).toBe(400);
      expect((await get(`${path}/historial`, userCookie)).status).toBe(403);
      expect((await get(`${path}/historial`)).status).toBe(401);
      const history = await (await get(`${path}/historial`, adminCookie)).json();
      expect(history).toMatchObject({ page: 1, pageSize: 3, total: 4 });
      expect(history.items).toHaveLength(3);
      expect(history.items[0]).toMatchObject({
        materiaId: materia.id,
        actor: { id: expect.any(String), displayName: expect.any(String) },
        createdAt: expect.any(String),
        cambios: [{ campo: "carreras", anterior: "S:4", nuevo: "S:5" }],
      });
      expect(history.items[0]).not.toHaveProperty("actorId");
      const second = await (await get(`${path}/historial?page=2`, adminCookie)).json();
      expect(second.items).toHaveLength(1);
      expect((await get(`${path}/historial?pageSize=4`, adminCookie)).status).toBe(400);
    });
  });

  describe("carreras de la materia (TASK-040)", () => {
    it("conserva períodos de cursada y registra cambios de modalidad de materia sin duplicados", async () => {
      const materia = await crear("/materias", { modalidad: "ANUAL", nombre: `Anual ${randomUUID()}`, carreras: [{ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" }] }, materiaIds);
      expect(materia.modalidad).toBe("ANUAL");
      const cursada = await crearCursada(materia.id, ANIO, "ANUAL");
      expect(cursada.cuatrimestre).toBe("ANUAL");
      expect((await post("/cursadas", { materiaId: materia.id, anio: ANIO, cuatrimestre: "ANUAL" }, adminCookie)).status).toBe(409);
      expect((await post("/cursadas", { materiaId: materia.id, anio: ANIO + 1 }, adminCookie)).status).toBe(400);
      await crearCursada(materia.id, ANIO, "SEGUNDO");
      const path = `/materias/${materia.id}`;
      expect((await patch(path, { modalidad: "SEGUNDO" }, adminCookie)).status).toBe(200);
      expect((await patch(path, { modalidad: "SEGUNDO" }, adminCookie)).status).toBe(200);
      const history = await (await get(`${path}/historial`, adminCookie)).json();
      expect(history.total).toBe(1);
      expect(history.items[0].cambios).toEqual([{ campo: "modalidad", anterior: "ANUAL", nuevo: "SEGUNDO" }]);
    });
    it("POST /materias con carreras S y Q crea dos filas en MateriaCarrera", async () => {
      const materia = await crear("/materias", { modalidad: "ANUAL", nombre: `Materia ${randomUUID()}`, carreras: [
        { carrera: "S", anioCarrera: "2" }, { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" },
      ] }, materiaIds);
      const filas = await prisma.materiaCarrera.findMany({ where: { materiaId: materia.id }, orderBy: { carrera: "asc" } });
      expect(filas).toEqual([
        { materiaId: materia.id, carrera: "S", anioCarrera: "2", nivelElectiva: null },
        { materiaId: materia.id, carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" },
      ]);
    });

    it("PATCH con carreras registra una sola entrada de historial \"carreras\" serializada", async () => {
      const materia = await crear("/materias", { modalidad: "ANUAL", nombre: `Materia ${randomUUID()}`, carreras: [{ carrera: "S", anioCarrera: "1" }] }, materiaIds);
      const path = `/materias/${materia.id}`;
      const response = await patch(path, { carreras: [{ carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" }, { carrera: "S", anioCarrera: "2" }] }, adminCookie);
      expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
      const history = await (await get(`${path}/historial`, adminCookie)).json();
      expect(history.total).toBe(1);
      expect(history.items[0].cambios).toEqual([{ campo: "carreras", anterior: "S:1", nuevo: "S:2,Q:ELECTIVA:4" }]);
    });

    it("PATCH que quita una carrera con comisiones devuelve 409 y no cambia nada", async () => {
      const materia = await crear("/materias", { modalidad: "ANUAL", nombre: `Materia ${randomUUID()}`, carreras: [
        { carrera: "S", anioCarrera: "2" }, { carrera: "Q", anioCarrera: "2" },
      ] }, materiaIds);
      const cursada = await crear("/cursadas", { materiaId: materia.id, anio: ANIO, cuatrimestre: "PRIMERO" }, cursadaIds);
      await crear("/comisiones", { cursadaId: cursada.id, carrera: "Q", numero: 1 }, comisionIds);
      const response = await patch(`/materias/${materia.id}`, { carreras: [{ carrera: "S", anioCarrera: "2" }] }, adminCookie);
      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe("No se puede quitar una carrera que tiene comisiones.");
      await expect(prisma.materiaCarrera.count({ where: { materiaId: materia.id } })).resolves.toBe(2);
    });
  });

  describe("respuestas de alta y edición con los campos nuevos (TASK-041)", () => {
    it("POST y PATCH de materia devuelven carreras en orden del enum sin campos legados", async () => {
      const creada = await crear("/materias", { modalidad: "ANUAL", nombre: `Materia ${randomUUID()}`, carreras: [
        { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" }, { carrera: "S", anioCarrera: "2" },
      ] }, materiaIds);
      expect(creada).toMatchObject({ carreras: [
        { carrera: "S", anioCarrera: "2", nivelElectiva: null }, { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" },
      ] });
      expect(creada).not.toHaveProperty("anioCarrera");
      expect(creada).not.toHaveProperty("nivelElectiva");
      const editada = await patch(`/materias/${creada.id}`, { carreras: [{ carrera: "M", anioCarrera: "3" }, { carrera: "C", anioCarrera: "1" }] }, adminCookie);
      expect(editada.status).toBe(200);
      expect((await editada.json()).carreras).toEqual([{ carrera: "C", anioCarrera: "1", nivelElectiva: null }, { carrera: "M", anioCarrera: "3", nivelElectiva: null }]);
    });

    it("POST /comisiones devuelve carrera, número y profesores", async () => {
      const materia = await crear("/materias", { modalidad: "ANUAL", nombre: `Materia ${randomUUID()}`, carreras: [{ carrera: "S", anioCarrera: "2" }] }, materiaIds);
      const cursada = await crear("/cursadas", { materiaId: materia.id, anio: ANIO, cuatrimestre: "PRIMERO" }, cursadaIds);
      const nueva = await crear("/comisiones", { cursadaId: cursada.id, carrera: "S", numero: 31 }, comisionIds);
      expect(nueva).toMatchObject({ cursadaId: cursada.id, nombre: "S-31", activa: true, carrera: "S", numero: 31, profesores: [], deletedAt: null });
      const responseLegada = await post("/comisiones", { cursadaId: cursada.id, nombre: "Comisión 1 - Mañana" }, adminCookie);
      expect(responseLegada.status).toBe(400);
      expect((await responseLegada.json()).message).toBe("La petición contiene campos no permitidos.");
    });
  });

  describe("profesores por comisión (TASK-040)", () => {
    async function comisionConProfesor() {
      const { cursada } = await jerarquia();
      const comision = await crearComision(cursada.id);
      const profesor = await crearProfesor();
      return { comision, profesor, path: `/comisiones/${comision.id}/profesores/${profesor.id}` };
    }

    it("un USER común recibe 403 en PUT y DELETE", async () => {
      const { path } = await comisionConProfesor();
      expect((await put(path, { cargo: "TITULAR" }, userCookie)).status).toBe(403);
      expect((await del(path, userCookie)).status).toBe(403);
    });

    it("ADMIN asigna (200), cambia el cargo con upsert y quita (204)", async () => {
      const { comision, profesor, path } = await comisionConProfesor();
      const asignado = await put(path, { cargo: "TITULAR" }, adminCookie);
      expect(asignado.status).toBe(200);
      expect(await asignado.json()).toEqual({ id: profesor.id, nombreCompleto: profesor.nombreCompleto, cargo: "TITULAR" });
      const cambiado = await put(path, { cargo: "JTP" }, adminCookie);
      expect(cambiado.status).toBe(200);
      expect((await cambiado.json()).cargo).toBe("JTP");
      await expect(prisma.comisionProfesor.findMany({ where: { comisionId: comision.id } })).resolves.toMatchObject([{ profesorId: profesor.id, cargo: "JTP" }]);
      const quitado = await del(path, adminCookie);
      expect(quitado.status).toBe(204);
      expect(await quitado.text()).toBe("");
      await expect(prisma.comisionProfesor.count({ where: { comisionId: comision.id } })).resolves.toBe(0);
    });

    it("PUT con cargo inválido devuelve 400", async () => {
      const { path } = await comisionConProfesor();
      expect((await put(path, { cargo: "AYUDANTE" }, adminCookie)).status).toBe(400);
    });

    it("404 si la comisión o el profesor no existen, o el profesor no estaba asignado", async () => {
      const { comision, profesor, path } = await comisionConProfesor();
      const casos: [Response, string][] = [
        [await put(`/comisiones/${randomUUID()}/profesores/${profesor.id}`, { cargo: "TITULAR" }, adminCookie), "La comisión solicitada no existe."],
        [await del(`/comisiones/${randomUUID()}/profesores/${profesor.id}`, adminCookie), "La comisión solicitada no existe."],
        [await put(`/comisiones/${comision.id}/profesores/${randomUUID()}`, { cargo: "TITULAR" }, adminCookie), "El profesor solicitado no existe."],
        [await del(`/comisiones/${comision.id}/profesores/${randomUUID()}`, adminCookie), "El profesor solicitado no existe."],
        [await del(path, adminCookie), "El profesor no está asignado a esa comisión."],
      ];
      for (const [response, message] of casos) {
        expect(response.status, message).toBe(404);
        expect((await response.json()).message).toBe(message);
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
