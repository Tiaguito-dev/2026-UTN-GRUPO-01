import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { Login } from "../src/auth/application/login.js";
import { AuthenticateRequest } from "../src/auth/application/authenticate-request.js";
import { InvalidCredentialsError, InvalidLoginInputError, UnauthenticatedError } from "../src/auth/domain/auth-errors.js";
import type { User } from "../src/users/domain/user.js";

const now = new Date("2026-10-08T12:00:00.567Z");
function fixture() {
  const user: User = { id: randomUUID(), email: "person@example.com", displayName: "Persona", passwordHash: "real-private-hash", role: "USER", createdAt: now };
  const users = { findByEmail: vi.fn(async () => user as User | null), findById: vi.fn(async () => user as User | null), create: vi.fn() };
  const passwords = { hash: vi.fn(), verify: vi.fn(async () => true) };
  const sessions = { create: vi.fn(async () => undefined), findById: vi.fn(), findValidById: vi.fn() };
  const refreshRepo = { createSession: vi.fn(async () => true), findByHash: vi.fn(), rotate: vi.fn(), revokeSession: vi.fn() };
  const refreshTokens = { generate: vi.fn(() => ({ value: "private-refresh", hash: "a".repeat(64) })), hash: vi.fn() };
  const tokens = { issue: vi.fn(async () => "private-token"), verify: vi.fn() };
  const sessionId = randomUUID();
  const login = new Login(users, passwords, refreshRepo, tokens, refreshTokens, "dummy-private-hash", 900, 604800, () => now, () => sessionId);
  return { user, users, passwords, sessions, refreshRepo, refreshTokens, tokens, sessionId, login };
}

describe("Login", () => {
  it("normaliza email, conserva contraseña y alinea sesión/token sin exponer hash", async () => {
    const f = fixture();
    const password = " exact password ";
    const result = await f.login.execute({ email: " PERSON@EXAMPLE.COM ", password });
    expect(f.users.findByEmail).toHaveBeenCalledWith("person@example.com");
    expect(f.passwords.verify).toHaveBeenCalledWith(f.user.passwordHash, password);
    expect(f.tokens.issue).toHaveBeenCalledWith({ userId: f.user.id, sessionId: f.sessionId, issuedAt: 1791460800, expiresAt: 1791461700 });
    expect(f.refreshRepo.createSession).toHaveBeenCalledWith({ id: f.sessionId, userId: f.user.id, createdAt: new Date("2026-10-08T12:00:00Z"), expiresAt: new Date("2026-10-15T12:00:00Z"), revokedAt: null }, expect.objectContaining({ sessionId: f.sessionId, tokenHash: "a".repeat(64), expiresAt: new Date("2026-10-15T12:00:00Z") }), f.user.passwordHash);
    expect(result.refreshToken).toBe("private-refresh");
    expect(result.refreshExpiresAt).toEqual(new Date("2026-10-15T12:00:00Z"));
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.accessToken).toBe("private-token");
    expect(result.expiresAt).toEqual(new Date("2026-10-08T12:15:00Z"));
  });
  it.each(["missing", "wrong"])("verifica hash y rechaza credenciales %s sin crear sesión", async (condition) => {
    const f = fixture();
    if (condition === "missing") f.users.findByEmail.mockResolvedValue(null);
    f.passwords.verify.mockResolvedValue(false);
    await expect(f.login.execute({ email: "person@example.com", password: "wrong" })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(f.passwords.verify).toHaveBeenCalledTimes(1);
    expect(f.passwords.verify).toHaveBeenCalledWith(condition === "missing" ? "dummy-private-hash" : f.user.passwordHash, "wrong");
    expect(f.refreshRepo.createSession).not.toHaveBeenCalled();
    expect(f.tokens.issue).not.toHaveBeenCalled();
  });
  it("un hash señuelo verificado tampoco autentica un email inexistente", async () => {
    const f = fixture(); f.users.findByEmail.mockResolvedValue(null);
    await expect(f.login.execute({ email: "person@example.com", password: "password" })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(f.refreshRepo.createSession).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { email: "invalid", password: "pass" }, { email: "person@example.com", password: "" }, { email: "person@example.com", password: "pass", role: "ADMIN" }, { email: "person@example.com", password: "pass", extra: true }])("rechaza input inválido %# antes de verificar/persistir", async (input) => {
    const f = fixture();
    await expect(f.login.execute(input)).rejects.toBeInstanceOf(InvalidLoginInputError);
    expect(f.passwords.verify).not.toHaveBeenCalled(); expect(f.refreshRepo.createSession).not.toHaveBeenCalled();
  });
  it("un fallo de firma no deja sesión huérfana", async () => {
    const f = fixture(); f.tokens.issue.mockRejectedValue(new Error("signing unavailable"));
    await expect(f.login.execute({ email: "person@example.com", password: "password" })).rejects.toThrow("signing unavailable");
    expect(f.refreshRepo.createSession).not.toHaveBeenCalled();
  });
  it("un fallo de persistencia no devuelve la credencial", async () => {
    const f = fixture(); f.refreshRepo.createSession.mockRejectedValue(new Error("database unavailable"));
    await expect(f.login.execute({ email: "person@example.com", password: "password" })).rejects.toThrow("database unavailable");
  });
});

describe("AuthenticateRequest", () => {
  it("devuelve contexto público con rol actual consultado en persistencia", async () => {
    const f = fixture(); f.user.role = "ADMIN";
    f.tokens.verify.mockResolvedValue({ userId: f.user.id, sessionId: f.sessionId, issuedAt: 1791460800, expiresAt: 1791461700 });
    f.sessions.findValidById.mockResolvedValue({ id: f.sessionId, userId: f.user.id, createdAt: new Date("2026-10-08T12:00:00Z"), expiresAt: new Date("2026-10-08T12:15:00Z"), revokedAt: null });
    const authenticate = new AuthenticateRequest(f.users, f.sessions, f.tokens, () => now);
    expect(await authenticate.execute("private-token")).toEqual({ id: f.user.id, email: f.user.email, displayName: f.user.displayName, role: "ADMIN" });
  });
  it.each(["absent", "other-user", "deleted-user"])("rechaza sesión/usuario %s", async (condition) => {
    const f = fixture();
    f.tokens.verify.mockResolvedValue({ userId: f.user.id, sessionId: f.sessionId, issuedAt: 1791460800, expiresAt: 1791461700 });
    f.sessions.findValidById.mockResolvedValue(condition === "absent" ? null : { id: f.sessionId, userId: condition === "other-user" ? randomUUID() : f.user.id, createdAt: new Date("2026-10-08T12:00:00Z"), expiresAt: new Date("2026-10-08T12:15:00Z"), revokedAt: null });
    if (condition === "deleted-user") f.users.findById.mockResolvedValue(null);
    await expect(new AuthenticateRequest(f.users, f.sessions, f.tokens, () => now).execute("token")).rejects.toBeInstanceOf(UnauthenticatedError);
    if (condition === "deleted-user") expect(f.users.findById).toHaveBeenCalledWith(f.user.id);
    else expect(f.users.findById).not.toHaveBeenCalled();
  });
});
