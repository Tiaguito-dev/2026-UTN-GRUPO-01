import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RefreshSession } from "../src/auth/application/refresh-session.js";
import { Logout } from "../src/auth/application/logout.js";
import { InvalidRefreshCredentialError } from "../src/auth/domain/refresh-errors.js";
import { InvalidAccessTokenError } from "../src/auth/domain/auth-errors.js";
import { CryptoRefreshTokenService } from "../src/auth/infrastructure/crypto-refresh-token.service.js";
import type { Session } from "../src/auth/domain/session.js";
import type { RefreshCredential } from "../src/auth/domain/refresh-credential.js";
import type { PublicUser, User } from "../src/users/domain/user.js";

const now = new Date("2026-10-08T12:00:00Z");
function fixture() {
  const user: User = { id: randomUUID(), email: "person@example.com", displayName: "Persona", passwordHash: "private-password-hash", role: "USER", createdAt: now };
  const session: Session = { id: randomUUID(), userId: user.id, createdAt: now, expiresAt: new Date(now.getTime() + 604800000), revokedAt: null };
  const users = { findById: vi.fn(async () => user as User | null), findByEmail: vi.fn(), create: vi.fn() };
  const sessions = { findById: vi.fn(async () => session), findValidById: vi.fn(), create: vi.fn() };
  const credentials = {
    createSession: vi.fn(), findByHash: vi.fn(), revokeSession: vi.fn(),
    rotate: vi.fn(async (_hash: string, _now: Date, callback: (session: Session, user: PublicUser | null) => Promise<RefreshCredential>) => { await callback(session, user); return "rotated" as "rotated" | "invalid" | "reused"; }),
  };
  const refreshTokens = { hash: vi.fn(() => "a".repeat(64) as string | null), generate: vi.fn(() => ({ value: "new-private-refresh", hash: "b".repeat(64) })) };
  const tokens = { issue: vi.fn(async () => "new-private-access"), verify: vi.fn(async () => ({ userId: user.id, sessionId: session.id, issuedAt: now.getTime() / 1000, expiresAt: now.getTime() / 1000 + 900 })) };
  const refresh = new RefreshSession(credentials, tokens, refreshTokens, 900, () => now);
  const logout = new Logout(sessions, credentials, tokens, refreshTokens, () => now);
  return { user, session, users, sessions, credentials, refreshTokens, tokens, refresh, logout };
}
describe("RefreshSession", () => {
  it("prepara credenciales para misma sesión con cuenta pública sin hash", async () => {
    const f = fixture(); const result = await f.refresh.execute("private-refresh");
    expect(f.credentials.rotate).toHaveBeenCalledWith("a".repeat(64), now, expect.any(Function));
    expect(result.user).not.toHaveProperty("passwordHash"); expect(result.refreshExpiresAt).toEqual(f.session.expiresAt);
    expect(result.accessToken).toBe("new-private-access"); expect(result.refreshToken).toBe("new-private-refresh");
    expect(f.tokens.issue).toHaveBeenCalledWith({ userId: f.user.id, sessionId: f.session.id, issuedAt: now.getTime() / 1000, expiresAt: now.getTime() / 1000 + 900 });
  });
  it("limita ambas credenciales al vencimiento absoluto", async () => {
    const f = fixture(); f.session.expiresAt = new Date(now.getTime() + 30000);
    const result = await f.refresh.execute("private-refresh"); expect(result.expiresAt).toEqual(f.session.expiresAt); expect(result.refreshExpiresAt).toEqual(f.session.expiresAt);
  });
  it.each([undefined, "malformed"])("rechaza credencial ausente/malformada sin DB %#", async (token) => {
    const f = fixture(); f.refreshTokens.hash.mockReturnValue(null);
    await expect(f.refresh.execute(token)).rejects.toBeInstanceOf(InvalidRefreshCredentialError); expect(f.credentials.rotate).not.toHaveBeenCalled();
  });
  it.each(["invalid", "reused"] as const)("rechaza estado %s sin devolver resultado preparado", async (status) => {
    const f = fixture(); f.credentials.rotate.mockImplementation(async () => status);
    await expect(f.refresh.execute("private-refresh")).rejects.toBeInstanceOf(InvalidRefreshCredentialError); expect(f.tokens.issue).not.toHaveBeenCalled();
  });
  it("usuario inexistente no emite credenciales", async () => {
    const f = fixture(); f.credentials.rotate.mockImplementation(async (_hash, _now, callback) => { await callback(f.session, null); return "rotated"; });
    await expect(f.refresh.execute("private-refresh")).rejects.toBeInstanceOf(InvalidRefreshCredentialError); expect(f.tokens.issue).not.toHaveBeenCalled();
  });
  it("fallo técnico de firma propaga sin confundirlo con 401", async () => {
    const f = fixture(); f.tokens.issue.mockRejectedValue(new Error("signing unavailable"));
    await expect(f.refresh.execute("private-refresh")).rejects.toThrow("signing unavailable");
  });
});
describe("Logout", () => {
  it("identifica access verificado y revoca solo sesión y usuario asociados", async () => {
    const f = fixture(); await f.logout.execute({ accessToken: "verified-access" });
    expect(f.tokens.verify).toHaveBeenCalledWith("verified-access"); expect(f.credentials.revokeSession).toHaveBeenCalledWith(f.session.id, now, f.user.id);
    expect(f.credentials.findByHash).not.toHaveBeenCalled();
  });
  it("usa refresh reconocido al rechazar JWT vencido sin leer claims", async () => {
    const f = fixture(); f.tokens.verify.mockRejectedValue(new InvalidAccessTokenError());
    f.credentials.findByHash.mockResolvedValue({ sessionId: f.session.id, consumedAt: now });
    await f.logout.execute({ accessToken: "expired-access", refreshToken: "recognized-refresh" });
    expect(f.credentials.revokeSession).toHaveBeenCalledWith(f.session.id, now);
  });
  it("no revoca por claims de usuario diferente a sesión", async () => {
    const f = fixture(); f.session.userId = randomUUID(); await f.logout.execute({ accessToken: "access" });
    expect(f.credentials.revokeSession).not.toHaveBeenCalled();
  });
  it("ausente y desconocido son no-op", async () => {
    const f = fixture(); f.credentials.findByHash.mockResolvedValue(null);
    await f.logout.execute({}); await f.logout.execute({ refreshToken: "unknown" }); expect(f.credentials.revokeSession).not.toHaveBeenCalled();
  });
  it("errores técnicos de verificación no se ocultan como cierre exitoso", async () => {
    const f = fixture(); f.tokens.verify.mockRejectedValue(new Error("verifier unavailable"));
    await expect(f.logout.execute({ accessToken: "access" })).rejects.toThrow("verifier unavailable");
  });
});
describe("Refresh opaco criptográfico", () => {
  const service = new CryptoRefreshTokenService();
  it("genera 32 bytes distintos y SHA256 verificable sin persistir original", () => {
    const a = service.generate(); const b = service.generate(); expect(a.value).not.toBe(b.value); expect(a.hash).not.toBe(b.hash);
    expect(Buffer.from(a.value, "base64url")).toHaveLength(32); expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hash(a.value)).toBe(a.hash); expect(a.hash).toBe(createHash("sha256").update(a.value).digest("hex"));
  });
  it.each(["", " ", "a".repeat(42), "a".repeat(44), "a".repeat(43), "*".repeat(43)])("rechaza representación inválida %#", (value) => {
    expect(service.hash(value)).toBeNull();
  });
});
