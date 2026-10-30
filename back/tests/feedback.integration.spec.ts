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
interface PublicFeedback {
  id: string; texto: string; anonimo: boolean; propio: boolean;
  autor: { displayName: string } | null;
  profesor: { id: string; nombreCompleto: string; cargo: string } | null;
  contexto: { comisionId: string; nombre: string; materiaId: string; materiaNombre: string; cursadaId: string; anio: number; cuatrimestre: string | null; modalidad: string | null };
  createdAt: string; updatedAt: string;
}

describe.skipIf(!databaseUrl)("Feedback por comisión: HTTP y PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;
  let autor: { id: string; cookie: string };
  let otro: { id: string; cookie: string };
  let admin: { id: string; cookie: string };
  const ids = { users: [] as string[], materias: [] as string[], profesores: [] as string[], cursadas: [] as string[], comisiones: [] as string[] };
  const config = testAuthConfig();
  const password = "feedback integration password";
  const request = (path: string, method = "GET", body?: unknown, cookie?: string) => fetch(`${baseUrl}${path}`, {
    method, headers: { ...(method === "GET" ? {} : csrfHeaders), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function account(role: "USER" | "ADMIN", displayName: string) {
    const email = `feedback-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const registered = await request("/auth/register", "POST", { email, displayName, password });
    expect(registered.status).toBe(201);
    const user = await registered.json() as { id: string };
    ids.users.push(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { role, emailVerifiedAt: new Date() } });
    const logged = await request("/auth/login", "POST", { email, password });
    expect(logged.status).toBe(200);
    return { id: user.id, cookie: logged.headers.get("set-cookie")!.split(";")[0]! };
  }
  async function fixture(professors = 1, anio = 2026) {
    const materia = await prisma.materia.create({ data: { nombre: `Feedback ${randomUUID()}`, carreras: { create: { carrera: "S", anioCarrera: "1" } } } });
    ids.materias.push(materia.id);
    const cursada = await prisma.cursada.create({ data: { materiaId: materia.id, anio, cuatrimestre: "PRIMERO" } });
    ids.cursadas.push(cursada.id);
    const comision = await prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero: 31 } });
    ids.comisiones.push(comision.id);
    const docentes: { id: string; nombreCompleto: string }[] = [];
    for (let index = 0; index < professors; index++) {
      const profesor = await prisma.profesor.create({ data: { nombreCompleto: `Docente ${index} ${randomUUID()}` } });
      ids.profesores.push(profesor.id);
      docentes.push(profesor);
      await prisma.comisionProfesor.create({ data: { comisionId: comision.id, profesorId: profesor.id, cargo: index === 0 ? "TITULAR" : "JTP" } });
    }
    return { materia, cursada, comision, docentes, path: `/comisiones/${comision.id}/feedback` };
  }
  async function publish(path: string, cookie = autor.cookie, body: unknown = { texto: "Buena explicación y ejemplos.", anonimo: true }) {
    const response = await request(path, "POST", body, cookie);
    expect(response.status, await response.clone().text()).toBe(201);
    return await response.json() as PublicFeedback;
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
    autor = await account("USER", "Autor confidencial");
    otro = await account("USER", "Otra persona");
    admin = await account("ADMIN", "Administrador");
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      // Only fixtures owned by this suite are removed; never reset a shared database.
      await prisma.feedbackHistorial.deleteMany({ where: { feedback: { comisionId: { in: ids.comisiones } } } });
      await prisma.feedback.deleteMany({ where: { comisionId: { in: ids.comisiones } } });
      await prisma.comisionProfesor.deleteMany({ where: { comisionId: { in: ids.comisiones } } });
      await prisma.comision.deleteMany({ where: { id: { in: ids.comisiones } } });
      await prisma.cursada.deleteMany({ where: { id: { in: ids.cursadas } } });
      await prisma.materiaCarrera.deleteMany({ where: { materiaId: { in: ids.materias } } });
      await prisma.materia.deleteMany({ where: { id: { in: ids.materias } } });
      await prisma.profesor.deleteMany({ where: { id: { in: ids.profesores } } });
      await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: ids.users } } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids.users } } });
      await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: ids.users } } });
      await prisma.administracionHistorial.deleteMany({ where: { actorId: { in: ids.users } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it("protege detalle y auditoría administrativos aun frente al autor y no expone secretos", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    const path = `/admin/feedback/${created.id}/detalle`;
    expect((await request(path)).status).toBe(401);
    expect((await request(path, "GET", undefined, autor.cookie)).status).toBe(403);
    expect((await request(path, "GET", undefined, otro.cookie)).status).toBe(403);
    const response = await request(path, "GET", undefined, admin.cookie);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.registro.texto).toBe(created.texto);
    expect(body.auditoria.id).toBe(created.id);
    expect(body.historial.items.some((event: { accion: string }) => event.accion === "CREACION")).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|refreshToken|accessToken|tokenHash|passwordResetCredentials|sessions/);
    const userDetail = await request(`/admin/users/${autor.id}/detalle`, "GET", undefined, admin.cookie);
    expect(userDetail.status).toBe(200);
    expect(JSON.stringify(await userDetail.json())).not.toMatch(/password|Hash|token|credential|sessions/i);
    expect((await request(`/feedback/${created.id}/historial`, "GET", undefined, otro.cookie)).status).toBe(403);
    // El feed paginado posterior parte vacío; retirar sólo el comentario de este caso.
    expect((await request(`/feedback/${created.id}`, "DELETE", undefined, autor.cookie)).status).toBe(204);
  });

  it("exige sesión, cuerpo válido y CSRF", async () => {
    const f = await fixture();
    expect((await request(f.path)).status).toBe(401);
    expect((await request(f.path, "POST", { texto: "Bien", anonimo: true })).status).toBe(401);
    expect((await request(f.path, "POST", { texto: "Bien", anonimo: true, autorId: otro.id }, autor.cookie)).status).toBe(400);
    const response = await fetch(`${baseUrl}${f.path}`, { method: "POST", headers: { Cookie: autor.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ texto: "Bien", anonimo: true }) });
    expect(response.status).toBe(403);
  });

  // TASK-061: the general feed exposes the same public snapshots across commissions.
  it("publica en una materia anual y conserva la modalidad original al cambiar la materia", async () => {
    const f = await fixture(0);
    await prisma.materia.update({ where: { id: f.materia.id }, data: { modalidad: "ANUAL" } });
    await prisma.cursada.update({ where: { id: f.cursada.id }, data: { cuatrimestre: "ANUAL" } });
    const created = await publish(f.path, autor.cookie, { texto: "Cursada anual", anonimo: true });
    expect(created.contexto).toMatchObject({ anio: 2026, modalidad: "ANUAL", cuatrimestre: null });
    await prisma.materia.update({ where: { id: f.materia.id }, data: { modalidad: "SEGUNDO" } });
    const read = await (await request(`/feedback/${created.id}`, "GET", undefined, autor.cookie)).json();
    expect(read.contexto).toMatchObject({ modalidad: "ANUAL", cuatrimestre: null });
    await request(`/feedback/${created.id}`, "DELETE", undefined, autor.cookie);
  });
  it("GET /feedback exige sesión y pagina nueve experiencias no eliminadas sin exponer autoría privada", async () => {
    expect((await request("/feedback")).status).toBe(401);
    const baselineResponse = await request("/feedback", "GET", undefined, otro.cookie);
    expect(baselineResponse.status).toBe(200);
    const baseline = await baselineResponse.json();
    expect(baseline.total).toBe(0);
    const created: PublicFeedback[] = [];
    let historic: PublicFeedback | undefined;
    for (let index = 0; index < 4; index++) {
      const f = await fixture(0, index === 0 ? 2023 : 2026);
      for (const user of [autor, otro, admin]) {
        const feedback = await publish(f.path, user.cookie, { texto: `Experiencia ${index} ${user.id}`, anonimo: user !== admin });
        created.push(feedback);
        await prisma.feedback.update({ where: { id: feedback.id }, data: { createdAt: new Date("2026-01-01T12:00:00.000Z") } });
      }
      if (index === 0) {
        historic = created[0];
        await prisma.comision.update({ where: { id: f.comision.id }, data: { activa: false } });
        await prisma.materia.update({ where: { id: f.materia.id }, data: { nombre: `Renombrada ${randomUUID()}` } });
      }
    }
    const removed = created.at(-1)!;
    expect((await request(`/feedback/${removed.id}`, "DELETE", undefined, admin.cookie)).status).toBe(204);
    const first = await (await request("/feedback", "GET", undefined, otro.cookie)).json();
    const second = await (await request("/feedback?page=2", "GET", undefined, otro.cookie)).json();
    expect(first).toMatchObject({ total: 11, page: 1, pageSize: 9 });
    expect(second).toMatchObject({ total: 11, page: 2, pageSize: 9 });
    expect(first.items).toHaveLength(9);
    expect(second.items).toHaveLength(2);
    const all = [...first.items, ...second.items] as PublicFeedback[];
    const expectedIds = created.filter(row => row.id !== removed.id).map(row => row.id).sort().reverse();
    expect(all.map(row => row.id)).toEqual(expectedIds);
    expect(new Set(all.map(row => row.id)).size).toBe(11);
    expect(all.find(row => row.id === historic!.id)?.contexto).toEqual(historic!.contexto);
    expect(all.find(row => row.id === historic!.id)?.contexto.anio).toBe(2023);
    expect(all.some(row => row.propio)).toBe(true);
    expect(all.some(row => !row.propio)).toBe(true);
    for (const row of all) {
      expect(row).not.toHaveProperty("autorId");
      expect(row).not.toHaveProperty("email");
      expect(row).not.toHaveProperty("historial");
      if (row.anonimo) expect(row.autor).toBeNull();
    }
    expect((await request(`/feedback/${historic!.id}`, "GET", undefined, otro.cookie)).status).toBe(403);
    expect((await request("/feedback?pageSize=10", "GET", undefined, otro.cookie)).status).toBe(400);
  });

  it("filtra por carrera de la comisión y materia compartida antes de paginar con orden estable", async () => {
    const f = await fixture(0);
    await prisma.materiaCarrera.create({ data: { materiaId: f.materia.id, carrera: "I", anioCarrera: "2" } });
    const industrial = await prisma.comision.create({ data: { cursadaId: f.cursada.id, carrera: "I", numero: 41 } });
    ids.comisiones.push(industrial.id);
    await publish(`/comisiones/${industrial.id}/feedback`);
    const created: PublicFeedback[] = [];
    for (let index = 0; index < 11; index++) {
      const commission = await prisma.comision.create({ data: { cursadaId: f.cursada.id, carrera: "S", numero: index + 50 } });
      ids.comisiones.push(commission.id);
      created.push(await publish(`/comisiones/${commission.id}/feedback`));
    }
    const removed = created.pop()!;
    await request(`/feedback/${removed.id}`, "DELETE", undefined, autor.cookie);
    await prisma.feedback.updateMany({ where: { materiaId: f.materia.id }, data: { createdAt: new Date("2026-01-01") } });
    const read = async (query: string) => {
      const response = await request(`/feedback?${query}`, "GET", undefined, autor.cookie);
      expect(response.status).toBe(200);
      return response.json();
    };
    const first = await read(`materiaId=${f.materia.id}&carrera=S`);
    const second = await read(`materiaId=${f.materia.id}&carrera=S&page=2`);
    expect(first).toMatchObject({ total: 10, page: 1, pageSize: 9 });
    expect(second).toMatchObject({ total: 10, page: 2, pageSize: 9 });
    expect([...first.items, ...second.items].map((row: PublicFeedback) => row.id))
      .toEqual(created.map(row => row.id).sort().reverse());
    expect(first.items.every((row: { contexto: { carrera: string } }) => row.contexto.carrera === "S")).toBe(true);
    expect((await read(`materiaId=${f.materia.id}&carrera=I`)).total).toBe(1);
    expect((await read(`materiaId=${f.materia.id}`)).total).toBe(11);
    expect((await read(`materiaId=${f.materia.id}&carrera=Q`)).total).toBe(0);
    const careerOnly = await read("carrera=I");
    expect(careerOnly.items.every((row: { contexto: { carrera: string } }) => row.contexto.carrera === "I")).toBe(true);
    expect((await request("/feedback?carrera=X", "GET", undefined, autor.cookie)).status).toBe(400);
    expect((await request("/feedback?materiaId=invalid", "GET", undefined, autor.cookie)).status).toBe(400);
  });

  it("separa experiencias por comisión y período real aunque la materia tenga otra modalidad", async () => {
    const f = await fixture(0);
    await prisma.materia.update({ where: { id: f.materia.id }, data: { modalidad: "ANUAL" } });
    const second = await prisma.cursada.create({ data: { materiaId: f.materia.id, anio: 2026, cuatrimestre: "SEGUNDO" } });
    ids.cursadas.push(second.id);
    const commission = await prisma.comision.create({ data: { cursadaId: second.id, carrera: "S", numero: 31 } });
    ids.comisiones.push(commission.id);
    const firstFeedback = await publish(f.path);
    const secondFeedback = await publish(`/comisiones/${commission.id}/feedback`);
    expect(firstFeedback.contexto).toMatchObject({ cursadaId: f.cursada.id, modalidad: "PRIMERO", cuatrimestre: "PRIMERO" });
    expect(secondFeedback.contexto).toMatchObject({ cursadaId: second.id, modalidad: "SEGUNDO", cuatrimestre: "SEGUNDO" });
    expect(firstFeedback.id).not.toBe(secondFeedback.id);
    const read = await (await request(f.path, "GET", undefined, autor.cookie)).json();
    expect(read.total).toBe(1);
    expect(read.items[0].id).toBe(firstFeedback.id);
    const legacy = await prisma.cursada.create({ data: { materiaId: f.materia.id, anio: 2025, cuatrimestre: null } });
    ids.cursadas.push(legacy.id);
    const legacyCommission = await prisma.comision.create({ data: { cursadaId: legacy.id, carrera: "S", numero: 31 } });
    ids.comisiones.push(legacyCommission.id);
    const legacyFeedback = await publish(`/comisiones/${legacyCommission.id}/feedback`);
    expect(legacyFeedback.contexto).toMatchObject({ cursadaId: legacy.id, modalidad: null, cuatrimestre: null });
  });

  it("publica inmediatamente y asocia al único docente sin exponer identidad anónima", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    expect(created).toMatchObject({ texto: "Buena explicación y ejemplos.", anonimo: true, propio: true, autor: null, profesor: { id: f.docentes[0].id, cargo: "TITULAR" }, contexto: { comisionId: f.comision.id, anio: 2026, nombre: "S-31" } });
    for (const cookie of [otro.cookie, admin.cookie]) {
      const response = await request(`/feedback/${created.id}`, "GET", undefined, cookie);
      // TASK-059: detail is private; authenticated readers use the commission list.
      expect(response.status).toBe(403);
      const listing = await request(f.path, "GET", undefined, cookie);
      expect(listing.status).toBe(200);
      const publicBody = (await listing.json()).items[0];
      expect(publicBody).toMatchObject({ propio: false, autor: null });
      expect(JSON.stringify(publicBody)).not.toContain(autor.id);
      expect(JSON.stringify(publicBody)).not.toContain("Autor confidencial");
      expect(publicBody).not.toHaveProperty("autorId");
      expect(publicBody).not.toHaveProperty("email");
    }
    const owned = await request(`/feedback/${created.id}`, "GET", undefined, autor.cookie);
    expect(owned.status).toBe(200);
    expect(await owned.json()).toMatchObject({ id: created.id, propio: true, autor: null });
    const page = await (await request(f.path, "GET", undefined, otro.cookie)).json();
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 9 });
    expect(page.items[0].id).toBe(created.id);
  });

  it("una sola publicación vigente por usuario/comisión incluso con anonimato o docente diferente", async () => {
    const f = await fixture(2);
    await publish(f.path, autor.cookie, { texto: "Primero", anonimo: false, profesorId: f.docentes[0].id });
    expect((await request(f.path, "POST", { texto: "Segundo", anonimo: true, profesorId: f.docentes[1].id }, autor.cookie)).status).toBe(409);
    await publish(f.path, otro.cookie);
    const own = await (await request(`${f.path}/propio`, "GET", undefined, autor.cookie)).json();
    expect(own.texto).toBe("Primero");
  });

  it("dos publicaciones concurrentes del mismo usuario producen un 201 y un 409", async () => {
    const f = await fixture();
    const results = await Promise.all([1, 2].map((n) => request(f.path, "POST", { texto: `Experiencia ${n}`, anonimo: true }, autor.cookie)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const page = await (await request(f.path, "GET", undefined, autor.cookie)).json();
    expect(page.total).toBe(1);
  });

  it("varios docentes permiten seleccionar uno o feedback general; rechaza docente ajeno", async () => {
    const f = await fixture(2);
    const ajeno = await fixture();
    expect((await request(f.path, "POST", { texto: "Bien", anonimo: true, profesorId: ajeno.docentes[0].id }, autor.cookie)).status).toBe(400);
    expect((await publish(f.path, autor.cookie, { texto: "Comisión en general", anonimo: false, profesorId: null })).profesor).toBeNull();
    const directed = await publish(f.path, otro.cookie, { texto: "Muy claro", anonimo: false, profesorId: f.docentes[1].id });
    expect(directed.profesor?.id).toBe(f.docentes[1].id);
    expect(directed.autor).toEqual({ displayName: "Otra persona" });
  });

  it("sin docentes se puede publicar una experiencia general", async () => {
    const f = await fixture(0);
    expect((await publish(f.path)).profesor).toBeNull();
  });

  it("solo el autor edita y el historial privado no se amplía para ADMIN", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    for (const cookie of [otro.cookie, admin.cookie]) {
      expect((await request(`/feedback/${created.id}`, "PATCH", { texto: "Manipulado" }, cookie)).status).toBe(403);
      // TASK-feedback-removal-permissions: ADMIN ahora puede eliminar; tercero USER sigue bloqueado.
      if (cookie === otro.cookie) expect((await request(`/feedback/${created.id}`, "DELETE", undefined, cookie)).status).toBe(403);
      expect((await request(`/feedback/${created.id}/historial`, "GET", undefined, cookie)).status).toBe(403);
    }
    const changed = await request(`/feedback/${created.id}`, "PATCH", { texto: "Explica con ejemplos", anonimo: false }, autor.cookie);
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ texto: "Explica con ejemplos", anonimo: false, autor: { displayName: "Autor confidencial" } });
    const before = await (await request(`/feedback/${created.id}/historial`, "GET", undefined, autor.cookie)).json();
    expect(before).toMatchObject({ total: 2, pageSize: 3 });
    expect((await request(`/feedback/${created.id}`, "PATCH", { texto: "Explica con ejemplos" }, autor.cookie)).status).toBe(200);
    const after = await (await request(`/feedback/${created.id}/historial`, "GET", undefined, autor.cookie)).json();
    expect(after.total).toBe(2);
    expect((await request(`/feedback/${created.id}`, "PATCH", { profesorId: f.docentes[0].id }, autor.cookie)).status).toBe(400);
  });

  it("eliminar conserva auditoría, oculta la publicación y permite republicar", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    expect((await request(`/feedback/${created.id}`, "DELETE", undefined, autor.cookie)).status).toBe(204);
    expect((await request(`/feedback/${created.id}`, "GET", undefined, autor.cookie)).status).toBe(404);
    expect(await (await request(`${f.path}/propio`, "GET", undefined, autor.cookie)).json()).toBeNull();
    const history = await (await request(`/feedback/${created.id}/historial`, "GET", undefined, autor.cookie)).json();
    expect(history.items.map((event: { accion: string }) => event.accion)).toEqual(["ELIMINACION", "CREACION"]);
    const again = await publish(f.path);
    expect(again.id).not.toBe(created.id);
    expect((await (await request(f.path, "GET", undefined, autor.cookie)).json()).total).toBe(1);
  });

  it("ADMIN elimina un comentario ajeno anónimo y registra su identidad real sin alterar snapshots", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    const before = await prisma.feedback.findUniqueOrThrow({ where: { id: created.id } });
    expect((await request(`/feedback/${created.id}`, "DELETE", undefined, admin.cookie)).status).toBe(204);
    const after = await prisma.feedback.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.deletedAt).not.toBeNull();
    for (const key of ["autorId", "texto", "anonimo", "comisionId", "materiaId", "materiaNombre", "profesorId", "profesorNombre", "profesorCargo", "cursadaId", "anio", "cuatrimestre", "modalidad"] as const) expect(after[key]).toEqual(before[key]);
    const removed = await prisma.administracionHistorial.findMany({ where: { entidad: "feedback", entidadId: created.id, accion: "ELIMINACION" } });
    expect(removed).toHaveLength(1);
    expect(removed[0]!.actorId).toBe(admin.id);
    const snapshot = await prisma.feedbackHistorial.findUniqueOrThrow({ where: { id: removed[0]!.id } });
    expect(snapshot).toMatchObject({ feedbackId: created.id, accion: "ELIMINACION", texto: created.texto, anonimo: true });
    const auditResponse = await request(`/admin/feedback/${created.id}/detalle`, "GET", undefined, admin.cookie);
    expect(auditResponse.status).toBe(200);
    const audit = await auditResponse.json();
    expect(audit.auditoria).toMatchObject({ deletedBy: admin.id, deletedByName: "Administrador", updatedBy: admin.id });
    expect(audit.historial.items[0]).toMatchObject({ actorId: admin.id, actorName: "Administrador", accion: "ELIMINACION" });
    const feed = await (await request(f.path, "GET", undefined, otro.cookie)).json();
    expect(feed.items.some((entry: { id: string }) => entry.id === created.id)).toBe(false);
    expect((await request(`/feedback/${created.id}`, "DELETE", undefined, admin.cookie)).status).toBe(404);
    expect(await prisma.administracionHistorial.count({ where: { entidadId: created.id, accion: "ELIMINACION" } })).toBe(1);
  });

  it("ADMIN elimina su publicación propia y un comentario de una comisión inactiva", async () => {
    const own = await fixture(0);
    const createdOwn = await publish(own.path, admin.cookie);
    expect((await request(`/feedback/${createdOwn.id}`, "DELETE", undefined, admin.cookie)).status).toBe(204);
    const inactive = await fixture();
    const createdOther = await publish(inactive.path);
    await prisma.comision.update({ where: { id: inactive.comision.id }, data: { activa: false } });
    expect((await request(`/feedback/${createdOther.id}`, "DELETE", undefined, admin.cookie)).status).toBe(204);
    expect(await prisma.comisionProfesor.count({ where: { comisionId: inactive.comision.id } })).toBe(1);
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: createdOther.id } })).toBe(2);
  });

  it("la eliminación exige sesión y CSRF e ignora cualquier pretensión de rol desde el cliente", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    const path = `/feedback/${created.id}`;
    expect((await request(path, "DELETE")).status).toBe(401);
    const noCsrf = await fetch(`${baseUrl}${path}`, { method: "DELETE", headers: { Cookie: admin.cookie, "Content-Type": "application/json" } });
    expect(noCsrf.status).toBe(403);
    expect((await request(`${path}?role=ADMIN`, "DELETE", { role: "ADMIN", autorId: autor.id }, otro.cookie)).status).toBe(403);
    expect((await prisma.feedback.findUniqueOrThrow({ where: { id: created.id } })).deletedAt).toBeNull();
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: created.id, accion: "ELIMINACION" } })).toBe(0);
  });

  it("eliminaciones simultáneas de autor y ADMIN generan un único evento y un actor real", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    const results = await Promise.all([request(`/feedback/${created.id}`, "DELETE", undefined, autor.cookie), request(`/feedback/${created.id}`, "DELETE", undefined, admin.cookie)]);
    expect(results.map(response => response.status).sort()).toEqual([204, 404]);
    const events = await prisma.administracionHistorial.findMany({ where: { entidadId: created.id, accion: "ELIMINACION" } });
    expect(events).toHaveLength(1);
    expect([autor.id, admin.id]).toContain(events[0]!.actorId);
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: created.id, accion: "ELIMINACION" } })).toBe(1);
  });

  it("inactiva cierra altas y ediciones pero permite retirar", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    await prisma.comision.update({ where: { id: f.comision.id }, data: { activa: false } });
    expect((await request(f.path, "POST", { texto: "Nueva", anonimo: true }, otro.cookie)).status).toBe(409);
    expect((await request(`/feedback/${created.id}`, "PATCH", { texto: "Cambio tardio" }, autor.cookie)).status).toBe(409);
    expect((await request(`/feedback/${created.id}`, "DELETE", undefined, autor.cookie)).status).toBe(204);
  });

  it("conserva docente, cargo, materia y período originales tras reasignaciones y edición de texto", async () => {
    const f = await fixture(1, 2024);
    const created = await publish(f.path);
    await prisma.comisionProfesor.deleteMany({ where: { comisionId: f.comision.id } });
    await prisma.profesor.update({ where: { id: f.docentes[0].id }, data: { nombreCompleto: "Nombre modificado" } });
    await prisma.materia.update({ where: { id: f.materia.id }, data: { nombre: `Renombrada ${randomUUID()}` } });
    const edited = await request(`/feedback/${created.id}`, "PATCH", { texto: "Amplío mi experiencia" }, autor.cookie);
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ profesor: created.profesor, contexto: created.contexto });
    await prisma.comision.update({ where: { id: f.comision.id }, data: { activa: false } });
    const historic = await (await request(`/feedback/${created.id}`, "GET", undefined, autor.cookie)).json();
    expect(historic).toMatchObject({ contexto: { anio: 2024, comisionId: f.comision.id }, profesor: created.profesor });
  });

  it("página de comentarios e historial respetan máximos y orden estable", async () => {
    const f = await fixture();
    const created = await publish(f.path);
    expect((await request(`${f.path}?pageSize=10`, "GET", undefined, otro.cookie)).status).toBe(400);
    for (let index = 1; index <= 4; index++) {
      expect((await request(`/feedback/${created.id}`, "PATCH", { texto: `Revisión ${index}` }, autor.cookie)).status).toBe(200);
    }
    const first = await (await request(`/feedback/${created.id}/historial?page=1`, "GET", undefined, autor.cookie)).json();
    const second = await (await request(`/feedback/${created.id}/historial?page=2`, "GET", undefined, autor.cookie)).json();
    expect(first).toMatchObject({ total: 5, page: 1, pageSize: 3 });
    expect(first.items).toHaveLength(3);
    expect(second.items).toHaveLength(2);
    expect(first.items[0].texto).toBe("Revisión 4");
    expect(new Set([...first.items, ...second.items].map((row: { id: string }) => row.id)).size).toBe(5);
    expect((await request(`/feedback/${created.id}/historial?pageSize=4`, "GET", undefined, autor.cookie)).status).toBe(400);
  });
});
