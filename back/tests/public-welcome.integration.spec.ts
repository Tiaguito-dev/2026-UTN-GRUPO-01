import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { VERIFICATION_EMAIL } from "../src/auth/domain/email-verification.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];

describe.skipIf(!databaseUrl)("Bienvenida pública HTTP", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const materiaIds: string[] = [], cursadaIds: string[] = [], comisionIds: string[] = [], feedbackIds: string[] = [], userIds: string[] = [];
  const get = async (path: string) => fetch(`${await app.getUrl()}${path}`);

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AUTH_CONFIG).useValue(testAuthConfig())
      .overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
    app = mod.createNestApplication();
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
  }, 25_000);

  afterAll(async () => {
    try {
      if (feedbackIds.length) await prisma.feedback.deleteMany({ where: { id: { in: feedbackIds } } });
      if (comisionIds.length) await prisma.comision.deleteMany({ where: { id: { in: comisionIds } } });
      if (cursadaIds.length) await prisma.cursada.deleteMany({ where: { id: { in: cursadaIds } } });
      if (materiaIds.length) await prisma.materia.deleteMany({ where: { id: { in: materiaIds } } });
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
      await prisma?.$disconnect();
    }
  });

  async function materia(nombre: string, deletedAt?: Date) {
    const row = await prisma.materia.create({ data: { nombre, deletedAt } });
    materiaIds.push(row.id);
    return { id: row.id, nombre: row.nombre };
  }

  it("publica solo cinco experiencias vigentes de la materia elegida aunque se pidan otras páginas", async () => {
    const tag = randomUUID();
    const visible = await Promise.all([materia(`A-${tag}`), materia(`B-${tag}`)]);
    const hidden = await materia(`C-${tag}`, new Date());
    const empty = await materia(`D-${tag}`);
    const author = await prisma.user.create({ data: { email: `${tag}@example.test`, displayName: "Autor reservado", passwordHash: "fixture" } });
    userIds.push(author.id);
    const date = (minute: number) => new Date(Date.now() + minute * 60_000);
    async function cursada(materiaId: string, deletedAt?: Date) {
      const row = await prisma.cursada.create({ data: { materiaId, anio: deletedAt ? 2025 : 2026, cuatrimestre: "PRIMERO", deletedAt } });
      cursadaIds.push(row.id);
      return row;
    }
    const cursadas = await Promise.all(visible.map(({ id }) => cursada(id)));
    async function experience(subject: { id: string; nombre: string }, cursadaId: string, numero: number, createdAt: Date,
      options: { activa?: boolean; comisionDeleted?: boolean; feedbackDeleted?: boolean;
        estadoModeracion?: "APROBADO" | "PENDIENTE" | "RECHAZADO";
        ocultoAutor?: boolean; ocultoAdministracion?: boolean; ocultoReportes?: boolean } = {}) {
      const comision = await prisma.comision.create({ data: { cursadaId, carrera: "S", numero, activa: options.activa, deletedAt: options.comisionDeleted ? new Date() : null } });
      comisionIds.push(comision.id);
      const texto = `Experiencia ${numero}-${tag}`;
      const row = await prisma.feedback.create({ data: { comisionId: comision.id, autorId: author.id, texto,
        cursadaId, materiaId: hidden.id, materiaNombre: hidden.nombre, comisionNombre: `S-${numero}`, anio: 2026, anonimo: false,
        createdAt, deletedAt: options.feedbackDeleted ? new Date() : null,
        estadoModeracion: options.estadoModeracion ?? "APROBADO", ocultoAutor: options.ocultoAutor,
        motivoRechazo: options.estadoModeracion === "RECHAZADO" ? "Rechazo ficticio de prueba" : null,
        requiereRevisionHumana: options.estadoModeracion === "RECHAZADO",
        ocultoAdministracion: options.ocultoAdministracion, ocultoReportes: options.ocultoReportes } });
      feedbackIds.push(row.id);
      return { id: row.id, texto, createdAt: createdAt.toISOString(), materia: subject };
    }
    const expected = [];
    for (let i = 0; i < 7; i++) expected.unshift(await experience(visible[0]!, cursadas[0]!.id, i + 1, date(i + 1)));
    const other = await experience(visible[1]!, cursadas[1]!.id, 13, date(13));
    await experience(visible[0]!, cursadas[0]!.id, 8, date(8), { feedbackDeleted: true });
    await experience(visible[0]!, cursadas[0]!.id, 9, date(9), { activa: false });
    await experience(visible[0]!, cursadas[0]!.id, 10, date(10), { comisionDeleted: true });
    await experience(visible[0]!, (await cursada(visible[0]!.id, new Date())).id, 11, date(11));
    await experience(hidden, (await cursada(hidden.id)).id, 12, date(12));
    await experience(visible[0]!, cursadas[0]!.id, 14, date(14), { estadoModeracion: "PENDIENTE" });
    await experience(visible[0]!, cursadas[0]!.id, 15, date(15), { estadoModeracion: "RECHAZADO" });
    await experience(visible[0]!, cursadas[0]!.id, 16, date(16), { ocultoAutor: true });
    await experience(visible[0]!, cursadas[0]!.id, 17, date(17), { ocultoAdministracion: true });
    await experience(visible[0]!, cursadas[0]!.id, 18, date(18), { ocultoReportes: true });

    const route = `/materias/explorar/${visible[0]!.id}/experiencias`;
    const response = await get(route);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ items: expected.slice(0, 5) });
    const changedQuery = await get(`${route}?page=2&pageSize=50&materiaId=${visible[1]!.id}`);
    expect(changedQuery.status).toBe(200);
    expect(await changedQuery.json()).toEqual({ items: expected.slice(0, 5) });
    expect(await (await get(`/materias/explorar/${visible[1]!.id}/experiencias`)).json()).toEqual({ items: [other] });
    expect(await (await get(`/materias/explorar/${empty.id}/experiencias`)).json()).toEqual({ items: [] });
    expect((await get(`/materias/explorar/${hidden.id}/experiencias`)).status).toBe(404);
    expect((await get(`/materias/explorar/${randomUUID()}/experiencias`)).status).toBe(404);
    expect((await get("/materias/explorar/invalido/experiencias")).status).toBe(400);
    expect((await get("/materias/explorar/experiencias")).status).toBe(404);
    expect((await get(`/materias/explorar/${visible[0]!.id}`)).status).toBe(404);
    expect((await get("/feedback/feed")).status).toBe(401);
    const post = await fetch(`${await app.getUrl()}/comisiones/${comisionIds[0]}/feedback`, {
      method: "POST", headers: csrfHeaders, body: JSON.stringify({ texto: "Publicación sin sesión" }),
    });
    expect(post.status).toBe(401);

    const catalog = await get(`/materias/explorar?q=${encodeURIComponent(` ${tag} `)}`);
    expect(catalog.status).toBe(200);
    expect(await catalog.json()).toEqual({ items: [...visible, empty] });
    expect((await get(`/materias/explorar?q=${"x".repeat(151)}`)).status).toBe(400);
  });
});
