import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const input = { titulo: "Normas actualizadas por administración", introduccion: "Mensaje uno.\n\nMensaje dos.", normas: ["Norma B primero", "Norma A después"], cierre: "Gracias por sumar." };
describe.skipIf(!databaseUrl)("HU-C04 actualización HTTP atómica y trazabilidad", () => {
  let app: INestApplication; let prisma: PrismaClient; let baseUrl: string;
  let original: Awaited<ReturnType<PrismaClient["normasConvivencia"]["findUniqueOrThrow"]>>;
  const ids: string[] = []; const config = testAuthConfig(); const tokens = new JoseAccessTokenService(config);
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) }); await prisma.$connect();
    original = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config); await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
  }, 20_000);
  afterEach(async () => {
    vi.restoreAllMocks();
    if (prisma && original) await prisma.normasConvivencia.update({ where: { id: "vigentes" }, data: original });
  });
  afterAll(async () => {
    if (prisma && ids.length) {
      await prisma.aceptacionNormas.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });
  async function fixture(role: "USER" | "ADMIN") {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const user = await prisma.user.create({ data: { email: `community-update-${randomUUID()}@example.test`, displayName: "Edición normas", passwordHash: "unused-cookie-fixture", role, emailVerifiedAt: now } }); ids.push(user.id);
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, createdAt: now, lastActivityAt: now, expiresAt: new Date(now.getTime() + 86400_000) } });
    const access = await tokens.issue({ userId: user.id, sessionId: session.id, issuedAt: now.getTime() / 1000, expiresAt: now.getTime() / 1000 + 900 });
    return { user, session, cookie: `${config.cookieName}=${access}` };
  }
  const put = (cookie = "", body: unknown = input, headers = csrfHeaders) => fetch(`${baseUrl}/comunidad/normas`, { method: "PUT", headers: { ...headers, Cookie: cookie }, body: JSON.stringify(body) });

  it("rechaza PUT sin sesión y USER recibe403 sin modificar documento ni metadata", async () => {
    expect((await put()).status).toBe(401);
    const user = await fixture("USER"); expect((await put(user.cookie)).status).toBe(403);
    expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(original);
  });
  it("ADMIN actualiza contenido completo, orden, fecha y responsable real manteniendo createdAt y DTO público", async () => {
    const admin = await fixture("ADMIN"); const start = Date.now();
    const response = await put(admin.cookie); expect(response.status).toBe(200);
    const body = await response.json();
    const stored = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    expect(stored).toMatchObject({ ...input, actualizadoPorId: admin.user.id });
    expect(stored.createdAt).toEqual(original.createdAt);
    expect(stored.updatedAt.getTime()).toBeGreaterThanOrEqual(start - 1000);
    expect(stored.updatedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(body).toEqual({ ...input, id: "vigentes", createdAt: original.createdAt.toISOString(), updatedAt: stored.updatedAt.toISOString() });
    const user = await fixture("USER");
    const read = await fetch(`${baseUrl}/comunidad/normas`, { headers: { Cookie: user.cookie } });
    expect(await read.json()).toEqual(body);
    expect(body).not.toHaveProperty("actualizadoPorId");
  });
  it.each([null, { ...input, titulo: " " }, { ...input, normas: [] }, { ...input, normas: [" "] }, { ...input, titulo: "x".repeat(161) }, { ...input, actualizadoPorId: randomUUID() }, { ...input, updatedAt: "2099-01-01" }, { ...input, id: "otro" }])("ADMIN rechaza cuerpo inválido o suplantación sin cambio parcial: %j", async body => {
    const admin = await fixture("ADMIN"); expect((await put(admin.cookie, body)).status).toBe(400);
    expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(original);
  });
  it("conserva obligatoriedad de CSRF y rechaza sesión revocada", async () => {
    const admin = await fixture("ADMIN");
    expect((await put(admin.cookie, input, { ...csrfHeaders, "X-CSRF-Protection": "" })).status).toBe(403);
    await prisma.session.update({ where: { id: admin.session.id }, data: { revokedAt: new Date() } });
    expect((await put(admin.cookie)).status).toBe(401);
    expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(original);
  });
  it("si la actualización falla no persiste campos ni responsable y no expone infraestructura", async () => {
    const admin = await fixture("ADMIN");
    const update = vi.spyOn(prisma.normasConvivencia, "update").mockRejectedValueOnce(new Error("secret-db-password Prisma P1001"));
    const response = await put(admin.cookie); expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(/secret-db-password|Prisma|P1001/);
    update.mockRestore();
    expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(original);
  });
  it("un documento inexistente devuelve404 y nunca se recrea por actualización", async () => {
    const admin = await fixture("ADMIN");
    const update = vi.spyOn(prisma.normasConvivencia, "update").mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "6.19.3" }));
    const response = await put(admin.cookie); expect(response.status).toBe(404);
    update.mockRestore(); expect(await prisma.normasConvivencia.count()).toBe(1);
  });
  it("no reescribe aceptaciones históricas ni las crea para cuentas existentes", async () => {
    const admin = await fixture("ADMIN"); const user = await fixture("USER");
    const accepted = await prisma.aceptacionNormas.create({ data: { usuarioId: user.user.id, version: "normas-historicas", aceptadaEn: new Date("2025-01-01T00:00:00Z") } });
    expect((await put(admin.cookie)).status).toBe(200);
    expect(await prisma.aceptacionNormas.findMany({ where: { usuarioId: user.user.id } })).toEqual([accepted]);
    expect(await prisma.aceptacionNormas.count({ where: { usuarioId: admin.user.id } })).toBe(0);
  });
});
