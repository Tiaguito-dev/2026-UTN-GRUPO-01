import { describe, expect, it, vi } from "vitest";
import { EmailVerification } from "../src/auth/application/email-verification.js";
import { InvalidEmailVerificationTokenError, VerificationDeliveryError } from "../src/auth/domain/email-verification.js";
const now = new Date("2026-10-20T12:00:00Z");
function fixture() {
  const user = { id: "user", email: "person@alu.frlp.utn.edu.ar", displayName: "Persona", passwordHash: "hash", role: "USER" as const, createdAt: now, emailVerifiedAt: null as Date | null };
  const users = { findAll: vi.fn(), findById: vi.fn(), create: vi.fn(), findByEmail: vi.fn(async () => user as typeof user | null) };
  const repository = { issue: vi.fn(async () => true), invalidate: vi.fn(), markDelivered: vi.fn(), verify: vi.fn(async () => true) };
  const email = { send: vi.fn(async () => undefined) };
  const tokens = { generate: vi.fn(() => ({ value: "private-token", hash: "hash-only" })), hash: vi.fn(() => "hash-only" as string | null) };
  return { user, users, repository, email, tokens, service: new EmailVerification(users, repository, email, tokens, () => now, () => "credential") };
}
describe("EmailVerification", () => {
  it("persists only a hash and marks delivery after SMTP accepts the message", async () => {
    const f = fixture(); await f.service.requestForUser(f.user.id, f.user.email);
    expect(f.repository.issue).toHaveBeenCalledWith({ id: "credential", userId: "user", tokenHash: "hash-only", createdAt: now, expiresAt: new Date("2026-10-21T12:00:00Z"), consumedAt: null, invalidatedAt: null, deliveredAt: null });
    expect(f.email.send).toHaveBeenCalledWith({ email: f.user.email, token: "private-token", expiresAt: new Date("2026-10-21T12:00:00Z") });
    expect(f.repository.markDelivered).toHaveBeenCalledWith("credential", now);
    expect(f.email.send.mock.invocationCallOrder[0]).toBeLessThan(f.repository.markDelivered.mock.invocationCallOrder[0]!);
  });
  it("SMTP failure invalidates only its credential and reports pending delivery", async () => {
    const f = fixture(); f.email.send.mockRejectedValue(new Error("private provider failure"));
    await expect(f.service.requestForUser(f.user.id, f.user.email)).rejects.toBeInstanceOf(VerificationDeliveryError);
    expect(f.repository.invalidate).toHaveBeenCalledWith("credential", now); expect(f.repository.markDelivered).not.toHaveBeenCalled(); expect(f.user.emailVerifiedAt).toBeNull();
  });
  it("does not send when atomic issuance rejects an already verified account", async () => {
    const f = fixture(); f.repository.issue.mockResolvedValue(false); await f.service.requestForUser(f.user.id, f.user.email); expect(f.email.send).not.toHaveBeenCalled();
  });
  it.each([null, {}, { token: 2 }])("rejects malformed verification input %#", async (input) => {
    const f = fixture(); await expect(f.service.verify(input)).rejects.toBeInstanceOf(InvalidEmailVerificationTokenError); expect(f.repository.verify).not.toHaveBeenCalled();
  });
  it("rejects invalid hash without querying persistence", async () => {
    const f = fixture(); f.tokens.hash.mockReturnValue(null); await expect(f.service.verify({ token: "bad" })).rejects.toBeInstanceOf(InvalidEmailVerificationTokenError); expect(f.repository.verify).not.toHaveBeenCalled();
  });
  it("uses only hashed token and rejects expiry or revocation from persistence", async () => {
    const f = fixture(); f.repository.verify.mockResolvedValue(false); await expect(f.service.verify({ token: "private-token" })).rejects.toBeInstanceOf(InvalidEmailVerificationTokenError); expect(f.repository.verify).toHaveBeenCalledWith("hash-only", now);
  });
  it("resends normalized pending account without authenticating it", async () => {
    const f = fixture(); await f.service.resend({ email: " PERSON@ALU.FRLP.UTN.EDU.AR " }); expect(f.users.findByEmail).toHaveBeenCalledWith(f.user.email); expect(f.email.send).toHaveBeenCalledTimes(1); expect(f.user.emailVerifiedAt).toBeNull();
  });
  it.each(["absent", "verified", "delivery-failure"])("resend has uniform result for %s", async (condition) => {
    const f = fixture(); if (condition === "absent") f.users.findByEmail.mockResolvedValue(null); if (condition === "verified") f.user.emailVerifiedAt = now; if (condition === "delivery-failure") f.email.send.mockRejectedValue(new Error("SMTP"));
    await expect(f.service.resend({ email: f.user.email })).resolves.toBeUndefined(); if (condition !== "delivery-failure") expect(f.email.send).not.toHaveBeenCalled();
  });
});
