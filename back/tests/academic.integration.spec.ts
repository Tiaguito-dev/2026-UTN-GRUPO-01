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
  const send = (method: "POST" | "PATCH", path: string, body: unknown, cookie: string) =>
    fetch(`${baseUrl}${path}`, { method, headers: { ...csrfHeaders, Cookie: cookie }, body: JSON.stringify(body) });

  async function account() {
    const email = `academic-test-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const response = await post("/auth/register", { email, displayName: "Persona", password });
    const user = await response.json();
    if (typeof user.id === "string") userIds.add(user.id);
    expect(response.status).toBe(201);
    // Fixture authenticated explicitly; registration itself remains pending.
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return user as { id: string; email: string };
  }
  async function sessionCookie(admin = false) {
    const user = await account();
    if (admin) await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
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
  async function createCursada(materiaId: string, anio = 2026) {
    const cursada = await prisma.cursada.create({ data: { materiaId, anio, cuatrimestre: "PRIMERO" } });
    cursadaIds.add(cursada.id);
    return cursada;
  }
  type CarreraFila = { carrera: "S" | "C" | "Q" | "I" | "M"; anioCarrera: string; nivelElectiva?: string | null };
  /** Materia con filas de MateriaCarrera creadas en el orden recibido (no en el del enum). */
  async function createMateriaConCarreras(nombre: string, carreras: CarreraFila[]) {
    const materia = await prisma.materia.create({ data: { nombre } });
    materiaIds.add(materia.id);
    for (const fila of carreras) await prisma.materiaCarrera.create({ data: { materiaId: materia.id, nivelElectiva: null, ...fila } });
    return materia;
  }
  async function createComision(cursadaId: string, data: { carrera: CarreraFila["carrera"]; numero: number; activa?: boolean; deletedAt?: Date }) {
    const comision = await prisma.comision.create({ data: { cursadaId, ...data } });
    comisionIds.add(comision.id);
    return comision;
  }
  async function asignar(comisionId: string, profesorId: string, cargo: "TITULAR" | "ADJUNTO" | "JTP") {
    await prisma.comisionProfesor.create({ data: { comisionId, profesorId, cargo } });
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
      if (comisionIds.size) await prisma.comisionProfesor.deleteMany({ where: { comisionId: { in: [...comisionIds] } } });
      if (userIds.size) await prisma.administracionHistorial.deleteMany({ where: { actorId: { in: [...userIds] } } });
      if (materiaIds.size) await prisma.materiaHistorial.deleteMany({ where: { materiaId: { in: [...materiaIds] } } });
      if (materiaIds.size) await prisma.materiaCarrera.deleteMany({ where: { materiaId: { in: [...materiaIds] } } });
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
    await prisma.materiaCarrera.createMany({ data: [{ materiaId: first.id, carrera: "S", anioCarrera: "5" }, { materiaId: second.id, carrera: "S", anioCarrera: "5" }] });

    const page1 = await get(`/materias?carrera=S&anioCarrera=5&page=1&pageSize=1`, cookie);
    expect(page1.status).toBe(200);
    const body1 = await page1.json();
    expect(body1).toMatchObject({ page: 1, pageSize: 1 });
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0].id).toBe(first.id);

    const page2 = await get(`/materias?carrera=S&anioCarrera=5&page=2&pageSize=1`, cookie);
    const body2 = await page2.json();
    expect(body2.items[0].id).toBe(second.id);
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

  it("filtra y ordena en PostgreSQL antes de paginar", async () => {
    const cookie = await sessionCookie();
    const prefix = randomUUID();
    const rows = [];
    for (const anioCarrera of ["ELECTIVA", "5", "2", "1"]) {
      const row = await createMateriaConCarreras(`A-${prefix}-${anioCarrera}`, [{ carrera: "S", anioCarrera }]);
      rows.push(row);
    }
    const yearFive = [];
    for (let i = 11; i >= 0; i--) {
      const row = await createMateriaConCarreras(`Z-${prefix}-${String(i).padStart(2, "0")}`, [{ carrera: "S", anioCarrera: "5" }]);
      yearFive.push(row);
    }
    const first = await (await get(`/materias?carrera=S&anioCarrera=5&q=${prefix}`, cookie)).json();
    const second = await (await get(`/materias?carrera=S&anioCarrera=5&page=2&q=${prefix}`, cookie)).json();
    expect(first).toMatchObject({ page: 1, pageSize: 9, total: 13 });
    expect(second).toMatchObject({ page: 2, pageSize: 9, total: 13 });
    const optionsResponse = await get(`/materias?carrera=S&anioCarrera=5&pageSize=100&q=${prefix}`, cookie);
    expect(optionsResponse.status).toBe(200);
    const options = await optionsResponse.json();
    expect(options).toMatchObject({ page: 1, pageSize: 100, total: 13 });
    expect(options.items).toHaveLength(13);
    expect((await get("/materias?pageSize=101", cookie)).status).toBe(400);
    const filtered = [...first.items, ...second.items];
    expect(filtered.map(item => item.nombre)).toEqual([rows[1]!.nombre, ...yearFive.map(row => row.nombre).sort()]);
    // TASK-060: year is independent; the same unique page is available across careers.
    const independent = await get(`/materias?anioCarrera=5&q=${prefix}`, cookie);
    expect(independent.status).toBe(200);
    expect((await independent.json()).total).toBe(13);
    expect((await get("/materias?carrera=S&anioCarrera=6", cookie)).status).toBe(400);
    expect((await get("/materias?carrera=S&anioCarrera=1&anioCarrera=2", cookie)).status).toBe(400);
  });

  it("combina búsqueda literal sin distinguir mayúsculas, año y nivel antes de paginar", async () => {
    const cookie = await sessionCookie();
    const prefix = randomUUID();
    const expected: string[] = [];
    async function seed(nombre: string, nivelElectiva = "4", deletedAt: Date | null = null) {
      const row = await prisma.materia.create({ data: { nombre, deletedAt } });
      materiaIds.add(row.id);
      await prisma.materiaCarrera.create({ data: { materiaId: row.id, carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva } });
      return row;
    }
    for (let i = 0; i < 12; i++) expected.push((await seed(`${prefix} Plan%_${String(i).padStart(2, "0")}`)).id);
    await seed(`${prefix} PlanXY`);
    await seed(`${prefix} Plan%X`);
    await seed(`${prefix} PlanY_`);
    await seed(`${prefix} Plan%_nivel3`, "3");
    await seed(`${prefix} Plan%_deleted`, "4", new Date());
    const query = new URLSearchParams({ carrera: "S", q: `  ${prefix} PLAN%_  `, anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    const first = await (await get(`/materias?${query}`, cookie)).json();
    const second = await (await get(`/materias?${query}&page=2`, cookie)).json();
    expect(first).toMatchObject({ total: 12, pageSize: 9 });
    expect(first.items).toHaveLength(9);
    expect(second.items).toHaveLength(3);
    expect([...first.items, ...second.items].map((item: { id: string }) => item.id)).toEqual(expected);
    expect((await get("/materias?carrera=S&anioCarrera=2&nivelElectiva=4", cookie)).status).toBe(400);
  });

  // TASK-060: folded search escapes user metacharacters and does not require a career.
  it("busca sin distinguir tildes o mayúsculas y conserva porcentajes, guiones bajos y barras literales", async () => {
    const cookie = await sessionCookie();
    const prefix = randomUUID();
    const expected = await createMateriaConCarreras(`${prefix} Ánálisis %_\\`, [{ carrera: "S", anioCarrera: "2" }]);
    await createMateriaConCarreras(`${prefix} Analisis AB\\`, [{ carrera: "S", anioCarrera: "2" }]);
    const params = new URLSearchParams({ q: `${prefix} ANALISIS %_\\`, anioCarrera: "2" });
    const response = await get(`/materias?${params}`, cookie);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([expected.id]);
    const reverse = await createMateriaConCarreras(`${prefix} Optica`, [{ carrera: "Q", anioCarrera: "2" }]);
    const reverseParams = new URLSearchParams({ q: `${prefix} ÓPTICA`, anioCarrera: "2" });
    expect((await (await get(`/materias?${reverseParams}`, cookie)).json()).items.map((item: { id: string }) => item.id)).toEqual([reverse.id]);
  });

  it("pagina nueve materias únicas compartidas con orden alfabético sin tildes y total estable", async () => {
    const cookie = await sessionCookie();
    const prefix = randomUUID();
    const ordered = ["Álgebra", "Análisis", "Biología", "Cálculo", "Diseño", "Estadística", "Física", "Geometría", "Historia", "Ingeniería", "Química", "Zoología"];
    for (const nombre of [...ordered].reverse()) {
      await createMateriaConCarreras(`${prefix} ${nombre}`, [{ carrera: "S", anioCarrera: "1" }, { carrera: "Q", anioCarrera: "2" }]);
    }
    const firstResponse = await get(`/materias?q=${prefix}&anioCarrera=1`, cookie);
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json();
    const second = await (await get(`/materias?q=${prefix}&anioCarrera=1&page=2`, cookie)).json();
    expect(first).toMatchObject({ total: 12, page: 1, pageSize: 9 });
    expect(second).toMatchObject({ total: 12, page: 2, pageSize: 9 });
    expect(first.items).toHaveLength(9);
    expect(second.items).toHaveLength(3);
    const items = [...first.items, ...second.items] as { id: string; nombre: string; carreras: unknown[] }[];
    expect(items.map(item => item.nombre)).toEqual(ordered.map(nombre => `${prefix} ${nombre}`));
    expect(new Set(items.map(item => item.id)).size).toBe(12);
    expect(items.every(item => item.carreras.length === 2)).toBe(true);
    const unfiltered = await (await get(`/materias?q=${prefix}`, cookie)).json();
    expect(unfiltered.total).toBe(12);
    const crossAssociation = await (await get(`/materias?q=${prefix}&carrera=S&anioCarrera=2`, cookie)).json();
    expect(crossAssociation).toMatchObject({ total: 0, items: [] });
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

  it("GET /materias/:id/cursadas devuelve el resumen para una materia existente", async () => {
    const cookie = await sessionCookie();
    const materia = await createMateria();
    const cursada = await createCursada(materia.id);

    const response = await get(`/materias/${materia.id}/cursadas`, cookie);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toEqual([{
      id: cursada.id, anio: cursada.anio, cuatrimestre: "PRIMERO", comisiones: 0, profesores: 0, carreras: [],
    }]);
  });

  it("GET /materias/:id exige sesión y devuelve la misma forma que un ítem del listado", async () => {
    const materia = await createMateria();
    expect((await get(`/materias/${materia.id}`)).status).toBe(401);

    const cookie = await sessionCookie();
    const response = await get(`/materias/${materia.id}`, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      id: materia.id, nombre: materia.nombre, modalidad: null, carreras: [], createdAt: materia.createdAt.toISOString(), deletedAt: null,
    });
    const listado = await (await get(`/materias?q=${encodeURIComponent(materia.nombre)}`, cookie)).json();
    expect(listado.items).toEqual([await (await get(`/materias/${materia.id}`, cookie)).json()]);
  });

  it("GET /materias/:id responde 400 con id inválido y 404 si no existe o está dada de baja", async () => {
    const cookie = await sessionCookie();
    const deleted = await createMateria();
    await prisma.materia.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });
    expect((await get(`/materias/not-a-uuid`, cookie)).status).toBe(400);
    expect((await get(`/materias/${randomUUID()}`, cookie)).status).toBe(404);
    expect((await get(`/materias/${deleted.id}`, cookie)).status).toBe(404);
  });

  it("GET /cursadas/:id exige sesión y devuelve el resumen con la materia", async () => {
    const materia = await createMateria();
    const cursada = await createCursada(materia.id, 2025);
    expect((await get(`/cursadas/${cursada.id}`)).status).toBe(401);

    const cookie = await sessionCookie();
    const response = await get(`/cursadas/${cursada.id}`, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      id: cursada.id, anio: 2025, cuatrimestre: "PRIMERO", comisiones: 0, profesores: 0, carreras: [],
      materia: { id: materia.id, nombre: materia.nombre, modalidad: null },
    });
  });

  it("GET /cursadas/:id responde 400 con id inválido y 404 si no existe o está dada de baja", async () => {
    const cookie = await sessionCookie();
    const materia = await createMateria();
    const cursada = await createCursada(materia.id);
    await prisma.cursada.update({ where: { id: cursada.id }, data: { deletedAt: new Date() } });
    expect((await get(`/cursadas/not-a-uuid`, cookie)).status).toBe(400);
    const missing = await get(`/cursadas/${randomUUID()}`, cookie);
    expect(missing.status).toBe(404);
    expect((await missing.json()).message).toBe("La cursada solicitada no existe.");
    expect((await get(`/cursadas/${cursada.id}`, cookie)).status).toBe(404);
  });

  describe("lecturas con carreras y comisiones (TASK-041)", () => {
    it("filtra carrera y cursada antes de paginar, con total único coherente y cero para combinación vacía", async () => {
      const materia = await createMateriaConCarreras(`Compartida ${randomUUID()}`, [
        { carrera: "S", anioCarrera: "1" }, { carrera: "I", anioCarrera: "2" }, { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" },
      ]);
      const current = await createCursada(materia.id, 2026);
      const old = await createCursada(materia.id, 2025);
      for (let numero = 1; numero <= 12; numero++) await createComision(current.id, { carrera: "S", numero });
      for (let numero = 1; numero <= 4; numero++) await createComision(current.id, { carrera: "I", numero });
      await createComision(old.id, { carrera: "S", numero: 99 });
      await createComision(current.id, { carrera: "S", numero: 98, deletedAt: new Date() });
      const cookie = await sessionCookie();
      const path = `/cursadas/${current.id}/comisiones`;
      const page1 = await (await get(`${path}?carrera=S&page=1&pageSize=9`, cookie)).json();
      const page2 = await (await get(`${path}?carrera=S&page=2&pageSize=9`, cookie)).json();
      expect(page1).toMatchObject({ total: 12, page: 1, pageSize: 9 });
      expect(page2).toMatchObject({ total: 12, page: 2, pageSize: 9 });
      expect([...page1.items, ...page2.items].map((row: { numero: number }) => row.numero)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
      expect(page1.items.every((row: { carrera: string; cursadaId: string }) => row.carrera === "S" && row.cursadaId === current.id)).toBe(true);
      expect(await (await get(`${path}?carrera=Q`, cookie)).json()).toMatchObject({ total: 0, items: [] });
      expect(await (await get(path, cookie)).json()).toMatchObject({ total: 16 });
      expect((await get(`${path}?carrera=INVALIDA`, cookie)).status).toBe(400);
    });
    const iso = (fecha: Date) => fecha.toISOString();

    // TASK-060: paginate alphabetically by unique subject, not by association/year/level.
    it("GET /materias?carrera=Q incluye comunes, filtra sobre una asociación y ordena por nombre", async () => {
      const cookie = await sessionCookie();
      const prefix = randomUUID();
      const soloS = await createMateriaConCarreras(`${prefix} A solo S`, [{ carrera: "S", anioCarrera: "1" }]);
      // Filas creadas Q antes que S: la respuesta igual las ordena por el enum.
      const comun = await createMateriaConCarreras(`${prefix} B común`, [{ carrera: "Q", anioCarrera: "2" }, { carrera: "S", anioCarrera: "3" }]);
      const q1d = await createMateriaConCarreras(`${prefix} D Q1`, [{ carrera: "Q", anioCarrera: "1" }]);
      const q1c = await createMateriaConCarreras(`${prefix} C Q1`, [{ carrera: "Q", anioCarrera: "1" }]);
      const e4 = await createMateriaConCarreras(`${prefix} A electiva 4`, [{ carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4" }]);
      const e3 = await createMateriaConCarreras(`${prefix} Z electiva 3`, [{ carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "3" }]);
      const eSinNivel = await createMateriaConCarreras(`${prefix} B electiva sin nivel`, [{ carrera: "Q", anioCarrera: "ELECTIVA" }]);
      const borrada = await createMateriaConCarreras(`${prefix} E borrada`, [{ carrera: "Q", anioCarrera: "2" }]);
      await prisma.materia.update({ where: { id: borrada.id }, data: { deletedAt: new Date() } });
      const ids = async (query: string) => {
        const response = await get(`/materias?q=${prefix}&${query}`, cookie);
        expect(response.status).toBe(200);
        return ((await response.json()).items as { id: string }[]).map((item) => item.id);
      };

      await expect(ids("carrera=Q&pageSize=100")).resolves.toEqual([e4.id, comun.id, eSinNivel.id, q1c.id, q1d.id, e3.id]);
      await expect(ids("carrera=Q&anioCarrera=2")).resolves.toEqual([comun.id]);
      await expect(ids("carrera=Q&anioCarrera=ELECTIVA&nivelElectiva=4")).resolves.toEqual([e4.id]);
      await expect(ids("carrera=S")).resolves.toEqual([soloS.id, comun.id]);
      const pagina = await (await get(`/materias?q=${prefix}&carrera=Q&pageSize=2&page=2`, cookie)).json();
      expect(pagina).toMatchObject({ total: 6, page: 2, pageSize: 2 });
      expect(pagina.items.map((item: { id: string }) => item.id)).toEqual([eSinNivel.id, q1c.id]);
      expect((await get("/materias?carrera=X", cookie)).status).toBe(400);
      expect((await get("/materias?carrera=Q&carrera=S", cookie)).status).toBe(400);

      await expect(ids("anioCarrera=3")).resolves.toEqual([comun.id]);
      // S belongs to year 3, Q to year 2; filters cannot match separate associations.
      await expect(ids("carrera=S&anioCarrera=2")).resolves.toEqual([]);

      const esperado = {
        id: comun.id, nombre: comun.nombre, modalidad: null,
        carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }, { carrera: "Q", anioCarrera: "2", nivelElectiva: null }],
        createdAt: iso(comun.createdAt), deletedAt: null,
      };
      expect((await (await get(`/materias?q=${prefix}&carrera=Q&anioCarrera=2`, cookie)).json()).items).toStrictEqual([esperado]);
      expect(await (await get(`/materias/${comun.id}`, cookie)).json()).toStrictEqual(esperado);
    });

    it("toda materia devuelve carreras en el orden del enum S, C, Q, I, M", async () => {
      const cookie = await sessionCookie();
      const materia = await createMateriaConCarreras(`Materia ${randomUUID()}`, ["M", "I", "C", "Q", "S"].map((carrera) =>
        ({ carrera: carrera as CarreraFila["carrera"], anioCarrera: "1" })));
      const body = await (await get(`/materias/${materia.id}`, cookie)).json();
      expect(body.carreras.map((fila: { carrera: string }) => fila.carrera)).toEqual(["S", "C", "Q", "I", "M"]);
      expect(body).not.toHaveProperty("anioCarrera");
    });

    it("el resumen de cursada cuenta comisiones activas y profesores distintos, con las carreras en orden del enum", async () => {
      const cookie = await sessionCookie();
      const materia = await createMateria();
      const [p1, p2, p3, p4] = await Promise.all([createProfesor(), createProfesor(), createProfesor(), createProfesor()]);
      const cursada = await createCursada(materia.id, 2025);
      const q1 = await createComision(cursada.id, { carrera: "Q", numero: 1 });
      const s1 = await createComision(cursada.id, { carrera: "S", numero: 1 });
      const inactiva = await createComision(cursada.id, { carrera: "M", numero: 1, activa: false });
      const borrada = await createComision(cursada.id, { carrera: "I", numero: 1, deletedAt: new Date() });
      await asignar(q1.id, p1.id, "TITULAR");
      await asignar(s1.id, p1.id, "ADJUNTO");
      await asignar(s1.id, p2.id, "JTP");
      await asignar(inactiva.id, p3.id, "TITULAR");
      await asignar(borrada.id, p4.id, "TITULAR");
      const resumen = { id: cursada.id, anio: 2025, cuatrimestre: "PRIMERO", comisiones: 2, profesores: 2, carreras: ["S", "Q"] };

      expect((await (await get(`/materias/${materia.id}/cursadas`, cookie)).json()).items).toStrictEqual([resumen]);
      expect(await (await get(`/cursadas/${cursada.id}`, cookie)).json()).toStrictEqual({ ...resumen, materia: { id: materia.id, nombre: materia.nombre, modalidad: null } });
    });

    it("GET /cursadas/:id/comisiones ordena por carrera y número, con profesores por cargo y nombre", async () => {
      const cookie = await sessionCookie();
      const prefix = randomUUID();
      const cursada = await createCursada((await createMateria()).id);
      const q1 = await createComision(cursada.id, { carrera: "Q", numero: 1 });
      const s10 = await createComision(cursada.id, { carrera: "S", numero: 10 });
      const s2 = await createComision(cursada.id, { carrera: "S", numero: 2 });
      const m1 = await createComision(cursada.id, { carrera: "M", numero: 1, activa: false });
      await createComision(cursada.id, { carrera: "S", numero: 3, deletedAt: new Date() });
      const [zoe, ana, bruno, abel] = await Promise.all(["Zoe", "Ana", "Bruno", "Abel"].map((nombre) => createProfesor(`${prefix} ${nombre}`)));
      await asignar(s2.id, zoe!.id, "JTP");
      await asignar(s2.id, ana!.id, "ADJUNTO");
      await asignar(s2.id, bruno!.id, "TITULAR");
      await asignar(s2.id, abel!.id, "JTP");

      const body = await (await get(`/cursadas/${cursada.id}/comisiones`, cookie)).json();
      expect(body).toMatchObject({ total: 4 });
      expect(body.items.map((item: { id: string }) => item.id)).toEqual([s2.id, s10.id, q1.id, m1.id]);
      expect(body.items[0]).toStrictEqual({
        id: s2.id, cursadaId: cursada.id, nombre: "S-2", activa: true, carrera: "S", numero: 2,
        profesores: [bruno, ana, abel, zoe].map((p) => ({ id: p!.id, nombreCompleto: p!.nombreCompleto, cargo: p === bruno ? "TITULAR" : p === ana ? "ADJUNTO" : "JTP" })),
        createdAt: iso(s2.createdAt), deletedAt: null,
      });
    });

    it("GET /comisiones/:id exige sesión y devuelve la comisión con la cursada y su materia, aunque esté inactiva", async () => {
      const materia = await createMateria();
      const profesor = await createProfesor();
      const cursada = await createCursada(materia.id, 2025);
      const comision = await createComision(cursada.id, { carrera: "S", numero: 31, activa: false });
      await asignar(comision.id, profesor.id, "TITULAR");
      expect((await get(`/comisiones/${comision.id}`)).status).toBe(401);

      const cookie = await sessionCookie();
      const response = await get(`/comisiones/${comision.id}`, cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({
        id: comision.id, cursadaId: cursada.id, nombre: "S-31", activa: false, carrera: "S", numero: 31,
        profesores: [{ id: profesor.id, nombreCompleto: profesor.nombreCompleto, cargo: "TITULAR" }],
        createdAt: iso(comision.createdAt), deletedAt: null,
        cursada: { id: cursada.id, anio: 2025, cuatrimestre: "PRIMERO", materia: { id: materia.id, nombre: materia.nombre, modalidad: null } },
      });
    });

    it("GET /comisiones/:id responde 400 con id inválido y 404 si no existe o están borradas la comisión, su cursada o su materia", async () => {
      const cookie = await sessionCookie();
      expect((await get("/comisiones/not-a-uuid", cookie)).status).toBe(400);
      const missing = await get(`/comisiones/${randomUUID()}`, cookie);
      expect(missing.status).toBe(404);
      expect((await missing.json()).message).toBe("La comisión solicitada no existe.");
      for (const borrar of ["comision", "cursada", "materia"] as const) {
        const materia = await createMateria();
        const cursada = await createCursada(materia.id);
        const comision = await createComision(cursada.id, { carrera: "S", numero: 1 });
        const data = { deletedAt: new Date() };
        if (borrar === "comision") await prisma.comision.update({ where: { id: comision.id }, data });
        if (borrar === "cursada") await prisma.cursada.update({ where: { id: cursada.id }, data });
        if (borrar === "materia") await prisma.materia.update({ where: { id: materia.id }, data });
        const response = await get(`/comisiones/${comision.id}`, cookie);
        expect(response.status, borrar).toBe(404);
        expect((await response.json()).message).toBe("La comisión solicitada no existe.");
      }
    });
  });

  // DATA-01: two active subjects cannot share a name that differs only in case or accents.
  // The unique index and findByNombre must use the same expression as the search.
  describe("unicidad del nombre de materia sin distinguir mayúsculas ni tildes (DATA-01)", () => {
    const repetido = "Ya existe una materia con ese nombre.";
    const body = (nombre: string) => ({ nombre, modalidad: "ANUAL", carreras: [{ carrera: "S", anioCarrera: "1" }] });
    async function alta(nombre: string, cookie: string) {
      const response = await send("POST", "/materias", body(nombre), cookie);
      const json = await response.json();
      if (typeof json.id === "string") materiaIds.add(json.id);
      return { status: response.status, json };
    }

    it("el alta con otra variante de mayúsculas o tildes devuelve 409, por HTTP y en la base", async () => {
      const cookie = await sessionCookie(true);
      const prefix = randomUUID();
      expect((await alta(`${prefix} QA Unicidad`, cookie)).status).toBe(201);
      for (const variante of [`${prefix} qa unicidad`, `${prefix} QA Únicidad`]) {
        const { status, json } = await alta(variante, cookie);
        expect(status, variante).toBe(409);
        expect(json.message).toBe(repetido);
      }
      // Without the application pre-check, the index itself rejects the variant.
      await expect(createMateria(`${prefix} QA ÚNICIDAD`)).rejects.toMatchObject({ code: "P2002" });
    });

    it("editar otra materia a una variante del nombre devuelve 409", async () => {
      const cookie = await sessionCookie(true);
      const prefix = randomUUID();
      expect((await alta(`${prefix} QA Unicidad`, cookie)).status).toBe(201);
      const otra = await alta(`${prefix} Otra`, cookie);
      const response = await send("PATCH", `/materias/${otra.json.id}`, { nombre: `${prefix} QA UNICIDAD` }, cookie);
      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(repetido);
    });

    it("una materia dada de baja no bloquea el alta y renombrar a una variante del propio nombre se permite", async () => {
      const cookie = await sessionCookie(true);
      const prefix = randomUUID();
      const baja = await createMateria(`${prefix} QA Unicidad`);
      await prisma.materia.update({ where: { id: baja.id }, data: { deletedAt: new Date() } });
      const nueva = await alta(`${prefix} qa unicidad`, cookie);
      expect(nueva.status).toBe(201);
      const response = await send("PATCH", `/materias/${nueva.json.id}`, { nombre: `${prefix} QA Unicidad` }, cookie);
      expect(response.status).toBe(200);
      expect((await response.json()).nombre).toBe(`${prefix} QA Unicidad`);
    });
  });
});
