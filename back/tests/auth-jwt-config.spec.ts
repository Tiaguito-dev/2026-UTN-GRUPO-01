import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { readAuthConfig } from "../src/auth/auth.config.js";
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";
import { InvalidAccessTokenError } from "../src/auth/domain/auth-errors.js";
import { testAuthConfig, testAuthEnvironment } from "./auth-test.config.js";

describe("Configuración de autenticación", () => {
  it("valida defaults y cookie segura host-only de despliegue HTTPS", () => {
    const config = testAuthConfig({ NODE_ENV: "production", AUTH_ALLOW_LOCAL_HTTP: "false", AUTH_PUBLIC_URL: "https://api.example.com", AUTH_ALLOWED_ORIGINS: "https://app.example.com", AUTH_PASSWORD_RESET_URL: "https://app.example.com/reset-password", AUTH_COOKIE_SAME_SITE: "none" });
    expect(config).toMatchObject({ accessTtlSeconds: 900, sessionTtlSeconds: 604800, refreshMaxAttempts: 30, refreshWindowSeconds: 900, refreshCookieName: "__Secure-butchery_refresh", refreshCookiePath: "/auth", cookieSecure: true, cookieName: "__Host-butchery_access", cookieSameSite: "none", trustedProxies: [] });
  });
  it.each([
    { AUTH_JWT_SECRET: "" }, { AUTH_JWT_SECRET: "short" }, { AUTH_JWT_ISSUER: "" }, { AUTH_JWT_AUDIENCE: "" },
    { AUTH_ALLOWED_ORIGINS: "*" }, { AUTH_ALLOWED_ORIGINS: "null" }, { AUTH_ALLOWED_ORIGINS: "http://localhost:3000/path" },
    { AUTH_PUBLIC_URL: "http://remote.example.com" }, { AUTH_ALLOW_LOCAL_HTTP: "yes" }, { NODE_ENV: "production" },
    { AUTH_COOKIE_SAME_SITE: "none" }, { AUTH_ACCESS_TTL_SECONDS: "0" }, { AUTH_ACCESS_TTL_SECONDS: "3601" },
    { AUTH_TRUSTED_PROXIES: "true" }, { AUTH_TRUSTED_PROXIES: "1" }, { AUTH_TRUSTED_PROXIES: "0.0.0.0/0" },
    { AUTH_LOGIN_MAX_ATTEMPTS: "0" }, { AUTH_LOGIN_WINDOW_SECONDS: "-1" },
    { AUTH_SESSION_TTL_SECONDS: "0" }, { AUTH_SESSION_TTL_SECONDS: "899" }, { AUTH_SESSION_TTL_SECONDS: "2592001" },
    { AUTH_REFRESH_MAX_ATTEMPTS: "0" }, { AUTH_REFRESH_WINDOW_SECONDS: "0" },
  ])("impide iniciar con configuración inválida %#", (overrides) => {
    expect(() => readAuthConfig(testAuthEnvironment(overrides))).toThrow(/Configuración/);
  });
  it("no refleja secretos de configuración inválida", () => {
    const secret = "secret+private+invalid";
    try { readAuthConfig(testAuthEnvironment({ AUTH_JWT_SECRET: secret })); throw new Error("Expected failure"); }
    catch (error) { expect(String(error)).not.toContain(secret); }
  });
  it("composición Nest no inicia sin clave configurada", async () => {
    for (const [key, value] of Object.entries(testAuthEnvironment())) vi.stubEnv(key, value);
    vi.stubEnv("AUTH_JWT_SECRET", undefined);
    try {
      await expect(Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue({}).compile()).rejects.toThrow(/AUTH_JWT_SECRET/);
    } finally { vi.unstubAllEnvs(); }
  });
});

describe("Access JWT jose", () => {
  const config = testAuthConfig();
  const issuedAt = 1791460800;
  const expiresAt = issuedAt + 900;
  const now = () => new Date(issuedAt * 1000);
  const adapter = new JoseAccessTokenService(config, now);
  const claims = { userId: randomUUID(), sessionId: randomUUID(), issuedAt, expiresAt };
  const payload = { sub: claims.userId, sessionId: claims.sessionId, iat: issuedAt, exp: expiresAt, iss: config.issuer, aud: config.audience };
  async function sign(overrides: Record<string, unknown> = {}, header = { alg: "HS256", typ: "JWT" }) {
    return new SignJWT({ ...payload, ...overrides }).setProtectedHeader(header).sign(config.jwtSecret);
  }
  it("emite/verifica claims y firma válidos sin rol", async () => {
    const token = await adapter.issue(claims); expect(await adapter.verify(token)).toEqual(claims);
    expect(JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString())).toEqual(payload);
  });
  it("rechaza firma manipulada y clave incorrecta", async () => {
    const token = await adapter.issue(claims);
    const [header, body, signature] = token.split(".");
    const tampered = `${header}.${body}.${signature![0] === "a" ? "b" : "a"}${signature!.slice(1)}`;
    await expect(adapter.verify(tampered)).rejects.toBeInstanceOf(InvalidAccessTokenError);
    await expect(new JoseAccessTokenService(testAuthConfig(), now).verify(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
  it("rechaza token vencido", async () => {
    const token = await adapter.issue(claims);
    await expect(new JoseAccessTokenService(config, () => new Date(expiresAt * 1000)).verify(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
  it("acepta duración positiva menor que access TTL para truncar al plazo absoluto", async () => {
    const short = { ...claims, expiresAt: issuedAt + 30 };
    expect(await adapter.verify(await adapter.issue(short))).toEqual(short);
  });
  it.each([
    { iss: "other" }, { aud: "other" }, { aud: [config.audience, "other"] }, { sub: "unexpected" },
    { sessionId: "unexpected" }, { iat: issuedAt + 1, exp: expiresAt + 1 }, { iat: 1.5 }, { exp: expiresAt + 1 },
    { role: "ADMIN" }, { sessionId: null }, { iat: null },
  ])("rechaza claims inesperados %#", async (overrides) => {
    await expect(adapter.verify(await sign(overrides))).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
  it.each([{ alg: "HS384", typ: "JWT" }, { alg: "HS256", typ: "other" }])("rechaza algoritmo/tipo no permitido %#", async (header) => {
    await expect(adapter.verify(await sign({}, header))).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
  it.each(["", "bad", "a.b.c", "a".repeat(4097)])("rechaza token malformado %#", async (token) => {
    await expect(adapter.verify(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
