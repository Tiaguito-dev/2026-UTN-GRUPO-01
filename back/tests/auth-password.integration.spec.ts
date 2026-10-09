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
import { PASSWORD_RESET_EMAIL } from "../src/auth/domain/password-reset-email.js";
import { CryptoRefreshTokenService } from "../src/auth/infrastructure/crypto-refresh-token.service.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { PrismaPasswordRecoveryRepository } from "../src/auth/infrastructure/prisma-password-recovery.repository.js";
import { PrismaRefreshCredentialRepository } from "../src/auth/infrastructure/prisma-refresh-credential.repository.js";
import { PrismaUserRepository } from "../src/users/infrastructure/prisma-user.repository.js";
import { Login } from "../src/auth/application/login.js";
import { ChangePassword } from "../src/auth/application/change-password.js";
import { ResetPassword } from "../src/auth/application/reset-password.js";
import { RequestPasswordReset } from "../src/auth/application/request-password-reset.js";
import { Argon2PasswordHasher } from "../src/auth/infrastructure/argon2-password-hasher.js";
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";
import { PASSWORD_RECOVERY_REPOSITORY } from "../src/auth/domain/password-recovery.repository.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
describe.skipIf(!databaseUrl)("Recuperación y cambio HTTP con persistencia PostgreSQL", () => {
  let app: INestApplication, prisma: PrismaClient, url: string;
  const ids: string[] = [];
  const inbox: { email: string; token: string; expiresAt: Date }[] = [];
  let failMail = false;
  const config = testAuthConfig({ AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS: "200", AUTH_RESET_PASSWORD_MAX_ATTEMPTS: "200", AUTH_CHANGE_PASSWORD_MAX_ATTEMPTS: "200" });
  const opaque = new CryptoRefreshTokenService();
  const oldPassword = " old integration password ", newPassword = " new integration password ";
  const post = (path: string, body: unknown = {}, cookies = "", headers = csrfHeaders, base = url) => fetch(`${base}${path}`, { method: "POST", headers: { ...headers, Cookie: cookies }, body: JSON.stringify(body) });
  const jar = (response: Response) => response.headers.getSetCookie().map((v) => v.split(";")[0]).join("; ");
  const me = (cookies: string) => fetch(`${url}/auth/me`, { headers: { Cookie: cookies } });
  async function fixture() {
    const email = `password-${randomUUID()}@example.test`;
    const registered = await post("/auth/register", { email, displayName: "Recovery", password: oldPassword });
    expect(registered.status).toBe(201); const user = await registered.json(); ids.push(user.id);
    const login = await post("/auth/login", { email, password: oldPassword }); expect(login.status).toBe(200);
    return { email, user, cookies: jar(login) };
  }
  async function request(email: string) {
    const response = await post("/auth/forgot-password", { email }); expect(response.status).toBe(202);
    return inbox.filter((message) => message.email === email).at(-1)!;
  }
  async function assertRevoked(userId: string) {
    expect(await prisma.session.count({ where: { userId, revokedAt: null } })).toBe(0);
    expect(await prisma.refreshCredential.count({ where: { session: { userId }, consumedAt: null, invalidatedAt: null } })).toBe(0);
  }
  function assertClear(response: Response) {
    const cookies = response.headers.getSetCookie(); expect(cookies).toHaveLength(2);
    expect(cookies.find((cookie) => cookie.startsWith(`${config.cookieName}=`))).toMatch(/Path=\/;/);
    expect(cookies.find((cookie) => cookie.startsWith(`${config.refreshCookieName}=`))).toMatch(/Path=\/auth;/);
    for (const cookie of cookies) expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  }
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) }); await prisma.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(PASSWORD_RESET_EMAIL).useValue({ send: async (message: typeof inbox[number]) => { if (failMail) throw new Error("private smtp detail"); inbox.push(message); } }).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config); await app.listen(0, "127.0.0.1"); url = await app.getUrl();
  }, 20000);
  afterAll(async () => {
    if (prisma && ids.length) {
      await prisma.passwordResetCredential.deleteMany({ where: { userId: { in: ids } } });
      await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: ids } } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });
  it.each(["12345678", "😀".repeat(8)])("reset y cambio aceptan ocho caracteres, rechazan siete y conservan token y sesión", async (accepted) => {
    const f = await fixture(); const message = await request(f.email);
    const rejected = Array.from(accepted).slice(0, 7).join("");
    expect((await post("/auth/reset-password", { token: message.token, newPassword: rejected })).status).toBe(400);
    expect((await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(message.token)! } })).consumedAt).toBeNull();
    expect((await post("/auth/reset-password", { token: message.token, newPassword: accepted })).status).toBe(204);
    expect((await post("/auth/login", { email: f.email, password: accepted })).status).toBe(200);
    const other = await fixture();
    expect((await post("/auth/change-password", { currentPassword: oldPassword, newPassword: rejected }, other.cookies)).status).toBe(400);
    expect((await me(other.cookies)).status).toBe(200);
    expect((await post("/auth/change-password", { currentPassword: oldPassword, newPassword: accepted }, other.cookies)).status).toBe(204);
    await assertRevoked(other.user.id);
    expect((await post("/auth/login", { email: other.email, password: accepted })).status).toBe(200);
  });

  it("emails existentes e inexistentes tienen respuesta equivalente sin token y no-store", async () => {
    const f = await fixture(); const known = await post("/auth/forgot-password", { email: ` ${f.email.toUpperCase()} ` });
    const unknown = await post("/auth/forgot-password", { email: `unknown-${randomUUID()}@example.test` });
    expect(known.status).toBe(202); expect(unknown.status).toBe(202); const body = await known.json(); expect(await unknown.json()).toEqual(body);
    expect(body).toEqual({ message: "Si existe una cuenta asociada al email, recibirás instrucciones para recuperar tu contraseña." });
    const message = inbox.find((m) => m.email === f.email)!; expect(message).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(message.token); expect(known.headers.get("cache-control")).toBe("no-store");
    const stored = await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(message.token)! } });
    expect(Buffer.from(message.token, "base64url")).toHaveLength(32); expect(JSON.stringify(stored)).not.toContain(message.token);
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(config.passwordResetTtlSeconds * 1000);
  });
  it("el piso temporal se aplica a cuenta desconocida y JSON malformado no filtra datos", async () => {
    const started = performance.now(); const response = await post("/auth/forgot-password", { email: `missing-${randomUUID()}@example.test` }); expect(response.status).toBe(202); expect(performance.now() - started).toBeGreaterThanOrEqual(450);
    for (const endpoint of ["forgot-password", "reset-password", "change-password"]) {
      const malformed = await fetch(`${url}/auth/${endpoint}`, { method: "POST", headers: csrfHeaders, body: '{"newPassword":"private malformed password",' });
      expect(malformed.status).toBe(400); expect(malformed.headers.get("cache-control")).toBe("no-store"); expect(JSON.stringify(await malformed.json())).not.toMatch(/private malformed|stack|SyntaxError/);
    }
  });
  it("nueva solicitud invalida anterior y fallo SMTP no deja token utilizable ni revela cuenta", async () => {
    const f = await fixture(); const first = await request(f.email); const second = await request(f.email);
    expect((await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(first.token)! } })).invalidatedAt).not.toBeNull();
    expect((await post("/auth/reset-password", { token: first.token, newPassword })).status).toBe(400);
    failMail = true;
    try {
      const known = await post("/auth/forgot-password", { email: f.email }); const unknown = await post("/auth/forgot-password", { email: `missing-${randomUUID()}@example.test` });
      expect(known.status).toBe(202); expect(await known.json()).toEqual(await unknown.json());
      expect(await prisma.passwordResetCredential.count({ where: { userId: f.user.id, consumedAt: null, invalidatedAt: null } })).toBe(0);
    } finally { failMail = false; }
    expect(second.token).not.toBe(first.token);
  });
  it("restablece una vez, revoca todas las sesiones, limpia cookies y exige nuevo login", async () => {
    const f = await fixture(); const secondLogin = await post("/auth/login", { email: f.email, password: oldPassword });
    const message = await request(f.email);
    const response = await post("/auth/reset-password", { token: message.token, newPassword }, f.cookies);
    expect(response.status).toBe(204); assertClear(response); await assertRevoked(f.user.id);
    expect((await me(f.cookies)).status).toBe(401); expect((await me(jar(secondLogin))).status).toBe(401);
    expect((await post("/auth/refresh", {}, f.cookies)).status).toBe(401);
    expect((await post("/auth/reset-password", { token: message.token, newPassword })).status).toBe(400);
    expect((await post("/auth/login", { email: f.email, password: oldPassword })).status).toBe(401);
    expect((await post("/auth/login", { email: f.email, password: newPassword })).status).toBe(200);
  });
  it("contraseña inválida no consume token; token ausente/desconocido/vencido/consumido da error equivalente", async () => {
    const f = await fixture(); const message = await request(f.email); const hash = opaque.hash(message.token)!;
    expect((await post("/auth/reset-password", { token: message.token, newPassword: "short" })).status).toBe(400);
    expect((await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: hash } })).consumedAt).toBeNull();
    const unknown = await post("/auth/reset-password", { token: opaque.generate().value, newPassword }); const error = await unknown.json();
    await prisma.passwordResetCredential.update({ where: { tokenHash: hash }, data: { expiresAt: new Date(0) } });
    const expired = await post("/auth/reset-password", { token: message.token, newPassword }); expect(expired.status).toBe(400); expect(await expired.json()).toEqual(error);
    const next = await request(f.email); expect((await post("/auth/reset-password", { token: next.token, newPassword })).status).toBe(204);
    const consumed = await post("/auth/reset-password", { token: next.token, newPassword }); expect(await consumed.json()).toEqual(error);
  });
  it("cambio rechaza actual incorrecta, nueva igual e identificador elegido sin modificar persistencia", async () => {
    const f = await fixture(); await request(f.email); const before = await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } });
    for (const body of [{ currentPassword: "wrong", newPassword }, { currentPassword: oldPassword, newPassword: oldPassword }, { currentPassword: oldPassword, newPassword, userId: f.user.id }]) {
      expect((await post("/auth/change-password", body, f.cookies)).status).toBe(400);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash).toBe(before.passwordHash);
      expect((await me(f.cookies)).status).toBe(200);
      expect(await prisma.passwordResetCredential.count({ where: { userId: f.user.id, invalidatedAt: null, consumedAt: null } })).toBe(1);
    }
  });
  it("cambio correcto invalida recuperación y todas las sesiones incluida actual", async () => {
    const f = await fixture(); const message = await request(f.email); const other = await post("/auth/login", { email: f.email, password: oldPassword });
    const response = await post("/auth/change-password", { currentPassword: oldPassword, newPassword }, f.cookies);
    expect(response.status).toBe(204); assertClear(response); await assertRevoked(f.user.id);
    expect((await me(f.cookies)).status).toBe(401); expect((await me(jar(other))).status).toBe(401);
    expect((await post("/auth/reset-password", { token: message.token, newPassword: " another replacement password " })).status).toBe(400);
    expect((await post("/auth/login", { email: f.email, password: oldPassword })).status).toBe(401);
    expect((await post("/auth/login", { email: f.email, password: newPassword })).status).toBe(200);
    expect((await post("/auth/change-password", { currentPassword: newPassword, newPassword: oldPassword })).status).toBe(401);
  });
  it("dos resets concurrentes consumen una sola vez y dos cambios solo aceptan hash vigente", async () => {
    const f = await fixture(); const message = await request(f.email);
    const resets = await Promise.all([post("/auth/reset-password", { token: message.token, newPassword }), post("/auth/reset-password", { token: message.token, newPassword })]);
    expect(resets.map((response) => response.status).sort()).toEqual([204, 400]);
    const second = await fixture(); const changes = await Promise.all([post("/auth/change-password", { currentPassword: oldPassword, newPassword }, second.cookies), post("/auth/change-password", { currentPassword: oldPassword, newPassword: " different new password " }, second.cookies)]);
    const status = changes.map((r) => r.status).sort(); expect(status[0]).toBe(204); expect([400, 401]).toContain(status[1]); await assertRevoked(second.user.id);
  });
  it("refresh concurrente con cambio no deja sesión ni reemplazo válido", async () => {
    const f = await fixture(); const [refresh, change] = await Promise.all([post("/auth/refresh", {}, f.cookies), post("/auth/change-password", { currentPassword: oldPassword, newPassword }, f.cookies)]);
    expect([200, 401]).toContain(refresh.status); expect(change.status).toBe(204); await assertRevoked(f.user.id);
    expect((await me(refresh.status === 200 ? jar(refresh) : f.cookies)).status).toBe(401);
  });
  it("login que verificó contraseña anterior no crea sesión después del cambio", async () => {
    const f = await fixture(); const hasher = new Argon2PasswordHasher(); const repository = new PrismaPasswordRecoveryRepository(prisma as PrismaService);
    let release!: () => void, verified!: () => void; const blocked = new Promise<void>((r) => { release = r; }); const reached = new Promise<void>((r) => { verified = r; });
    const passwords = { hash: hasher.hash.bind(hasher), verify: async (hash: string, password: string) => { const result = await hasher.verify(hash, password); verified(); await blocked; return result; } };
    const useCase = new Login(new PrismaUserRepository(prisma as PrismaService), passwords, new PrismaRefreshCredentialRepository(prisma as PrismaService), new JoseAccessTokenService(config), opaque, await hasher.hash(" harmless dummy password "), 900, 604800);
    const pending = useCase.execute({ email: f.email, password: oldPassword }); await reached;
    await new ChangePassword(repository, hasher).execute(f.user.id, { currentPassword: oldPassword, newPassword }); release();
    await expect(pending).rejects.toThrow(); await assertRevoked(f.user.id); expect(await prisma.session.count({ where: { userId: f.user.id } })).toBe(1);
  });
  it("dos cambios que verificaron el mismo hash se resuelven con una sola actualización", async () => {
    const f = await fixture(); const hasher = new Argon2PasswordHasher(); let count = 0, release!: () => void; const barrier = new Promise<void>((r) => { release = r; });
    const passwords = { hash: hasher.hash.bind(hasher), verify: async (hash: string, password: string) => { const valid = await hasher.verify(hash, password); if (++count === 2) release(); await barrier; return valid; } };
    const change = new ChangePassword(new PrismaPasswordRecoveryRepository(prisma as PrismaService), passwords);
    const results = await Promise.allSettled([change.execute(f.user.id, { currentPassword: oldPassword, newPassword }), change.execute(f.user.id, { currentPassword: oldPassword, newPassword: " different replacement password " })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1); await assertRevoked(f.user.id);
  });
  it("reset detenido durante hashing no sobrescribe cambio que invalidó su token", async () => {
    const f = await fixture(); const message = await request(f.email); const hasher = new Argon2PasswordHasher(); const repository = new PrismaPasswordRecoveryRepository(prisma as PrismaService);
    let release!: () => void, reached!: () => void; const barrier = new Promise<void>((r) => { release = r; }); const hashing = new Promise<void>((r) => { reached = r; });
    const passwords = { verify: hasher.verify.bind(hasher), hash: async (password: string) => { const hash = await hasher.hash(password); reached(); await barrier; return hash; } };
    const pending = new ResetPassword(repository, passwords, opaque).execute({ token: message.token, newPassword: " reset replacement password " }); await hashing;
    await new ChangePassword(repository, hasher).execute(f.user.id, { currentPassword: oldPassword, newPassword }); release(); await expect(pending).rejects.toThrow();
    expect(await hasher.verify((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash, newPassword)).toBe(true);
  });
  it("fallo de entrega tardío invalida solo su credencial sin afectar solicitud posterior", async () => {
    const f = await fixture(); const repository = new PrismaPasswordRecoveryRepository(prisma as PrismaService); let fail!: () => void, reached!: () => void;
    const delivery = new Promise<void>((_r, reject) => { fail = () => reject(new Error("smtp unavailable")); }); const sending = new Promise<void>((r) => { reached = r; });
    const pending = new RequestPasswordReset(new PrismaUserRepository(prisma as PrismaService), repository, { send: async () => { reached(); await delivery; } }, opaque, 1800, 0).execute({ email: f.email }); await sending;
    const newer = await request(f.email); fail(); await pending;
    expect((await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(newer.token)! } })).invalidatedAt).toBeNull();
    expect((await post("/auth/reset-password", { token: newer.token, newPassword })).status).toBe(204);
  });
  it("fallo SMTP más invalidación fallida nunca activa una credencial pendiente", async () => {
    const f = await fixture(); const repository = new PrismaPasswordRecoveryRepository(prisma as PrismaService); let original = "";
    const failing = { issue: repository.issue.bind(repository), markDelivered: repository.markDelivered.bind(repository), invalidate: async () => { throw new Error("database unavailable"); }, findByHash: repository.findByHash.bind(repository), findPasswordByUserId: repository.findPasswordByUserId.bind(repository), reset: repository.reset.bind(repository), change: repository.change.bind(repository) };
    await new RequestPasswordReset(new PrismaUserRepository(prisma as PrismaService), failing, { send: async ({ token }) => { original = token; throw new Error("smtp unavailable"); } }, opaque, 1800, 0).execute({ email: f.email });
    const stored = await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(original)! } }); expect(stored.deliveredAt).toBeNull();
    expect(await repository.reset(stored.tokenHash, "new hash", new Date())).toBe(false); expect((await post("/auth/reset-password", { token: original, newPassword })).status).toBe(400);
  });
  it("falla técnica reset informa 500 sin limpiar cookies ni consumir credencial", async () => {
    const f = await fixture(); const message = await request(f.email); const repository = new PrismaPasswordRecoveryRepository(prisma as PrismaService);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).overrideProvider(PASSWORD_RESET_EMAIL).useValue({ send: async () => {} })
      .overrideProvider(PASSWORD_RECOVERY_REPOSITORY).useValue({ findByHash: repository.findByHash.bind(repository), reset: async () => { throw new Error("private database details"); } }).compile();
    const failing = module.createNestApplication(); failing.useLogger(false); configureAuthHttp(failing, config); await failing.listen(0, "127.0.0.1");
    try {
      const response = await post("/auth/reset-password", { token: message.token, newPassword }, f.cookies, csrfHeaders, await failing.getUrl()); expect(response.status).toBe(500); expect(response.headers.getSetCookie()).toHaveLength(0); expect(JSON.stringify(await response.json())).not.toMatch(/private database|stack|Prisma/);
      expect((await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(message.token)! } })).consumedAt).toBeNull(); expect((await me(f.cookies)).status).toBe(200);
    } finally { await failing.close(); }
  });
  it("restricción real de base provoca rollback de hash, consumo y revocaciones", async () => {
    const f = await fixture(); const message = await request(f.email); const repository = new PrismaPasswordRecoveryRepository(prisma as PrismaService);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } });
    // A fixture-scoped trigger fails during revocation, after the password and token
    // writes. This proves transaction rollback rather than input validation alone.
    const trigger = `auth_reset_fail_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${f.user.id}'::uuid THEN RAISE EXCEPTION 'fixture revocation failure'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "Session" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
      await expect(repository.reset(opaque.hash(message.token)!, "new persisted hash", new Date())).rejects.toThrow();
      await expect(repository.change(f.user.id, before.passwordHash, "new changed hash", new Date())).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Session"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash).toBe(before.passwordHash);
    expect((await prisma.passwordResetCredential.findUniqueOrThrow({ where: { tokenHash: opaque.hash(message.token)! } })).consumedAt).toBeNull();
    expect((await me(f.cookies)).status).toBe(200); expect((await post("/auth/reset-password", { token: message.token, newPassword })).status).toBe(204);
  });
  it.each(["forgot-password", "reset-password", "change-password"])("CSRF protege %s incluso sin credenciales", async (endpoint) => {
    const response = await post(`/auth/${endpoint}`, {}, "", { "Content-Type": "application/json" } as typeof csrfHeaders);
    expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["forgot-password", "reset-password", "change-password"])("rate configurable protege %s e ignora XFF no confiable", async (endpoint) => {
    const prefix = endpoint.replaceAll("-", "_").toUpperCase(); const limitedConfig = testAuthConfig({ [`AUTH_${prefix}_MAX_ATTEMPTS`]: "1" });
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(limitedConfig).overrideProvider(PASSWORD_RESET_EMAIL).useValue({ send: async () => {} }).compile();
    const limited = module.createNestApplication(); limited.useLogger(false); configureAuthHttp(limited, limitedConfig); await limited.listen(0, "127.0.0.1");
    try {
      for (let i = 0; i < 2; i++) {
        const response = await post(`/auth/${endpoint}`, {}, "", { ...csrfHeaders, "X-Forwarded-For": `203.0.113.${i + 1}` } as typeof csrfHeaders, await limited.getUrl());
        expect(response.status).toBe(i === 1 ? 429 : endpoint === "change-password" ? 401 : 400);
      }
    } finally { await limited.close(); }
  });
});
