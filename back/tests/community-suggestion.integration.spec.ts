import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const input = () => ({ solicitudId: randomUUID(), categoria: "OTROS", contenido: "Una sugerencia privada del estudiante." });
describe.skipIf(!databaseUrl)("HU-C02 sugerencias HTTP privadas e idempotentes", () => {
  let app: INestApplication; let prisma: PrismaClient; let baseUrl: string;
  const ids: string[] = []; const config = testAuthConfig(); const tokens = new JoseAccessTokenService(config);
  async function startApp() {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config); await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
  }
  beforeAll(async () => { prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) }); await prisma.$connect(); await startApp(); }, 20_000);
  afterAll(async () => {
    if (prisma && ids.length) {
      await prisma.sugerencia.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });
  async function fixture(role: "USER" | "ADMIN" = "USER") {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const user = await prisma.user.create({ data: { email: `suggestion-${randomUUID()}@example.test`, displayName: "Sugerencias de prueba", passwordHash: "unused-cookie-fixture", role, emailVerifiedAt: now } }); ids.push(user.id);
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, createdAt: now, lastActivityAt: now, expiresAt: new Date(now.getTime() + 86400_000) } });
    const token = await tokens.issue({ userId: user.id, sessionId: session.id, issuedAt: now.getTime() / 1000, expiresAt: now.getTime() / 1000 + 900 });
    return { user, session, cookie: `${config.cookieName}=${token}` };
  }
  const post = (cookie = "", body: unknown = input(), headers = csrfHeaders) => fetch(`${baseUrl}/comunidad/sugerencias`, { method: "POST", headers: { ...headers, Cookie: cookie }, body: JSON.stringify(body) });

  it("solo USER puede enviar: sin sesión401 y ADMIN403, sin persistencia", async () => {
    expect((await post()).status).toBe(401);
    const admin = await fixture("ADMIN"); expect((await post(admin.cookie)).status).toBe(403);
    expect(await prisma.sugerencia.count({ where: { usuarioId: admin.user.id } })).toBe(0);
  });
  it.each(["MEJORA_PLATAFORMA", "NUEVA_FUNCIONALIDAD", "REPORTAR_ERROR", "CORRECCION_ACADEMICA", "OTROS"])("USER registra %s con autor de sesión y fecha de base, sin exponer el contenido en el recibo", async categoria => {
    const user = await fixture(); const data = { ...input(), categoria, contenido: " Primera idea.\n\nSegunda idea. " }; const start = Date.now();
    const response = await post(user.cookie, data); expect(response.status).toBe(201);
    const receipt = await response.json(); expect(Object.keys(receipt).sort()).toEqual(["createdAt", "id"]);
    const stored = await prisma.sugerencia.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(stored).toMatchObject({ usuarioId: user.user.id, solicitudId: data.solicitudId, categoria, contenido: "Primera idea.\n\nSegunda idea." });
    expect(stored.createdAt.getTime()).toBeGreaterThanOrEqual(start - 1000); expect(stored.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(receipt.createdAt).toBe(stored.createdAt.toISOString());
  });
  it("peticiones concurrentes con la misma clave y payload devuelven exactamente la misma sugerencia", async () => {
    const user = await fixture(); const data = input();
    const responses = await Promise.all(Array.from({ length: 5 }, () => post(user.cookie, data)));
    expect(responses.map(response => response.status)).toEqual([201, 201, 201, 201, 201]);
    const receipts = await Promise.all(responses.map(response => response.json()));
    expect(new Set(receipts.map(receipt => JSON.stringify(receipt))).size).toBe(1);
    expect(await prisma.sugerencia.count({ where: { usuarioId: user.user.id, solicitudId: data.solicitudId } })).toBe(1);
    const normalized = await post(user.cookie, { ...data, contenido: ` ${data.contenido} ` });
    expect(await normalized.json()).toEqual(receipts[0]);
  });
  it.each(["categoria", "contenido"])("reusar la clave con otro %s devuelve409 sin sobrescribir", async field => {
    const user = await fixture(); const data = input(); expect((await post(user.cookie, data)).status).toBe(201);
    const changed = field === "categoria" ? { ...data, categoria: "REPORTAR_ERROR" } : { ...data, contenido: "Otra idea" };
    expect((await post(user.cookie, changed)).status).toBe(409);
    const stored = await prisma.sugerencia.findMany({ where: { usuarioId: user.user.id } });
    expect(stored).toHaveLength(1); expect(stored[0]).toMatchObject(data);
  });
  it("usuarios diferentes pueden usar la misma clave y cada usuario enviar otra sugerencia con una clave nueva", async () => {
    const first = await fixture(); const second = await fixture(); const data = input();
    const responses = await Promise.all([post(first.cookie, data), post(second.cookie, data), post(first.cookie, { ...data, solicitudId: randomUUID() })]);
    expect(responses.map(response => response.status)).toEqual([201, 201, 201]);
    const receipts = await Promise.all(responses.map(response => response.json())); expect(new Set(receipts.map(receipt => receipt.id)).size).toBe(3);
    expect(await prisma.sugerencia.count({ where: { usuarioId: first.user.id } })).toBe(2);
    expect(await prisma.sugerencia.count({ where: { usuarioId: second.user.id } })).toBe(1);
  });
  it.each([null, {}, { ...input(), categoria: "INVALIDA" }, { ...input(), contenido: " " }, { ...input(), contenido: "x".repeat(5001) }, { ...input(), solicitudId: "invalid" }, { ...input(), usuarioId: randomUUID() }, { ...input(), autorId: randomUUID() }, { ...input(), createdAt: "2000-01-01" }, { ...input(), id: randomUUID() }])("rechaza cuerpo inválido o suplantación sin persistencia: %j", async data => {
    const user = await fixture(); expect((await post(user.cookie, data)).status).toBe(400);
    expect(await prisma.sugerencia.count({ where: { usuarioId: user.user.id } })).toBe(0);
  });
  it("mantiene CSRF obligatorio y rechazo de sesiones revocadas", async () => {
    const user = await fixture(); expect((await post(user.cookie, input(), { ...csrfHeaders, "X-CSRF-Protection": "" })).status).toBe(403);
    await prisma.session.update({ where: { id: user.session.id }, data: { revokedAt: new Date() } });
    expect((await post(user.cookie)).status).toBe(401); expect(await prisma.sugerencia.count({ where: { usuarioId: user.user.id } })).toBe(0);
  });
  it("no ofrece lectura, listado ni publicación de sugerencias a otros usuarios", async () => {
    const first = await fixture(); const other = await fixture(); const receipt = await (await post(first.cookie)).json();
    for (const cookie of ["", first.cookie, other.cookie]) for (const path of ["/comunidad/sugerencias", `/comunidad/sugerencias/${receipt.id}`]) {
      // HU-C03 incorpora listado solo ADMIN; la lectura por ID sigue sin existir.
      const response = await fetch(`${baseUrl}${path}`, { headers: { Cookie: cookie } });
      expect(response.status).toBe(path === "/comunidad/sugerencias" ? (cookie ? 403 : 401) : 404);
      expect(JSON.stringify(await response.json())).not.toContain("Una sugerencia privada");
    }
  });
  it("un fallo de persistencia no devuelve éxito ni filtra datos internos", async () => {
    const user = await fixture();
    const transaction = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("secret-db-password Prisma P1001"));
    try {
      const response = await post(user.cookie); expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toMatch(/secret-db-password|Prisma|P1001/);
    } finally { transaction.mockRestore(); }
    expect(await prisma.sugerencia.count({ where: { usuarioId: user.user.id } })).toBe(0);
  });
  it("el documento y sus aceptaciones no cambian al enviar una sugerencia", async () => {
    const user = await fixture(); const before = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    const accepted = await prisma.aceptacionNormas.findMany({ where: { usuarioId: user.user.id } });
    expect((await post(user.cookie)).status).toBe(201);
    expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(before);
    expect(await prisma.aceptacionNormas.findMany({ where: { usuarioId: user.user.id } })).toEqual(accepted);
  });
  it("una nueva instancia de la aplicación conserva la sugerencia y reconoce su reintento", async () => {
    const user = await fixture(); const data = input(); const original = await (await post(user.cookie, data)).json();
    await app.close(); await startApp();
    const response = await post(user.cookie, data); expect(response.status).toBe(201); expect(await response.json()).toEqual(original);
    expect(await prisma.sugerencia.count({ where: { usuarioId: user.user.id } })).toBe(1);
  }, 20_000);
});
