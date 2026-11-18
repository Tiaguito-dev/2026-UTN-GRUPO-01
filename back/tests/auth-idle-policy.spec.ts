import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AuthenticateRequest } from "../src/auth/application/authenticate-request.js";
import { UnauthenticatedError } from "../src/auth/domain/auth-errors.js";
import { readAuthConfig } from "../src/auth/auth.config.js";
import { testAuthEnvironment } from "./auth-test.config.js";

const now = new Date("2026-11-03T12:00:00Z");
function fixture(inactiveSeconds: number) {
  const user = { id: randomUUID(), email: "idle@example.test", displayName: "Cuenta", role: "USER" as const,
    passwordHash: "private", emailVerifiedAt: now, createdAt: now };
  const session = { id: randomUUID(), userId: user.id, createdAt: new Date(now.getTime() - 3600_000),
    lastActivityAt: new Date(now.getTime() - inactiveSeconds * 1000), expiresAt: new Date(now.getTime() + 86400_000), revokedAt: null };
  const users = { findAll: vi.fn(), findById: vi.fn(async () => user), findByEmail: vi.fn(), create: vi.fn() };
  const sessions = { create: vi.fn(), findById: vi.fn(), findValidById: vi.fn(async () => session) };
  const tokens = { issue: vi.fn(), verify: vi.fn(async () => ({ userId: user.id, sessionId: session.id,
    issuedAt: now.getTime() / 1000 - 60, expiresAt: now.getTime() / 1000 + 600 })) };
  return { users, sessions, tokens, session, authenticate: new AuthenticateRequest(users, sessions, tokens, () => now) };
}

describe("política de inactividad backend", () => {
  it("configura treinta minutos y dos minutos de aviso por defecto", () => {
    expect(readAuthConfig(testAuthEnvironment())).toMatchObject({ idleTtlSeconds: 1800, idleWarningSeconds: 120 });
  });
  it.each([
    { AUTH_IDLE_TTL_SECONDS: "0" }, { AUTH_IDLE_TTL_SECONDS: "1.5" },
    { AUTH_IDLE_WARNING_SECONDS: "0" }, { AUTH_IDLE_WARNING_SECONDS: "1800" },
    { AUTH_IDLE_TTL_SECONDS: "60", AUTH_IDLE_WARNING_SECONDS: "120" },
  ])("rechaza plazos inválidos antes de iniciar %#", (overrides) => {
    expect(() => readAuthConfig(testAuthEnvironment(overrides))).toThrow(/AUTH_IDLE/);
  });
  it.each([1800, 1801, 3600])("rechaza JWT todavía válido tras %i segundos inactivo", async (seconds) => {
    const f = fixture(seconds);
    await expect(f.authenticate.execute("access-token")).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(f.users.findById).not.toHaveBeenCalled();
  });
  it("el aviso todavía permite autenticación sin prolongar la actividad", async () => {
    const f = fixture(1680);
    const before = f.session.lastActivityAt;
    await expect(f.authenticate.execute("access-token")).resolves.toMatchObject({ id: f.session.userId });
    expect(f.session.lastActivityAt).toBe(before);
  });
  it("rechaza si una consulta de usuario cruza el límite de inactividad", async () => {
    const f = fixture(1799);
    let checkedAt = now;
    f.users.findById.mockImplementation(async () => {
      checkedAt = new Date(now.getTime() + 1000);
      return { id: f.session.userId, email: "idle@example.test", displayName: "Cuenta", role: "USER" as const,
        passwordHash: "private", emailVerifiedAt: now, createdAt: now };
    });
    const authenticate = new AuthenticateRequest(f.users, f.sessions, f.tokens, () => checkedAt);
    await expect(authenticate.execute("access-token")).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
