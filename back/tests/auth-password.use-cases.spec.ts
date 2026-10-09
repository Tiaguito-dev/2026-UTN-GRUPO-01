import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RequestPasswordReset } from "../src/auth/application/request-password-reset.js";
import { ResetPassword } from "../src/auth/application/reset-password.js";
import { ChangePassword } from "../src/auth/application/change-password.js";
import { InvalidPasswordChangeError, InvalidPasswordInputError, InvalidPasswordResetTokenError } from "../src/auth/domain/password-errors.js";

const now = new Date("2026-10-08T12:00:00Z");
function fixture() {
  const user = { id: randomUUID(), email: "person@example.test", passwordHash: "private-old-hash", displayName: "Persona", role: "USER" as const, createdAt: now };
  const credential = { id: randomUUID(), userId: user.id, tokenHash: "a".repeat(64), createdAt: now, expiresAt: new Date(now.getTime() + 1800000), consumedAt: null as Date | null, invalidatedAt: null as Date | null, deliveredAt: now as Date | null };
  const recovery = { issue: vi.fn(), invalidate: vi.fn(), markDelivered: vi.fn(async () => undefined), findByHash: vi.fn(async () => credential), reset: vi.fn(async () => true), findPasswordByUserId: vi.fn(async () => ({ id: user.id, passwordHash: user.passwordHash })), change: vi.fn(async () => true) };
  const users = { create: vi.fn(), findById: vi.fn(), findByEmail: vi.fn(async () => user as typeof user | null) };
  const tokens = { generate: vi.fn(() => ({ value: "private-reset-token", hash: credential.tokenHash })), hash: vi.fn(() => credential.tokenHash as string | null) };
  const email = { send: vi.fn() }; const report = vi.fn(); const delay = vi.fn();
  const passwords = { hash: vi.fn(async () => "private-new-hash"), verify: vi.fn(async () => true) };
  const request = new RequestPasswordReset(users, recovery, email, tokens, 1800, 2000, report, () => now, () => credential.id, delay);
  const reset = new ResetPassword(recovery, passwords, tokens, () => now);
  const change = new ChangePassword(recovery, passwords, () => now);
  return { user, credential, recovery, users, tokens, email, report, delay, passwords, request, reset, change };
}
describe("RequestPasswordReset", () => {
  it("normaliza email, persiste hash y entrega original solo al puerto email fuera de persistencia", async () => {
    const f = fixture(); await f.request.execute({ email: " PERSON@EXAMPLE.TEST " });
    expect(f.users.findByEmail).toHaveBeenCalledWith(f.user.email);
    expect(f.recovery.issue).toHaveBeenCalledWith(expect.objectContaining({ tokenHash: f.credential.tokenHash, userId: f.user.id, expiresAt: f.credential.expiresAt }));
    expect(JSON.stringify(f.recovery.issue.mock.calls)).not.toContain("private-reset-token");
    expect(f.email.send).toHaveBeenCalledWith({ email: f.user.email, token: "private-reset-token", expiresAt: f.credential.expiresAt });
    expect(f.delay).toHaveBeenCalledOnce();
  });
  it("cuenta desconocida genera/digiere y espera el mismo piso sin emitir email", async () => {
    const f = fixture(); f.users.findByEmail.mockResolvedValue(null); await expect(f.request.execute({ email: f.user.email })).resolves.toBeUndefined();
    expect(f.tokens.generate).toHaveBeenCalledOnce(); expect(f.delay).toHaveBeenCalledOnce(); expect(f.recovery.issue).not.toHaveBeenCalled(); expect(f.email.send).not.toHaveBeenCalled();
  });
  it("fallo SMTP invalida exclusivamente el id recién creado y registra solo código fijo", async () => {
    const f = fixture(); f.email.send.mockRejectedValue(new Error("private-token smtp-password"));
    await expect(f.request.execute({ email: f.user.email })).resolves.toBeUndefined();
    expect(f.recovery.invalidate).toHaveBeenCalledWith(f.credential.id, now); expect(f.report).toHaveBeenCalledWith("PASSWORD_RESET_DELIVERY_FAILED");
    expect(JSON.stringify(f.report.mock.calls)).not.toMatch(/private-token|smtp-password|person@/);
    expect(f.recovery.markDelivered).not.toHaveBeenCalled();
  });
  it("fallos internos y de invalidación conservan respuesta genérica y credencial pendiente", async () => {
    const f = fixture(); f.email.send.mockRejectedValue(new Error("secret")); f.recovery.invalidate.mockRejectedValue(new Error("private database"));
    await expect(f.request.execute({ email: f.user.email })).resolves.toBeUndefined(); expect(f.recovery.markDelivered).not.toHaveBeenCalled(); expect(f.report).toHaveBeenCalledWith("PASSWORD_RESET_INVALIDATION_FAILED");
    f.users.findByEmail.mockRejectedValue(new Error("database")); await expect(f.request.execute({ email: f.user.email })).resolves.toBeUndefined();
  });
  it.each([{}, { email: "invalid" }, { email: "a@example.test", userId: "chosen" }])("entrada inválida %# no consulta cuenta", async (input) => {
    const f = fixture(); await expect(f.request.execute(input)).rejects.toBeInstanceOf(InvalidPasswordInputError); expect(f.users.findByEmail).not.toHaveBeenCalled();
  });
});
describe("ResetPassword", () => {
  it.each(["12345678", "😀".repeat(8)])("restablece con el mínimo de ocho caracteres", async (newPassword) => {
    const f = fixture();
    await f.reset.execute({ token: "private-reset-token", newPassword });
    expect(f.passwords.hash).toHaveBeenCalledWith(newPassword);
    expect(f.recovery.reset).toHaveBeenCalledOnce();
  });
  it.each(["1234567", "😀".repeat(7)])("rechaza siete caracteres sin consumir la recuperación", async (newPassword) => {
    const f = fixture();
    await expect(f.reset.execute({ token: "private-reset-token", newPassword })).rejects.toBeInstanceOf(InvalidPasswordInputError);
    expect(f.passwords.hash).not.toHaveBeenCalled();
    expect(f.recovery.reset).not.toHaveBeenCalled();
  });
  it("preserva contraseña exacta y delega operación atómica con hash", async () => {
    const f = fixture(); const password = " exact new password "; await f.reset.execute({ token: "private-reset-token", newPassword: password });
    expect(f.passwords.hash).toHaveBeenCalledWith(password); expect(f.recovery.reset).toHaveBeenCalledWith(f.credential.tokenHash, "private-new-hash", now);
  });
  it.each(["expired", "consumed", "invalidated", "pending"])("rechaza estado %s antes del hashing", async (state) => {
    const f = fixture(); if (state === "expired") f.credential.expiresAt = now; if (state === "consumed") f.credential.consumedAt = now; if (state === "invalidated") f.credential.invalidatedAt = now; if (state === "pending") f.credential.deliveredAt = null;
    await expect(f.reset.execute({ token: "private-reset-token", newPassword: " replacement password " })).rejects.toBeInstanceOf(InvalidPasswordResetTokenError); expect(f.passwords.hash).not.toHaveBeenCalled();
  });
  it("contraseña inválida no consulta ni consume token", async () => {
    const f = fixture(); await expect(f.reset.execute({ token: "private-reset-token", newPassword: "short" })).rejects.toBeInstanceOf(InvalidPasswordInputError); expect(f.recovery.reset).not.toHaveBeenCalled(); expect(f.recovery.findByHash).not.toHaveBeenCalled();
  });
  it("hash fallido o fallo técnico se propaga sin consumir parcialmente", async () => {
    const f = fixture(); f.passwords.hash.mockRejectedValueOnce(new Error("hash failure")); await expect(f.reset.execute({ token: "private-reset-token", newPassword: " replacement password " })).rejects.toThrow("hash failure"); expect(f.recovery.reset).not.toHaveBeenCalled();
    f.recovery.reset.mockRejectedValue(new Error("database failure")); await expect(f.reset.execute({ token: "private-reset-token", newPassword: " replacement password " })).rejects.toThrow("database failure");
  });
  it("token invalidado durante hashing no puede sobrescribir contraseña", async () => {
    const f = fixture(); f.recovery.reset.mockResolvedValue(false); await expect(f.reset.execute({ token: "private-reset-token", newPassword: " replacement password " })).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });
});
describe("ChangePassword", () => {
  it.each(["12345678", "😀".repeat(8)])("cambia a una contraseña de ocho caracteres", async (newPassword) => {
    const f = fixture();
    await f.change.execute(f.user.id, { currentPassword: " exact old password ", newPassword });
    expect(f.passwords.hash).toHaveBeenCalledWith(newPassword);
    expect(f.recovery.change).toHaveBeenCalledOnce();
  });
  it.each(["1234567", "😀".repeat(7)])("rechaza siete caracteres sin modificar la cuenta", async (newPassword) => {
    const f = fixture();
    await expect(f.change.execute(f.user.id, { currentPassword: " exact old password ", newPassword })).rejects.toBeInstanceOf(InvalidPasswordInputError);
    expect(f.passwords.hash).not.toHaveBeenCalled();
    expect(f.recovery.change).not.toHaveBeenCalled();
  });
  it("usa id del contexto y compara hash verificado antes de actualizar", async () => {
    const f = fixture(); await f.change.execute(f.user.id, { currentPassword: " exact old password ", newPassword: " replacement password " });
    expect(f.passwords.verify).toHaveBeenCalledWith(f.user.passwordHash, " exact old password "); expect(f.recovery.change).toHaveBeenCalledWith(f.user.id, f.user.passwordHash, "private-new-hash", now);
  });
  it.each(["wrong", "equal", "stale"])("rechaza %s sin modificación aceptada", async (state) => {
    const f = fixture(); if (state === "wrong") f.passwords.verify.mockResolvedValue(false); if (state === "stale") f.recovery.change.mockResolvedValue(false);
    await expect(f.change.execute(f.user.id, { currentPassword: " exact old password ", newPassword: state === "equal" ? " exact old password " : " replacement password " })).rejects.toBeInstanceOf(InvalidPasswordChangeError);
    if (state !== "stale") expect(f.recovery.change).not.toHaveBeenCalled();
  });
});
