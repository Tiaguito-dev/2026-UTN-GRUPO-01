import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Controller, Get, UseGuards, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { AuthModule } from "../src/auth/auth.module.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";
import { ACCESS_TOKEN_SERVICE } from "../src/auth/domain/access-token.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { AuthenticationGuard } from "../src/auth/presentation/authentication.guard.js";
import { RolesGuard } from "../src/auth/presentation/roles.guard.js";
import { Roles } from "../src/auth/presentation/roles.decorator.js";
import { csrfHeaders, testAuthConfig, testOrigin } from "./auth-test.config.js";

@Controller("test-admin")
@UseGuards(AuthenticationGuard, RolesGuard)
class TestAdminController {
  @Get()
  @Roles("ADMIN")
  get() { return { allowed: true }; }
}

const testDatabaseUrl = process.env["TEST_DATABASE_URL"];
describe.skipIf(!testDatabaseUrl)("Sesiones, cookies y guards con PostgreSQL real", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;
  const ids = new Set<string>();
  const config = testAuthConfig();
  const tokens = new JoseAccessTokenService(config);
  const password = " exact integration password ";
  const post = (path: string, body: unknown, headers: Record<string, string> = csrfHeaders) => fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const get = (path: string, cookie?: string) => fetch(`${baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  async function account() {
    const email = `session-test-${randomUUID()}@example.com`;
    const response = await post("/auth/register", { email, displayName: "Persona", password });
    const user = await response.json();
    if (typeof user.id === "string") ids.add(user.id);
    expect(response.status).toBe(201);
    return user as { id: string; email: string };
  }
  async function login(email: string) {
    const response = await post("/auth/login", { email: ` ${email.toUpperCase()} `, password });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    expect(response.status).toBe(200); expect(cookie).toBeTruthy();
    return { response, cookie: cookie! };
  }
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, AuthModule], controllers: [TestAdminController] })
      .overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = moduleRef.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
  }, 20000);
  afterAll(async () => {
    if (prisma && ids.size) {
      await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: [...ids] } } } });
      await prisma.session.deleteMany({ where: { userId: { in: [...ids] } } });
      await prisma.user.deleteMany({ where: { id: { in: [...ids] } } });
    }
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });
  it("login persiste sesión, entrega solo cookie HttpOnly y /me sin secretos", async () => {
    const user = await account(); const { response, cookie } = await login(user.email);
    const body = await response.json();
    expect(body).toMatchObject({ id: user.id, email: user.email, role: "USER" });
    expect(Object.keys(body).sort()).toEqual(["createdAt", "displayName", "email", "id", "role"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/i); expect(setCookie).toMatch(/Path=\//); expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toMatch(/; Secure/i); expect(setCookie).not.toMatch(/Domain=/i);
    const token = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
    expect(JSON.stringify(body)).not.toContain(token); expect(JSON.stringify(body)).not.toContain(password);
    const claims = await tokens.verify(token);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: claims.sessionId } });
    expect(session.userId).toBe(user.id); expect(session.expiresAt.getTime()).toBe((claims.issuedAt + config.sessionTtlSeconds) * 1000);
    const me = await get("/auth/me", cookie);
    expect(me.status).toBe(200); expect(me.headers.get("cache-control")).toBe("no-store");
    const publicUser = await me.json(); expect(Object.keys(publicUser).sort()).toEqual(["displayName", "email", "id", "role"]);
  });
  it("credenciales incorrectas/desconocidas producen mismo 401 y ninguna sesión", async () => {
    const user = await account();
    const wrong = await post("/auth/login", { email: user.email, password: "wrong" });
    const missing = await post("/auth/login", { email: `missing-${randomUUID()}@example.com`, password: "wrong" });
    expect(wrong.status).toBe(401); expect(missing.status).toBe(401);
    expect(await wrong.json()).toEqual(await missing.json());
    expect(wrong.headers.get("set-cookie")).toBeNull(); expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
  it("fallo interno de emisión no deja sesión ni filtra secretos en HTTP", async () => {
    const privateMessage = "private-signing-key-persistence-internal-detail";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(ACCESS_TOKEN_SERVICE).useValue({ issue: async () => { throw new Error(privateMessage); }, verify: async () => { throw new Error(privateMessage); } }).compile();
    const failing = moduleRef.createNestApplication(); failing.useLogger(false); configureAuthHttp(failing, config);
    await failing.listen(0, "127.0.0.1");
    try {
      const user = await account(); const url = await failing.getUrl();
      const response = await fetch(`${url}/auth/login`, { method: "POST", headers: csrfHeaders, body: JSON.stringify({ email: user.email, password }) });
      expect(response.status).toBe(500); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.json(); expect(body).toMatchObject({ statusCode: 500, error: "Internal Server Error", message: expect.any(String) });
      expect(JSON.stringify(body)).not.toMatch(/private-signing|stack|Prisma|passwordHash/); expect(JSON.stringify(body)).not.toContain(password);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    } finally { await failing.close(); }
  });
  it.each([{ email: "invalid", password }, { email: "valid@example.com", password, role: "ADMIN" }, { email: "valid@example.com", password: "" }])("login inválido devuelve 400 %#", async (body) => {
    const response = await post("/auth/login", body); expect(response.status).toBe(400); expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("sin cookie o JWT manipulado devuelve 401", async () => {
    expect((await get("/auth/me")).status).toBe(401);
    const user = await account(); const { cookie } = await login(user.email);
    const parts = cookie.split("."); parts[1] = "eyJzdWIiOiJhdHRhY2tlciJ9";
    expect((await get("/auth/me", parts.join("."))).status).toBe(401);
    expect((await get("/test-admin")).status).toBe(401);
  });
  it.each(["expired", "issuer", "audience", "algorithm"])("HTTP rechaza JWT %s antes de autenticar sesión", async (condition) => {
    const user = await account(); const { cookie } = await login(user.email);
    const claims = await tokens.verify(decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)));
    const iat = condition === "expired" ? Math.floor(Date.now() / 1000) - 1000 : claims.issuedAt;
    const token = await new SignJWT({ sessionId: claims.sessionId }).setSubject(user.id).setIssuedAt(iat).setExpirationTime(iat + 900)
      .setIssuer(condition === "issuer" ? "unexpected-issuer" : config.issuer).setAudience(condition === "audience" ? "unexpected-audience" : config.audience)
      .setProtectedHeader({ alg: condition === "algorithm" ? "HS384" : "HS256", typ: "JWT" }).sign(config.jwtSecret);
    expect((await get("/auth/me", `${config.cookieName}=${token}`)).status).toBe(401);
  });
  it.each(["absent", "revoked", "expired", "other-user"])("rechaza sesión %s aunque JWT sea válido", async (condition) => {
    const user = await account(); const { cookie } = await login(user.email);
    const token = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)); const claims = await tokens.verify(token);
    if (condition === "absent") { await prisma.refreshCredential.deleteMany({ where: { sessionId: claims.sessionId } }); await prisma.session.delete({ where: { id: claims.sessionId } }); }
    if (condition === "revoked") await prisma.session.update({ where: { id: claims.sessionId }, data: { revokedAt: new Date() } });
    if (condition === "expired") await prisma.session.update({ where: { id: claims.sessionId }, data: { expiresAt: new Date(0) } });
    if (condition === "other-user") { const other = await account(); await prisma.session.update({ where: { id: claims.sessionId }, data: { userId: other.id } }); }
    expect((await get("/auth/me", cookie)).status).toBe(401);
  });
  it("roles usan rol vigente: USER 403, ADMIN 200 y cambio posterior a USER 403", async () => {
    const user = await account(); const { cookie } = await login(user.email);
    expect((await get("/test-admin", cookie)).status).toBe(403);
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    expect((await get("/test-admin", cookie)).status).toBe(200);
    expect(await (await get("/auth/me", cookie)).json()).toMatchObject({ role: "ADMIN" });
    await prisma.user.update({ where: { id: user.id }, data: { role: "USER" } });
    expect((await get("/test-admin", cookie)).status).toBe(403);
  });
  it.each(["/auth/register", "/auth/login"])("CSRF protege %s incluyendo login y no emite cookies", async (path) => {
    for (const headers of [{ "Content-Type": "application/json" }, { ...csrfHeaders, Origin: "https://attacker.example" }, { ...csrfHeaders, "X-CSRF-Protection": "" }, { ...csrfHeaders, Origin: "null" }, { ...csrfHeaders, "Content-Type": "text/plain" }]) {
      const response = await post(path, { email: "person@example.com", displayName: "Persona", password }, headers);
      expect([400, 403]).toContain(response.status); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
  it("CORS permite origen explícito con credenciales y rechaza otros orígenes", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, { method: "OPTIONS", headers: { Origin: testOrigin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-csrf-protection" } });
    expect(response.headers.get("access-control-allow-origin")).toBe(testOrigin); expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    const rejected = await fetch(`${baseUrl}/auth/me`, { headers: { Origin: "https://attacker.example" } });
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("rate limiter ignora X-Forwarded-For no confiable y devuelve 429", async () => {
    const limitedConfig = testAuthConfig({ AUTH_LOGIN_MAX_ATTEMPTS: "2" });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(limitedConfig).compile();
    const limited = moduleRef.createNestApplication(); limited.useLogger(false); configureAuthHttp(limited, limitedConfig);
    await limited.listen(0, "127.0.0.1");
    try {
      const url = await limited.getUrl();
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${url}/auth/login`, { method: "POST", headers: { ...csrfHeaders, "X-Forwarded-For": `203.0.113.${i + 1}` }, body: JSON.stringify({ email: "missing@example.com", password: "wrong" }) });
        expect(response.status).toBe(i < 2 ? 401 : 429);
        if (i === 2) { expect(response.headers.get("retry-after")).toBeTruthy(); expect(response.headers.get("cache-control")).toBe("no-store"); }
      }
    } finally { await limited.close(); }
  });
  it("HTTPS detrás de proxy explícito entrega cookie __Host Secure SameSite=None", async () => {
    const secureConfig = testAuthConfig({ NODE_ENV: "production", AUTH_ALLOW_LOCAL_HTTP: "false", AUTH_PUBLIC_URL: "https://api.example.com", AUTH_ALLOWED_ORIGINS: "https://app.example.com", AUTH_PASSWORD_RESET_URL: "https://app.example.com/reset-password", AUTH_COOKIE_SAME_SITE: "none", AUTH_TRUSTED_PROXIES: "127.0.0.1/32" });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(secureConfig).compile();
    const secure = moduleRef.createNestApplication(); secure.useLogger(false); configureAuthHttp(secure, secureConfig); await secure.listen(0, "127.0.0.1");
    try {
      const user = await account(); const url = await secure.getUrl();
      const request = (proto?: string) => fetch(`${url}/auth/login`, { method: "POST", headers: { ...csrfHeaders, Origin: "https://app.example.com", ...(proto ? { "X-Forwarded-Proto": proto } : {}) }, body: JSON.stringify({ email: user.email, password }) });
      const insecure = await request(); expect(insecure.status).toBe(403); expect(insecure.headers.get("set-cookie")).toBeNull();
      const response = await request("https"); expect(response.status).toBe(200);
      const cookie = response.headers.get("set-cookie")!;
      expect(cookie).toMatch(/^__Host-butchery_access=/); expect(cookie).toMatch(/; Secure/i); expect(cookie).toMatch(/; HttpOnly/i); expect(cookie).toMatch(/SameSite=None/i); expect(cookie).not.toMatch(/Domain=/i);
      const refresh = response.headers.getSetCookie().find((header) => header.startsWith("__Secure-butchery_refresh="));
      expect(refresh).toMatch(/Path=\/auth;/); expect(refresh).toMatch(/; Secure/i); expect(refresh).toMatch(/; HttpOnly/i); expect(refresh).toMatch(/SameSite=None/i); expect(refresh).not.toMatch(/Domain=/i);
    } finally { await secure.close(); }
  });
});
