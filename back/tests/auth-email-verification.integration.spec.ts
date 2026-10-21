import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { VERIFICATION_EMAIL } from "../src/auth/domain/email-verification.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { CryptoRefreshTokenService } from "../src/auth/infrastructure/crypto-refresh-token.service.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";
import type { INestApplication } from "@nestjs/common";
const database = process.env["TEST_DATABASE_URL"], mailbox = process.env["TEST_MAILPIT_API_URL"];
describe.skipIf(!database || !mailbox)("Institutional verification PostgreSQL and SMTP", () => {
  let prisma: PrismaClient, app: INestApplication, base: string;
  const ids: string[] = [], password = " institutional password ";
  const post = (path: string, body: unknown) => fetch(`${base}/auth/${path}`, { method: "POST", headers: csrfHeaders, body: JSON.stringify(body) });
  const opaque = new CryptoRefreshTokenService();
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database! }) }); await prisma.$connect();
    const config = testAuthConfig({ SMTP_TIMEOUT_MS: "1500", AUTH_PASSWORD_RESET_MIN_RESPONSE_MS: "2000", AUTH_RESET_PASSWORD_MAX_ATTEMPTS: "200" });
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config); await app.listen(0, "127.0.0.1"); base = await app.getUrl();
  }, 20000);
  afterAll(async () => {
    if (prisma) { await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: ids } } }); await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: ids } } } }); await prisma.session.deleteMany({ where: { userId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); } if (app) await app.close();
  });
  async function account() {
    const email = `verify-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const response = await post("register", { email, displayName: "Estudiante", password }); expect(response.status).toBe(201); const user = await response.json(); ids.push(user.id); expect(response.headers.get("set-cookie")).toBeNull();
    return { email, id: user.id as string };
  }
  async function tokens(email: string): Promise<string[]> {
    const search = await (await fetch(`${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const details = await Promise.all(search.messages.map(async (m: { ID: string }) => (await fetch(`${mailbox}/api/v1/message/${m.ID}`)).json()));
    return details.map((m) => new URL(m.Text.match(/https?:\/\/[^\s]+/u)[0])).filter((url) => url.pathname === "/verify-email").map((url) => { expect(url.origin).toBe("http://localhost:3000"); return url.searchParams.get("token")!; });
  }
  it("registration stays pending until real SMTP link; concurrent confirmation is safe and login works", async () => {
    const user = await account(); expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
    for (const [supplied, status] of [["wrong password", 401], [password, 403]] as const) { const denied = await post("login", { email: user.email, password: supplied }); expect(denied.status).toBe(status); expect(denied.headers.get("set-cookie")).toBeNull(); }
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    const [token] = await tokens(user.email); expect(Buffer.from(token!, "base64url")).toHaveLength(32);
    const credential = await prisma.emailVerificationCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(token!)! } }); expect(credential.deliveredAt).not.toBeNull(); expect(JSON.stringify(credential)).not.toContain(token!);
    const confirmations = await Promise.all([post("verify-email", { token }), post("verify-email", { token })]); expect(confirmations.map((r) => r.status)).toEqual([204, 204]); for (const response of confirmations) expect(response.headers.get("set-cookie")).toBeNull();
    const verified = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt; expect(verified).toBeInstanceOf(Date);
    expect((await post("verify-email", { token })).status).toBe(204); expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toEqual(verified);
    expect((await post("login", { email: user.email, password })).status).toBe(200);
  });
  it("expired, unknown and rotated links cannot verify; resend creates a usable SMTP link", async () => {
    const user = await account(); const [old] = await tokens(user.email);
    await prisma.emailVerificationCredential.update({ where: { tokenHash: opaque.hash(old!)! }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post("verify-email", { token: old })).status).toBe(400); expect((await post("verify-email", { token: opaque.generate().value })).status).toBe(400);
    expect((await post("resend-verification", { email: user.email.toUpperCase() })).status).toBe(202); const fresh = (await tokens(user.email)).find((token) => token !== old); expect(fresh).toBeTruthy();
    expect((await post("verify-email", { token: old })).status).toBe(400); expect((await post("login", { email: user.email, password })).status).toBe(403);
    expect((await post("verify-email", { token: fresh })).status).toBe(204); expect((await post("login", { email: user.email, password })).status).toBe(200);
  });
  it("SMTP rejection reports failure, leaves pending account and invalidates attempted credential", async () => {
    const config = testAuthConfig();
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => { throw new Error("private SMTP credentials"); } }).compile();
    const failedApp = module.createNestApplication(); failedApp.useLogger(false); configureAuthHttp(failedApp, config); await failedApp.listen(0, "127.0.0.1");
    const email = `failed-${randomUUID()}@alu.frlp.utn.edu.ar`;
    try {
      const response = await fetch(`${await failedApp.getUrl()}/auth/register`, { method: "POST", headers: csrfHeaders, body: JSON.stringify({ email, displayName: "Delivery failure", password }) });
      expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("private SMTP");
      const user = await prisma.user.findUniqueOrThrow({ where: { email } }); ids.push(user.id); expect(user.emailVerifiedAt).toBeNull();
      const credential = await prisma.emailVerificationCredential.findFirstOrThrow({ where: { userId: user.id } }); expect(credential.invalidatedAt).not.toBeNull(); expect(credential.deliveredAt).toBeNull();
      expect((await post("login", { email, password })).status).toBe(403);
      expect((await post("resend-verification", { email })).status).toBe(202);
      const [token] = await tokens(email); expect((await post("verify-email", { token })).status).toBe(204);
    } finally { await failedApp.close(); }
  });

  it("concurrent resends leave one usable credential and cannot enable the account", async () => {
    const user = await account();
    const responses = await Promise.all([post("resend-verification", { email: user.email }), post("resend-verification", { email: user.email })]);
    expect(responses.map((response) => response.status)).toEqual([202, 202]);
    const active = await prisma.emailVerificationCredential.findMany({ where: { userId: user.id, invalidatedAt: null, consumedAt: null } }); expect(active).toHaveLength(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
    const messages = await tokens(user.email); const current = messages.find((token) => opaque.hash(token) === active[0]!.tokenHash); expect(current).toBeTruthy();
    for (const stale of messages.filter((token) => token !== current)) expect((await post("verify-email", { token: stale })).status).toBe(400);
    expect((await post("verify-email", { token: current })).status).toBe(204);
  });

});
