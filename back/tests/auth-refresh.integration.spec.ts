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
import { ACCESS_TOKEN_SERVICE } from "../src/auth/domain/access-token.js";
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";
import { CryptoRefreshTokenService } from "../src/auth/infrastructure/crypto-refresh-token.service.js";
import { PrismaRefreshCredentialRepository } from "../src/auth/infrastructure/prisma-refresh-credential.repository.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { RefreshSession } from "../src/auth/application/refresh-session.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
describe.skipIf(!databaseUrl)("Refresh y logout HTTP con atomicidad PostgreSQL", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let url: string;
  const ids = new Set<string>();
  const config = testAuthConfig({ AUTH_REFRESH_MAX_ATTEMPTS: "200" });
  const tokens = new JoseAccessTokenService(config);
  const opaque = new CryptoRefreshTokenService();
  const password = " integration refresh password ";
  const cookieHeaders = (response: Response) => response.headers.getSetCookie();
  const cookieJar = (response: Response) => cookieHeaders(response).map((value) => value.split(";")[0]).join("; ");
  const value = (cookies: string, name: string) => decodeURIComponent(cookies.split("; ").find((part) => part.startsWith(`${name}=`))!.slice(name.length + 1));
  const post = (path: string, cookies = "", body: unknown = {}, headers = csrfHeaders, base = url) => fetch(`${base}${path}`, { method: "POST", headers: { ...headers, Cookie: cookies }, body: JSON.stringify(body) });
  const me = (cookies: string) => fetch(`${url}/auth/me`, { headers: { Cookie: cookies } });
  async function login() {
    const email = `refresh-${randomUUID()}@example.com`;
    const register = await post("/auth/register", "", { email, displayName: "Refresh", password });
    const user = await register.json(); ids.add(user.id); expect(register.status).toBe(201);
    const response = await post("/auth/login", "", { email, password }); expect(response.status).toBe(200);
    const cookies = cookieJar(response);
    const access = value(cookies, config.cookieName);
    const refresh = value(cookies, config.refreshCookieName);
    const claims = await tokens.verify(access);
    return { response, cookies, access, refresh, claims, user };
  }
  function expectCleared(response: Response) {
    const headers = cookieHeaders(response); expect(headers).toHaveLength(2);
    expect(headers.find((h) => h.startsWith(`${config.cookieName}=`))).toMatch(/Path=\/;/);
    expect(headers.find((h) => h.startsWith(`${config.refreshCookieName}=`))).toMatch(/Path=\/auth;/);
    for (const header of headers) { expect(header).toMatch(/HttpOnly/i); expect(header).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i); }
  }
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) }); await prisma.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config); await app.listen(0, "127.0.0.1"); url = await app.getUrl();
  }, 20000);
  afterAll(async () => {
    if (prisma && ids.size) {
      await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: [...ids] } } } });
      await prisma.session.deleteMany({ where: { userId: { in: [...ids] } } });
      await prisma.user.deleteMany({ where: { id: { in: [...ids] } } });
    }
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });
  it("login entrega ambas cookies y persiste solamente hash único con plazo absoluto independiente", async () => {
    const f = await login(); const body = await f.response.json();
    expect(cookieHeaders(f.response)).toHaveLength(2);
    expect(cookieHeaders(f.response).find((h) => h.startsWith(`${config.refreshCookieName}=`))).toMatch(/Path=\/auth;/);
    for (const cookie of cookieHeaders(f.response)) expect(cookie).toMatch(/HttpOnly/i);
    expect(Buffer.from(f.refresh, "base64url").length).toBeGreaterThanOrEqual(32);
    const stored = await prisma.refreshCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(f.refresh)! } });
    const session = await prisma.session.findUniqueOrThrow({ where: { id: f.claims.sessionId } });
    expect(stored.sessionId).toBe(session.id); expect(stored.expiresAt).toEqual(session.expiresAt);
    expect(session.expiresAt.getTime()).toBe((f.claims.issuedAt + config.sessionTtlSeconds) * 1000);
    expect(JSON.stringify(stored)).not.toContain(f.refresh); expect(JSON.stringify(body)).not.toContain(f.refresh); expect(JSON.stringify(body)).not.toContain(f.access);
    expect(Object.keys(body).sort()).toEqual(["createdAt", "displayName", "email", "id", "role"]);
    await expect(prisma.refreshCredential.create({ data: { ...stored, id: randomUUID() } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("rota y permite volver a renovar con reemplazo sin extender sesión", async () => {
    const f = await login(); const before = await prisma.session.findUniqueOrThrow({ where: { id: f.claims.sessionId } });
    const response = await post("/auth/refresh", f.cookies); expect(response.status).toBe(200);
    const next = cookieJar(response); expect(value(next, config.refreshCookieName)).not.toBe(f.refresh);
    const original = await prisma.refreshCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(f.refresh)! } }); expect(original.consumedAt).not.toBeNull();
    expect((await post("/auth/refresh", next)).status).toBe(200);
    expect((await me(next)).status).toBe(200);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: before.id } })).expiresAt).toEqual(before.expiresAt);
  });
  it("access vencido no autoriza /me pero refresh reconocido renueva y permite logout", async () => {
    const f = await login(); const issuedAt = Math.floor(Date.now() / 1000) - 1000;
    await prisma.session.update({ where: { id: f.claims.sessionId }, data: { createdAt: new Date(issuedAt * 1000) } });
    const expired = await tokens.issue({ ...f.claims, issuedAt, expiresAt: issuedAt + 900 });
    const cookies = `${config.cookieName}=${expired}; ${config.refreshCookieName}=${f.refresh}`;
    expect((await me(cookies)).status).toBe(401);
    const renewed = await post("/auth/refresh", cookies); expect(renewed.status).toBe(200); expect((await me(cookieJar(renewed))).status).toBe(200);
    const second = await login();
    const logout = await post("/auth/logout", `${config.cookieName}=${expired}; ${config.refreshCookieName}=${second.refresh}`);
    expect(logout.status).toBe(204); expectCleared(logout);
    expect((await me(second.cookies)).status).toBe(401);
  });
  it.each(["absent", "unknown", "expired", "invalidated", "revoked"])("refresh %s devuelve 401 limpia cookies", async (condition) => {
    const f = await login(); let cookies = f.cookies;
    if (condition === "absent") cookies = `${config.cookieName}=${f.access}`;
    if (condition === "unknown") cookies = `${config.refreshCookieName}=${opaque.generate().value}`;
    if (condition === "expired") await prisma.refreshCredential.update({ where: { tokenHash: opaque.hash(f.refresh)! }, data: { expiresAt: new Date(0) } });
    if (condition === "invalidated") await prisma.refreshCredential.update({ where: { tokenHash: opaque.hash(f.refresh)! }, data: { invalidatedAt: new Date() } });
    if (condition === "revoked") await prisma.session.update({ where: { id: f.claims.sessionId }, data: { revokedAt: new Date() } });
    const response = await post("/auth/refresh", cookies); expect(response.status).toBe(401); expectCleared(response);
    if (condition === "unknown" || condition === "absent") expect((await me(f.cookies)).status).toBe(200);
  });
  it("reutilización reconocida revoca sesión e invalida reemplazo inmediatamente", async () => {
    const f = await login(); const first = await post("/auth/refresh", f.cookies); expect(first.status).toBe(200);
    const replacement = cookieJar(first); const reused = await post("/auth/refresh", f.cookies); expect(reused.status).toBe(401);
    expect((await me(replacement)).status).toBe(401); expect((await post("/auth/refresh", replacement)).status).toBe(401);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: f.claims.sessionId } }); expect(session.revokedAt).not.toBeNull();
    expect(await prisma.refreshCredential.count({ where: { sessionId: session.id, consumedAt: null, invalidatedAt: null } })).toBe(0);
  });
  it("dos refresh concurrentes serializados no dejan reemplazos válidos", async () => {
    const f = await login(); const responses = await Promise.all([post("/auth/refresh", f.cookies), post("/auth/refresh", f.cookies)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await prisma.refreshCredential.count({ where: { sessionId: f.claims.sessionId } })).toBe(2);
    expect(await prisma.refreshCredential.count({ where: { sessionId: f.claims.sessionId, consumedAt: null, invalidatedAt: null } })).toBe(0);
    expect((await me(cookieJar(responses.find((r) => r.status === 200)!))).status).toBe(401);
  });
  it("refresh concurrente con logout nunca reactiva sesión", async () => {
    const f = await login(); const [refresh, logout] = await Promise.all([post("/auth/refresh", f.cookies), post("/auth/logout", f.cookies)]);
    expect([200, 401]).toContain(refresh.status); expect(logout.status).toBe(204);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: f.claims.sessionId } }); expect(session.revokedAt).not.toBeNull();
    expect(await prisma.refreshCredential.count({ where: { sessionId: session.id, consumedAt: null, invalidatedAt: null } })).toBe(0);
    expect((await me(refresh.status === 200 ? cookieJar(refresh) : f.cookies)).status).toBe(401);
  });
  it("trunca access al límite absoluto y rechaza renovación después del límite", async () => {
    const f = await login(); const limit = new Date((Math.floor(Date.now() / 1000) + 30) * 1000);
    await prisma.session.update({ where: { id: f.claims.sessionId }, data: { expiresAt: limit } });
    const response = await post("/auth/refresh", f.cookies); expect(response.status).toBe(200); const cookies = cookieJar(response);
    expect((await tokens.verify(value(cookies, config.cookieName))).expiresAt * 1000).toBe(limit.getTime());
    const stored = await prisma.refreshCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(value(cookies, config.refreshCookieName))! } }); expect(stored.expiresAt).toEqual(limit);
    await prisma.session.update({ where: { id: f.claims.sessionId }, data: { expiresAt: new Date(0) } });
    expect((await post("/auth/refresh", cookies)).status).toBe(401);
  });
  it("logout idempotente limpia atributos correctos sin revocar otras sesiones", async () => {
    const f = await login(); const other = await login();
    for (const cookies of [f.cookies, f.cookies, "", `${config.cookieName}=malformed`]) {
      const response = await post("/auth/logout", cookies); expect(response.status).toBe(204); expectCleared(response); expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect((await me(f.cookies)).status).toBe(401); expect((await me(other.cookies)).status).toBe(200);
  });
  it("logout con refresh consumido o vencido reconocido revoca sesión sin access", async () => {
    for (const state of ["consumed", "expired"]) {
      const f = await login();
      if (state === "consumed") expect((await post("/auth/refresh", f.cookies)).status).toBe(200);
      else await prisma.refreshCredential.update({ where: { tokenHash: opaque.hash(f.refresh)! }, data: { expiresAt: new Date(0) } });
      const response = await post("/auth/logout", `${config.refreshCookieName}=${f.refresh}`); expect(response.status).toBe(204);
      expect((await prisma.session.findUniqueOrThrow({ where: { id: f.claims.sessionId } })).revokedAt).not.toBeNull();
      expect(await prisma.refreshCredential.count({ where: { sessionId: f.claims.sessionId, consumedAt: null, invalidatedAt: null } })).toBe(0);
    }
  });
  it.each(["/auth/refresh", "/auth/logout"])("CSRF permanece obligatorio en %s sin credenciales", async (path) => {
    for (const headers of [{ "Content-Type": "application/json" }, { ...csrfHeaders, Origin: "https://attacker.example" }, { ...csrfHeaders, "X-CSRF-Protection": "" }]) {
      const response = await post(path, "", {}, headers as typeof csrfHeaders); expect(response.status).toBe(403); expect(cookieHeaders(response)).toHaveLength(0);
    }
  });
  it("rollback de consumo e inserción ante conflicto real de hash UNIQUE", async () => {
    const f = await login(); const repository = new PrismaRefreshCredentialRepository(prisma as PrismaService);
    const original = await prisma.refreshCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(f.refresh)! } });
    await expect(repository.rotate(original.tokenHash, new Date(), async () => ({ ...original, id: randomUUID() }))).rejects.toMatchObject({ code: "P2002" });
    expect(await prisma.refreshCredential.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
    expect(await prisma.refreshCredential.count({ where: { sessionId: f.claims.sessionId } })).toBe(1);
    expect((await post("/auth/refresh", f.cookies)).status).toBe(200);
  });
  it("creación atómica no deja sesión ante conflicto real de credencial", async () => {
    const f = await login(); const repository = new PrismaRefreshCredentialRepository(prisma as PrismaService);
    const original = await prisma.refreshCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(f.refresh)! } });
    const session = await prisma.session.findUniqueOrThrow({ where: { id: f.claims.sessionId } }); const id = randomUUID();
    await expect(repository.createSession({ ...session, id }, { ...original, id: randomUUID(), sessionId: id }, (await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash)).rejects.toMatchObject({ code: "P2002" });
    expect(await prisma.session.findUnique({ where: { id } })).toBeNull();
  });
  it("renovación completa funciona con pool PostgreSQL limitado a una conexión", async () => {
    const f = await login();
    const singleConnection = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, max: 1 }) });
    await singleConnection.$connect();
    try {
      const repository = new PrismaRefreshCredentialRepository(singleConnection as PrismaService);
      const useCase = new RefreshSession(repository, tokens, opaque, config.accessTtlSeconds);
      const result = await useCase.execute(f.refresh);
      expect(result.user.id).toBe(f.user.id); expect(result.user).not.toHaveProperty("passwordHash");
      expect((await tokens.verify(result.accessToken)).sessionId).toBe(f.claims.sessionId);
      expect(await singleConnection.refreshCredential.count({ where: { sessionId: f.claims.sessionId } })).toBe(2);
      expect((await singleConnection.refreshCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(f.refresh)! } })).consumedAt).not.toBeNull();
    } finally { await singleConnection.$disconnect(); }
  });
  it("firma fallida durante refresh conserva credencial y cookies sin detalles internos", async () => {
    const f = await login();
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(ACCESS_TOKEN_SERVICE).useValue({ issue: async () => { throw new Error("private-signing-detail"); }, verify: tokens.verify.bind(tokens) }).compile();
    const failing = module.createNestApplication(); failing.useLogger(false); configureAuthHttp(failing, config); await failing.listen(0, "127.0.0.1");
    try {
      const response = await post("/auth/refresh", f.cookies, {}, csrfHeaders, await failing.getUrl()); expect(response.status).toBe(500); expect(cookieHeaders(response)).toHaveLength(0);
      expect(JSON.stringify(await response.json())).not.toMatch(/private-signing|Prisma|stack/);
      expect((await prisma.refreshCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(f.refresh)! } })).consumedAt).toBeNull();
      expect((await post("/auth/refresh", f.cookies)).status).toBe(200);
    } finally { await failing.close(); }
  });
  it("rate refresh configurable ignora cabeceras proxy no confiables", async () => {
    const limitedConfig = testAuthConfig({ AUTH_REFRESH_MAX_ATTEMPTS: "2" });
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(limitedConfig).compile();
    const limited = module.createNestApplication(); limited.useLogger(false); configureAuthHttp(limited, limitedConfig); await limited.listen(0, "127.0.0.1");
    try {
      for (let i = 0; i < 3; i++) {
        const response = await post("/auth/refresh", "", {}, { ...csrfHeaders, "X-Forwarded-For": `203.0.113.${i + 1}` } as typeof csrfHeaders, await limited.getUrl());
        expect(response.status).toBe(i < 2 ? 401 : 429); if (i === 2) expect(response.headers.get("retry-after")).toBeTruthy();
      }
    } finally { await limited.close(); }
  });
});
