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
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";
import { CryptoRefreshTokenService } from "../src/auth/infrastructure/crypto-refresh-token.service.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
describe.skipIf(!databaseUrl)("sesión inactiva y renovación HTTP con PostgreSQL", () => {
  let app: INestApplication; let prisma: PrismaClient; let baseUrl: string;
  const ids = new Set<string>();
  const config = testAuthConfig({ AUTH_IDLE_TTL_SECONDS: "1800", AUTH_IDLE_WARNING_SECONDS: "120" });
  const tokens = new JoseAccessTokenService(config); const opaque = new CryptoRefreshTokenService();
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) }); await prisma.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
  }, 20_000);
  afterAll(async () => {
    if (prisma && ids.size) {
      await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: [...ids] } } } });
      await prisma.session.deleteMany({ where: { userId: { in: [...ids] } } });
      await prisma.user.deleteMany({ where: { id: { in: [...ids] } } });
    }
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });
  async function fixture(inactiveSeconds = 0, role: "USER" | "ADMIN" = "USER") {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const user = await prisma.user.create({ data: { email: `idle-${randomUUID()}@example.test`, displayName: "Sesión de prueba",
      passwordHash: "unused-for-cookie-fixture", role, emailVerifiedAt: now } }); ids.add(user.id);
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id,
      createdAt: new Date(now.getTime() - 3600_000), lastActivityAt: new Date(now.getTime() - inactiveSeconds * 1000),
      expiresAt: new Date(now.getTime() + 86400_000), revokedAt: null } });
    const access = await tokens.issue({ userId: user.id, sessionId: session.id, issuedAt: now.getTime() / 1000 - 60, expiresAt: now.getTime() / 1000 + 840 });
    const refresh = opaque.generate();
    await prisma.refreshCredential.create({ data: { id: randomUUID(), sessionId: session.id, tokenHash: refresh.hash,
      createdAt: now, expiresAt: session.expiresAt } });
    return { user, session, access, cookies: `${config.cookieName}=${access}; ${config.refreshCookieName}=${refresh.value}` };
  }
  const get = (path: string, cookie = "") => fetch(`${baseUrl}${path}`, { headers: { Cookie: cookie } });
  const post = (path: string, cookie = "", input: unknown = {}, headers: Record<string, string> = csrfHeaders) =>
    fetch(`${baseUrl}${path}`, { method: "POST", headers: { ...headers, Cookie: cookie }, body: JSON.stringify(input) });

  it("consulta plazos seguros sin exponer IDs ni prolongar actividad", async () => {
    const f = await fixture(600); const response = await get("/auth/session", f.cookies);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["absoluteExpiresAt", "idleExpiresAt", "serverNow", "warningAt"]);
    expect(body.idleExpiresAt).toBe(new Date(f.session.lastActivityAt.getTime() + 1800_000).toISOString());
    expect(body.warningAt).toBe(new Date(f.session.lastActivityAt.getTime() + 1680_000).toISOString());
    expect((await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } })).lastActivityAt).toEqual(f.session.lastActivityAt);
    expect(Object.keys(await (await get("/auth/me", f.cookies)).json()).sort()).toEqual(["displayName", "email", "id", "role"]);
  });
  it.each(["USER", "ADMIN"] as const)("registra actividad para %s antes del aviso sin extender siete días", async (role) => {
    const f = await fixture(600, role); const response = await post("/auth/session/activity", f.cookies);
    expect(response.status).toBe(200);
    const stored = await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } });
    expect(stored.lastActivityAt.getTime()).toBeGreaterThan(f.session.lastActivityAt.getTime());
    expect(stored.expiresAt).toEqual(f.session.expiresAt);
  });
  it("durante el aviso activity no extiende, pero confirmar renew sí lo hace", async () => {
    const f = await fixture(1680); const before = f.session.lastActivityAt;
    expect((await post("/auth/session/activity", f.cookies)).status).toBe(200);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } })).lastActivityAt).toEqual(before);
    expect((await post("/auth/session/renew", f.cookies)).status).toBe(200);
    const stored = await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } });
    expect(stored.lastActivityAt.getTime()).toBeGreaterThan(before.getTime()); expect(stored.expiresAt).toEqual(f.session.expiresAt);
  });
  it("refresh automático no reinicia la inactividad", async () => {
    const f = await fixture(1690); const response = await post("/auth/refresh", f.cookies);
    expect(response.status).toBe(200);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } })).lastActivityAt).toEqual(f.session.lastActivityAt);
  });
  it("a los treinta minutos rechaza access aún válido, actividad, renovación y refresh", async () => {
    const f = await fixture(1800);
    expect(await tokens.verify(f.access)).toMatchObject({ sessionId: f.session.id });
    for (const path of ["/auth/me", "/auth/session"]) expect((await get(path, f.cookies)).status).toBe(401);
    for (const path of ["/auth/session/activity", "/auth/session/renew", "/auth/refresh"]) expect((await post(path, f.cookies)).status).toBe(401);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } })).lastActivityAt).toEqual(f.session.lastActivityAt);
    expect(await prisma.refreshCredential.count({ where: { sessionId: f.session.id, consumedAt: { not: null } } })).toBe(0);
  });
  it.each([null, [], { lastActivityAt: "2099-01-01T00:00:00Z" }, { sessionId: randomUUID() }])("rechaza datos de cliente en escrituras %#", async (input) => {
    const f = await fixture(600);
    for (const path of ["/auth/session/activity", "/auth/session/renew"]) expect((await post(path, f.cookies, input)).status).toBe(400);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } })).lastActivityAt).toEqual(f.session.lastActivityAt);
  });
  it("mantiene CSRF obligatorio y rechaza solicitudes sin sesión", async () => {
    const f = await fixture(600);
    for (const path of ["/auth/session/activity", "/auth/session/renew"]) {
      expect((await post(path, f.cookies, {}, { "Content-Type": "application/json" })).status).toBe(403);
      expect((await post(path)).status).toBe(401);
    }
    expect((await get("/auth/session")).status).toBe(401);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } })).lastActivityAt).toEqual(f.session.lastActivityAt);
  });
  it.each(["disabled", "unverified", "revoked"])("no renueva una cuenta/sesión %s", async (condition) => {
    const f = await fixture(1690);
    if (condition === "disabled") await prisma.user.update({ where: { id: f.user.id }, data: { disabledAt: new Date() } });
    else if (condition === "unverified") await prisma.user.update({ where: { id: f.user.id }, data: { emailVerifiedAt: null } });
    else await prisma.session.update({ where: { id: f.session.id }, data: { revokedAt: new Date() } });
    expect((await post("/auth/session/renew", f.cookies)).status).toBe(401);
  });
  it("el límite absoluto adelanta el aviso y no se extiende al renovar", async () => {
    const f = await fixture(); const limit = new Date(Date.now() + 180_000);
    await prisma.session.update({ where: { id: f.session.id }, data: { expiresAt: limit } });
    // Emitir access truncado: el guard conserva la restricción access <= plazo absoluto.
    const now = Math.floor(Date.now() / 1000);
    const access = await tokens.issue({ userId: f.user.id, sessionId: f.session.id, issuedAt: now, expiresAt: Math.floor(limit.getTime() / 1000) });
    const cookies = `${config.cookieName}=${access}`;
    const result = await (await get("/auth/session", cookies)).json();
    expect(result.warningAt).toBe(new Date(limit.getTime() - 120_000).toISOString());
    expect((await post("/auth/session/renew", cookies)).status).toBe(200);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } })).expiresAt).toEqual(limit);
  });
  it("renovar en paralelo con logout nunca resucita la sesión revocada", async () => {
    const f = await fixture(1690);
    const [renew, logout] = await Promise.all([post("/auth/session/renew", f.cookies), post("/auth/logout", f.cookies)]);
    expect([200, 401]).toContain(renew.status); expect(logout.status).toBe(204);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } })).revokedAt).not.toBeNull();
    expect((await get("/auth/session", f.cookies)).status).toBe(401);
    expect((await post("/auth/refresh", f.cookies)).status).toBe(401);
  });
});
