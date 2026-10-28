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
import { Argon2PasswordHasher } from "../src/auth/infrastructure/argon2-password-hasher.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";
import { Login } from "../src/auth/application/login.js";
import { PrismaUserRepository } from "../src/users/infrastructure/prisma-user.repository.js";
import { PrismaRefreshCredentialRepository } from "../src/auth/infrastructure/prisma-refresh-credential.repository.js";
import { CryptoRefreshTokenService } from "../src/auth/infrastructure/crypto-refresh-token.service.js";
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];

// Toda escritura está limitada a UUID de fixtures y a TEST_DATABASE_URL explícito.
describe.skipIf(!databaseUrl)("Administración remota, estados y bajas reales TASK-070", () => {
  let app: INestApplication; let prisma: PrismaClient; let base: string; let passwordHash: string;
  let admin: { id: string; email: string }; let adminCookie: string;
  const password = " task070 private test password ";
  const users = new Set<string>(); const materias = new Set<string>(); const profesores = new Set<string>();
  const cursadas = new Set<string>(); const comisiones = new Set<string>();
  const config = testAuthConfig({ AUTH_LOGIN_MAX_ATTEMPTS: "200", AUTH_REFRESH_MAX_ATTEMPTS: "200" });
  const cookies = (response: Response) => response.headers.getSetCookie().map((entry) => entry.split(";")[0]).join("; ");
  const request = (method: string, path: string, cookie = adminCookie, body?: unknown) => fetch(`${base}${path}`, {
    method, headers: { ...csrfHeaders, ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const get = (path: string, cookie = adminCookie) => request("GET", path, cookie);
  async function account(role: "ADMIN" | "USER" = "USER", displayName = "Persona de prueba") {
    const user = await prisma.user.create({ data: { email: `task070-${randomUUID()}@alu.frlp.utn.edu.ar`, displayName, role, passwordHash, emailVerifiedAt: new Date() } });
    users.add(user.id); return user;
  }
  async function login(user: { email: string }) {
    const response = await request("POST", "/auth/login", "", { email: user.email, password });
    expect(response.status).toBe(200); return cookies(response);
  }
  async function materia() {
    const row = await prisma.materia.create({ data: { nombre: `TASK070 ${randomUUID()}`, modalidad: "ANUAL", carreras: { create: { carrera: "S", anioCarrera: "4" } } } });
    materias.add(row.id); return row;
  }
  async function profesor() {
    const row = await prisma.profesor.create({ data: { nombreCompleto: `Docente ${randomUUID()}` } });
    profesores.add(row.id); return row;
  }
  async function cursada(materiaId: string) {
    const row = await prisma.cursada.create({ data: { materiaId, anio: 2026, cuatrimestre: "ANUAL" } });
    cursadas.add(row.id); return row;
  }
  async function comision(cursadaId: string) {
    const row = await prisma.comision.create({ data: { cursadaId, carrera: "S", numero: 41 } });
    comisiones.add(row.id); return row;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) }); await prisma.$connect();
    passwordHash = await new Argon2PasswordHasher().hash(password);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AUTH_CONFIG).useValue(config).overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config); await app.listen(0, "127.0.0.1"); base = await app.getUrl();
    admin = await account("ADMIN"); adminCookie = await login(admin);
  }, 20000);

  afterAll(async () => {
    if (prisma) {
      const userIds = [...users]; const materiaIds = [...materias]; const profesorIds = [...profesores]; const cursadaIds = [...cursadas]; const comisionIds = [...comisiones];
      if (userIds.length) {
        await prisma.administracionHistorial.deleteMany({ where: { actorId: { in: userIds } } });
        await prisma.materiaHistorial.deleteMany({ where: { actorId: { in: userIds } } });
        await prisma.feedbackHistorial.deleteMany({ where: { feedback: { autorId: { in: userIds } } } });
        await prisma.feedback.deleteMany({ where: { autorId: { in: userIds } } });
      }
      if (comisionIds.length) { await prisma.comisionProfesor.deleteMany({ where: { comisionId: { in: comisionIds } } }); await prisma.comision.deleteMany({ where: { id: { in: comisionIds } } }); }
      if (cursadaIds.length) await prisma.cursada.deleteMany({ where: { id: { in: cursadaIds } } });
      if (materiaIds.length) { await prisma.materiaCarrera.deleteMany({ where: { materiaId: { in: materiaIds } } }); await prisma.materia.deleteMany({ where: { id: { in: materiaIds } } }); }
      if (profesorIds.length) await prisma.profesor.deleteMany({ where: { id: { in: profesorIds } } });
      if (userIds.length) {
        await prisma.passwordResetCredential.deleteMany({ where: { userId: { in: userIds } } }); await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: userIds } } } }); await prisma.session.deleteMany({ where: { userId: { in: userIds } } }); await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });

  it("protege listado, estado, bajas e historial: 401 anónimo y 403 para USER", async () => {
    const user = await account(); const cookie = await login(user); const m = await materia();
    for (const [method, path, body] of [["GET", "/users", undefined], ["PATCH", `/users/${user.id}/estado`, { activo: false }], ["DELETE", `/materias/${m.id}`, undefined], ["GET", `/users/${user.id}/historial`, undefined], ["GET", `/profesores/${randomUUID()}/historial`, undefined]] as const) {
      expect((await request(method, path, "", body)).status).toBe(401);
      expect((await request(method, path, cookie, body)).status).toBe(403);
    }
    expect((await prisma.materia.findUniqueOrThrow({ where: { id: m.id } })).deletedAt).toBeNull();
  });

  it("desactivar revoca acceso, login, refresh y sesiones; reactivar exige una sesión nueva", async () => {
    const user = await account(); const cookie = await login(user);
    const response = await request("PATCH", `/users/${user.id}/estado`, adminCookie, { activo: false });
    expect(response.status).toBe(200); expect((await response.json()).disabledAt).toEqual(expect.any(String));
    expect((await prisma.session.findMany({ where: { userId: user.id } })).every((session) => session.revokedAt instanceof Date)).toBe(true);
    expect((await prisma.refreshCredential.findMany({ where: { session: { userId: user.id } } })).every((credential) => credential.invalidatedAt instanceof Date)).toBe(true);
    expect((await get("/auth/me", cookie)).status).toBe(401);
    expect((await request("POST", "/auth/login", "", { email: user.email, password })).status).toBe(401);
    expect((await request("POST", "/auth/refresh", cookie, {})).status).toBe(401);
    const enabled = await request("PATCH", `/users/${user.id}/estado`, adminCookie, { activo: true });
    expect(enabled.status).toBe(200); expect((await enabled.json()).disabledAt).toBeNull();
    expect((await get("/auth/me", cookie)).status).toBe(401);
    expect((await get("/auth/me", await login(user))).status).toBe(200);
    const history = await (await get(`/users/${user.id}/historial`)).json();
    expect(history).toMatchObject({ page: 1, pageSize: 3, total: 2 }); expect(history.items.every((entry: { actorId: string }) => entry.actorId === admin.id)).toBe(true);
    const repeated = await request("PATCH", `/users/${user.id}/estado`, adminCookie, { activo: true }); expect(repeated.status).toBe(200);
    expect((await (await get(`/users/${user.id}/historial`)).json()).total).toBe(2);
  });

  it("el historial de usuarios pagina tres cambios reales sin exponer secretos", async () => {
    const user = await account();
    for (const activo of [false, true, false, true]) expect((await request("PATCH", `/users/${user.id}/estado`, adminCookie, { activo })).status).toBe(200);
    const first = await (await get(`/users/${user.id}/historial`)).json(); const second = await (await get(`/users/${user.id}/historial?page=2`)).json();
    expect(first).toMatchObject({ total: 4, pageSize: 3 }); expect(first.items).toHaveLength(3); expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size).toBe(4);
    expect(JSON.stringify(first)).not.toMatch(/passwordHash|tokenHash|contraseña|credential/i);
  });

  it("un login que leyó la cuenta antes de su desactivación no consigue crear una sesión después", async () => {
    const user = await account();
    let beginVerification!: () => void; let finishVerification!: () => void;
    const started = new Promise<void>((resolve) => { beginVerification = resolve; });
    const release = new Promise<void>((resolve) => { finishVerification = resolve; });
    const database = prisma as unknown as PrismaService;
    const loginUseCase = new Login(new PrismaUserRepository(database), {
      hash: async () => passwordHash,
      verify: async () => { beginVerification(); await release; return true; },
    }, new PrismaRefreshCredentialRepository(database), new JoseAccessTokenService(config),
    new CryptoRefreshTokenService(), passwordHash, config.accessTtlSeconds, config.sessionTtlSeconds);
    const pending = loginUseCase.execute({ email: user.email, password });
    const rejected = expect(pending).rejects.toMatchObject({ httpStatus: 401 });
    try {
      await started;
      expect((await request("PATCH", `/users/${user.id}/estado`, adminCookie, { activo: false })).status).toBe(200);
    } finally { finishVerification(); }
    await rejected;
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refresh concurrente no deja acceso vigente ni revive sus cookies después de reactivar", async () => {
    const user = await account(); const original = await login(user); const secondSession = await login(user);
    const [refresh, disabled] = await Promise.all([
      request("POST", "/auth/refresh", original, {}),
      request("PATCH", `/users/${user.id}/estado`, adminCookie, { activo: false }),
    ]);
    expect(disabled.status).toBe(200); expect([200, 401]).toContain(refresh.status);
    const rotated = refresh.status === 200 ? cookies(refresh) : original;
    expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    expect(await prisma.refreshCredential.count({ where: { session: { userId: user.id }, consumedAt: null, invalidatedAt: null } })).toBe(0);
    for (const cookie of [original, rotated, secondSession]) {
      expect((await get("/auth/me", cookie)).status).toBe(401);
      expect((await request("POST", `/comisiones/${randomUUID()}/feedback`, cookie, { texto: "No debe publicarse", anonimo: true })).status).toBe(401);
    }
    expect((await request("PATCH", `/users/${user.id}/estado`, adminCookie, { activo: true })).status).toBe(200);
    for (const cookie of [original, rotated, secondSession]) {
      expect((await get("/auth/me", cookie)).status).toBe(401);
      expect((await request("POST", "/auth/refresh", cookie, {})).status).toBe(401);
    }
    expect((await get("/auth/me", await login(user))).status).toBe(200);
  });

  it("desactivar y reactivar conserva comentarios anónimos, sus snapshots y la identidad pública", async () => {
    const author = await account(); const authorCookie = await login(author);
    const m = await materia(); const c = await cursada(m.id); const co = await comision(c.id);
    const created = await request("POST", `/comisiones/${co.id}/feedback`, authorCookie, { texto: "Comentario anónimo que se conserva", anonimo: true });
    expect(created.status).toBe(201); const feedback = await created.json();
    const originalRecord = await prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } });
    const originalHistory = await prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } });
    expect(originalHistory).toHaveLength(1);
    const publicRecord = (await (await get(`/feedback?materiaId=${m.id}`)).json()).items[0];
    expect(publicRecord.autor).toBeNull();
    for (const activo of [false, true]) {
      expect((await request("PATCH", `/users/${author.id}/estado`, adminCookie, { activo })).status).toBe(200);
      expect(await prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toEqual(originalRecord);
      expect(await prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } })).toEqual(originalHistory);
      expect((await (await get(`/feedback?materiaId=${m.id}`)).json()).items[0]).toEqual(publicRecord);
    }
    const response = await get(`/admin/users/${author.id}/detalle`);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const detail = await response.json();
    expect(detail.registro).toMatchObject({ id: author.id, email: author.email, disabledAt: null });
    expect(detail.historial).toMatchObject({ total: 2, pageSize: 3 });
    expect(detail.historial.items.map((entry: { accion: string }) => entry.accion)).toEqual(["REACTIVACION", "DESACTIVACION"]);
    expect(detail.historial.items.every((entry: { actorId: string; createdAt: string }) => entry.actorId === admin.id && Number.isFinite(Date.parse(entry.createdAt)))).toBe(true);
    expect(JSON.stringify(detail)).not.toMatch(/passwordHash|tokenHash|refreshToken|accessToken|credential|session/i);
    expect((await get(`/admin/users/${author.id}/detalle`, "")).status).toBe(401);
    expect((await get(`/admin/users/${author.id}/detalle`, await login(author))).status).toBe(403);
  });

  it("rechaza autodesactivación, payloads adicionales e identificadores inválidos", async () => {
    expect((await request("PATCH", `/users/${admin.id}/estado`, adminCookie, { activo: false })).status).toBe(409);
    expect((await get("/auth/me")).status).toBe(200);
    const user = await account();
    for (const body of [{ activo: "false" }, { activo: false, role: "ADMIN" }, {}, { activo: 1 }]) expect((await request("PATCH", `/users/${user.id}/estado`, adminCookie, body)).status).toBe(400);
    expect((await request("PATCH", "/users/no-uuid/estado", adminCookie, { activo: false })).status).toBe(400);
    expect((await request("PATCH", `/users/${randomUUID()}/estado`, adminCookie, { activo: false })).status).toBe(404);
  });

  it("administradores que se desactivan mutuamente no pueden bloquear ambas cuentas", async () => {
    const a = await account("ADMIN"); const b = await account("ADMIN"); const cookieA = await login(a); const cookieB = await login(b);
    const responses = await Promise.all([
      request("PATCH", `/users/${b.id}/estado`, cookieA, { activo: false }),
      request("PATCH", `/users/${a.id}/estado`, cookieB, { activo: false }),
    ]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.every((response) => [200, 401, 403, 409].includes(response.status))).toBe(true);
    const stored = await prisma.user.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(stored.filter((user) => user.disabledAt === null)).toHaveLength(1);
  });

  it("Usuarios aplica nombre/email, rol y estado antes de contar y paginar", async () => {
    const tag = randomUUID(); const expected = [];
    for (let i = 0; i < 12; i++) {
      const user = await account("USER", `${tag} Pérez%_ ${i}`); expected.push(user.id);
      await request("PATCH", `/users/${user.id}/estado`, adminCookie, { activo: false });
    }
    await account("ADMIN", `${tag} Pérez%_ admin`); await account("USER", `${tag} Pérez%_ activo`); await account("USER", `${tag} PérezXY`);
    const query = new URLSearchParams({ q: `${tag} PÉREZ%_`, rol: "USER", estado: "INACTIVO", pageSize: "9" });
    const first = await (await get(`/users?${query}`)).json(); const second = await (await get(`/users?${query}&page=2`)).json();
    expect(first).toMatchObject({ total: 12, pageSize: 9, page: 1 }); expect(first.items).toHaveLength(9); expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map((row: { id: string }) => row.id))).toEqual(new Set(expected));
    expect(first.items.every((row: { disabledAt: string | null }) => typeof row.disabledAt === "string")).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/passwordHash|emailVerifiedAt/);
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: expected[0]! } })).email;
    expect((await (await get(`/users?q=${encodeURIComponent(email.toUpperCase())}`)).json()).total).toBe(1);
    for (const invalid of ["rol=ROOT", "estado=OTRO", `q=${"a".repeat(151)}`, "q=a&q=b", "q=a%00b"]) expect((await get(`/users?${invalid}`)).status).toBe(400);
  });

  it("Profesores filtra literalmente sin tildes y pagina más de 2000 resultados", async () => {
    const tag = randomUUID(); const data = Array.from({ length: 2005 }, (_, index) => ({ id: randomUUID(), nombreCompleto: `${tag} García%_ ${String(index).padStart(4, "0")}` }));
    data.forEach((row) => profesores.add(row.id)); await prisma.profesor.createMany({ data });
    const decoy = await prisma.profesor.create({ data: { nombreCompleto: `${tag} GarciaXY` } }); profesores.add(decoy.id);
    const q = encodeURIComponent(`${tag} GARCÍA%_`);
    const first = await (await get(`/profesores?q=${q}&pageSize=9`)).json(); const last = await (await get(`/profesores?q=${q}&pageSize=9&page=223`)).json();
    expect(first).toMatchObject({ total: 2005, pageSize: 9 }); expect(first.items).toHaveLength(9); expect(last.items).toHaveLength(7);
    expect(first.items[0].id).toBe(data[0]!.id); expect(last.items[6].id).toBe(data[2004]!.id);
    for (const invalid of [`q=${"a".repeat(151)}`, "q=a&q=b", "q=a%00b"]) expect((await get(`/profesores?${invalid}`)).status).toBe(400);
  });

  it("bloquea padres y docentes vinculados; la baja ordenada preserva filas, feedback y auditoría", async () => {
    const m = await materia(); const c = await cursada(m.id); const co = await comision(c.id); const p = await profesor();
    await prisma.comisionProfesor.create({ data: { comisionId: co.id, profesorId: p.id, cargo: "TITULAR" } });
    const author = await account();
    const feedback = await prisma.feedback.create({ data: { autorId: author.id, comisionId: co.id, profesorId: p.id, texto: "El comentario histórico se conserva.", anonimo: true, comisionNombre: "S-41", materiaId: m.id, materiaNombre: m.nombre, cursadaId: c.id, anio: 2026, cuatrimestre: "ANUAL", modalidad: "ANUAL", profesorNombre: p.nombreCompleto, profesorCargo: "TITULAR" } });
    const snapshot = await prisma.feedbackHistorial.create({ data: { feedbackId: feedback.id, accion: "CREACION", texto: feedback.texto, anonimo: feedback.anonimo } });
    for (const path of [`/materias/${m.id}`, `/cursadas/${c.id}`, `/profesores/${p.id}`]) expect((await request("DELETE", path)).status).toBe(409);
    expect((await request("DELETE", `/comisiones/${co.id}`)).status).toBe(204);
    expect((await prisma.comision.findUniqueOrThrow({ where: { id: co.id } })).deletedAt).toBeInstanceOf(Date);
    expect((await prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).texto).toBe("El comentario histórico se conserva.");
    const feed = await (await get(`/feedback?materiaId=${m.id}`)).json();
    expect(feed).toMatchObject({ total: 1 }); expect(feed.items[0]).toMatchObject({ id: feedback.id, texto: "El comentario histórico se conserva.", autor: null });
    expect((await get(`/cursadas/${c.id}/comisiones`)).status).toBe(200);
    expect((await (await get(`/cursadas/${c.id}/comisiones`)).json()).total).toBe(0);
    for (const path of [`/profesores/${p.id}`, `/cursadas/${c.id}`, `/materias/${m.id}`]) expect((await request("DELETE", path)).status).toBe(204);
    expect((await prisma.profesor.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).toBeInstanceOf(Date);
    expect((await prisma.cursada.findUniqueOrThrow({ where: { id: c.id } })).deletedAt).toBeInstanceOf(Date);
    expect((await prisma.materia.findUniqueOrThrow({ where: { id: m.id } })).deletedAt).toBeInstanceOf(Date);
    expect((await request("DELETE", `/comisiones/${co.id}/profesores/${p.id}`)).status).toBe(404);
    expect(await prisma.comisionProfesor.findUnique({ where: { comisionId_profesorId: { comisionId: co.id, profesorId: p.id } } })).toMatchObject({ cargo: "TITULAR" });
    expect(await prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toEqual(feedback);
    expect(await prisma.feedbackHistorial.findUniqueOrThrow({ where: { id: snapshot.id } })).toEqual(snapshot);
    const historical = await (await get(`/admin/comisiones/${co.id}/detalle`)).json();
    expect(historical.registro).toMatchObject({ id: co.id, deletedAt: expect.any(String), activa: false, profesores: [{ id: p.id, nombreCompleto: p.nombreCompleto, cargo: "TITULAR" }] });
    expect((await (await get(`/feedback?materiaId=${m.id}`)).json()).items[0]).toMatchObject({ id: feedback.id, texto: feedback.texto, autor: null, profesor: { nombreCompleto: p.nombreCompleto, cargo: "TITULAR" } });
    for (const path of [`/profesores/${p.id}/historial`, `/cursadas/${c.id}/historial`, `/comisiones/${co.id}/historial`, `/materias/${m.id}/historial`]) {
      const response = await get(path); expect(response.status).toBe(200); const history = await response.json();
      // Los intentos bloqueados se agregan al ledger, pero MateriaHistorial conserva cambios de datos.
      expect(history).toMatchObject({ pageSize: 3, total: path.startsWith("/profesores/") || path.startsWith("/cursadas/") ? 2 : 1 });
      expect(history.items[0].cambios).toContainEqual(expect.objectContaining({ campo: "deletedAt", anterior: null, nuevo: expect.any(String) }));
    }
    expect((await request("DELETE", `/comisiones/${co.id}`)).status).toBe(404);
  });

  it("las cuatro bajas exigen ADMIN y no registran resultados ficticios por falta de permisos", async () => {
    const ordinary = await account(); const cookie = await login(ordinary);
    const m = await materia(); const p = await profesor(); const c = await cursada(m.id); const co = await comision(c.id);
    for (const path of [`/materias/${m.id}`, `/profesores/${p.id}`, `/cursadas/${c.id}`, `/comisiones/${co.id}`]) {
      expect((await request("DELETE", path, "")).status).toBe(401);
      expect((await request("DELETE", path, cookie)).status).toBe(403);
    }
    expect(await prisma.administracionHistorial.count({ where: { entidadId: { in: [m.id, p.id, c.id, co.id] } } })).toBe(0);
    expect((await prisma.comision.findUniqueOrThrow({ where: { id: co.id } })).deletedAt).toBeNull();
  });

  it("persiste bloqueos con motivo, actor y fecha sin falsear la última modificación ni la baja", async () => {
    const m = await materia(); const c = await cursada(m.id); const co = await comision(c.id); const p = await profesor();
    await prisma.comisionProfesor.create({ data: { comisionId: co.id, profesorId: p.id, cargo: "TITULAR" } });
    const cases = [["materias", "materia", m.id], ["cursadas", "cursada", c.id], ["profesores", "profesor", p.id]] as const;
    for (const [kind, entity, id] of cases) {
      const before = await (await get(`/admin/${kind}/${id}/detalle`)).json();
      const response = await request("DELETE", `/${kind}/${id}`);
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.message).toMatch(/períodos|cursadas|comisiones|asignad|desvincul/i);
      expect(body.message).not.toMatch(/constraint|foreign key|internal server/i);
      const event = await prisma.administracionHistorial.findFirstOrThrow({ where: { entidad: entity, entidadId: id } });
      expect(event).toMatchObject({ actorId: admin.id, accion: "BAJA_BLOQUEADA", createdAt: expect.any(Date) });
      expect(event.cambios).toEqual(expect.arrayContaining([{ campo: "resultado", anterior: null, nuevo: "BLOQUEADA" }, { campo: "motivo", anterior: null, nuevo: body.message }]));
      const after = await (await get(`/admin/${kind}/${id}/detalle`)).json();
      expect(after.registro.deletedAt).toBeNull();
      expect(after.auditoria).toEqual(before.auditoria);
      expect(after.historial).toMatchObject({ total: 1, pageSize: 3 });
      expect(after.historial.items[0]).toMatchObject({ actorId: admin.id, accion: "BAJA_BLOQUEADA", cambios: event.cambios });
    }
    expect(await prisma.comisionProfesor.count({ where: { comisionId: co.id, profesorId: p.id } })).toBe(1);
  });

  it("bajas sin dependencias registran éxito y excluyen los registros de nuevas operaciones", async () => {
    const m = await materia(); const p = await profesor(); const parent = await materia();
    const c = await cursada(parent.id); const active = await cursada(m.id); const co = await comision(active.id);
    // La materia a eliminar debe carecer de períodos vigentes: usamos otra materia independiente.
    const empty = await materia();
    for (const [kind, entity, id] of [["materias", "materia", empty.id], ["profesores", "profesor", p.id], ["cursadas", "cursada", c.id], ["comisiones", "comision", co.id]] as const) {
      expect((await request("DELETE", `/${kind}/${id}`)).status).toBe(204);
      const detailResponse = await get(`/admin/${kind}/${id}/detalle`);
      expect(detailResponse.status).toBe(200);
      const detail = await detailResponse.json();
      expect(detail.registro).toMatchObject({ id, deletedAt: expect.any(String) });
      expect(detail.auditoria).toMatchObject({ deletedAt: detail.registro.deletedAt, deletedBy: admin.id });
      expect(detail.historial).toMatchObject({ total: 1, pageSize: 3 });
      expect(detail.historial.items[0]).toMatchObject({ actorId: admin.id, accion: "ELIMINACION" });
      expect(detail.historial.items[0].cambios).toContainEqual({ campo: "resultado", anterior: null, nuevo: "EXITOSA" });
      expect(await prisma.administracionHistorial.count({ where: { entidad: entity, entidadId: id, accion: "ELIMINACION" } })).toBe(1);
      expect((await request("PATCH", `/${kind}/${id}`, adminCookie, kind === "materias" ? { nombre: "No se cambia" } : kind === "profesores" ? { nombreCompleto: "No se cambia" } : kind === "cursadas" ? { anio: 2027 } : { numero: 42 })).status).toBe(404);
    }
    expect((await (await get(`/materias?q=${encodeURIComponent(empty.nombre)}`)).json()).total).toBe(0);
    expect((await (await get(`/profesores?q=${encodeURIComponent(p.nombreCompleto)}`)).json()).total).toBe(0);
    expect((await (await get(`/materias/${parent.id}/cursadas`)).json()).total).toBe(0);
    expect((await (await get(`/cursadas/${active.id}/comisiones`)).json()).total).toBe(0);
    expect((await request("POST", "/cursadas", adminCookie, { materiaId: empty.id, anio: 2027, cuatrimestre: "ANUAL" })).status).toBe(404);
    expect((await request("POST", "/comisiones", adminCookie, { cursadaId: c.id, carrera: "S", numero: 42 })).status).toBe(404);
    const fresh = await comision(active.id);
    expect((await request("PUT", `/comisiones/${fresh.id}/profesores/${p.id}`, adminCookie, { cargo: "TITULAR" })).status).toBe(404);
    const author = await account(); const authorCookie = await login(author);
    expect((await request("POST", `/comisiones/${co.id}/feedback`, authorCookie, { texto: "No debe publicarse bajo una comisión de baja", anonimo: true })).status).toBe(404);
  });

  it("quitar una asignación conserva al profesor activo y registra una desvinculación independiente", async () => {
    const m = await materia(); const c = await cursada(m.id); const co = await comision(c.id); const p = await profesor();
    await prisma.comisionProfesor.create({ data: { comisionId: co.id, profesorId: p.id, cargo: "ADJUNTO" } });
    expect((await request("DELETE", `/comisiones/${co.id}/profesores/${p.id}`)).status).toBe(204);
    expect((await prisma.profesor.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).toBeNull();
    expect(await prisma.comisionProfesor.count({ where: { comisionId: co.id, profesorId: p.id } })).toBe(0);
    expect(await prisma.administracionHistorial.findFirst({ where: { entidad: "comision", entidadId: co.id } })).toMatchObject({ accion: "DESVINCULACION", actorId: admin.id });
    expect(await prisma.administracionHistorial.count({ where: { entidad: "profesor", entidadId: p.id } })).toBe(0);
  });

  it("asignación y baja concurrentes no dejan un profesor dado de baja en una comisión vigente", async () => {
    const m = await materia(); const c = await cursada(m.id); const co = await comision(c.id); const p = await profesor();
    const [assignment, deletion] = await Promise.all([
      request("PUT", `/comisiones/${co.id}/profesores/${p.id}`, adminCookie, { cargo: "TITULAR" }),
      request("DELETE", `/profesores/${p.id}`),
    ]);
    expect([200, 404]).toContain(assignment.status); expect([204, 409]).toContain(deletion.status);
    const stored = await prisma.profesor.findUniqueOrThrow({ where: { id: p.id } });
    const links = await prisma.comisionProfesor.count({ where: { profesorId: p.id, comision: { deletedAt: null } } });
    expect(stored.deletedAt === null || links === 0).toBe(true);
    const event = await prisma.administracionHistorial.findFirstOrThrow({ where: { entidad: "profesor", entidadId: p.id } });
    expect(event.accion).toBe(deletion.status === 204 ? "ELIMINACION" : "BAJA_BLOQUEADA");
  });

  it("audita únicamente ediciones reales y permite reutilizar claves tras una baja", async () => {
    const p = await profesor();
    const patch = (nombreCompleto: string) => request("PATCH", `/profesores/${p.id}`, adminCookie, { nombreCompleto });
    for (const nombre of ["Nombre uno", "Nombre uno", "Nombre dos", "Nombre tres", "Nombre cuatro"]) expect((await patch(nombre)).status).toBe(200);
    const first = await (await get(`/profesores/${p.id}/historial`)).json(); const second = await (await get(`/profesores/${p.id}/historial?page=2`)).json();
    expect(first).toMatchObject({ total: 4, pageSize: 3 }); expect(first.items).toHaveLength(3); expect(second.items).toHaveLength(1);
    const m = await materia(); expect((await request("DELETE", `/materias/${m.id}`)).status).toBe(204);
    const recreated = await request("POST", "/materias", adminCookie, { nombre: m.nombre, modalidad: "ANUAL", carreras: [{ carrera: "S", anioCarrera: "4" }] });
    expect(recreated.status).toBe(201); const row = await recreated.json(); materias.add(row.id); expect(row.id).not.toBe(m.id);
  });

  it("concurrencia alta de cursada frente a baja no deja un hijo vigente bajo materia eliminada", async () => {
    const m = await materia();
    const [creation, deletion] = await Promise.all([request("POST", "/cursadas", adminCookie, { materiaId: m.id, anio: 2026, cuatrimestre: "ANUAL" }), request("DELETE", `/materias/${m.id}`)]);
    if (creation.status === 201) { const row = await creation.json(); cursadas.add(row.id); }
    expect([201, 404, 409]).toContain(creation.status); expect([204, 409]).toContain(deletion.status);
    const parent = await prisma.materia.findUniqueOrThrow({ where: { id: m.id } });
    const childCount = await prisma.cursada.count({ where: { materiaId: m.id, deletedAt: null } });
    expect(parent.deletedAt === null || childCount === 0).toBe(true);
  });

  it("las claves de período y comisión se pueden reutilizar después de bajas lógicas", async () => {
    const m = await materia(); const original = await cursada(m.id); const co = await comision(original.id);
    expect((await request("DELETE", `/comisiones/${co.id}`)).status).toBe(204);
    const replacement = await request("POST", "/comisiones", adminCookie, { cursadaId: original.id, carrera: "S", numero: 41 });
    expect(replacement.status).toBe(201); const created = await replacement.json(); comisiones.add(created.id); expect(created.id).not.toBe(co.id);
    expect((await request("DELETE", `/comisiones/${created.id}`)).status).toBe(204);
    expect((await request("DELETE", `/cursadas/${original.id}`)).status).toBe(204);
    const next = await request("POST", "/cursadas", adminCookie, { materiaId: m.id, anio: 2026, cuatrimestre: "ANUAL" });
    expect(next.status).toBe(201); const row = await next.json(); cursadas.add(row.id); expect(row.id).not.toBe(original.id);
  });
});
