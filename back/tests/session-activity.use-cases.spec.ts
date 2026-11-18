import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { SessionActivity } from "../src/auth/application/session-activity.js";
import type { Session } from "../src/auth/domain/session.js";

const now = new Date("2026-11-03T12:00:00Z");
function fixture() {
  const session: Session = { id: randomUUID(), userId: randomUUID(), createdAt: new Date(now.getTime() - 3600_000),
    lastActivityAt: new Date(now.getTime() - 600_000), expiresAt: new Date(now.getTime() + 86400_000), revokedAt: null };
  const repository = { access: vi.fn(async () => session as Session | null) };
  return { session, repository, activity: new SessionActivity(repository, 1800, 120, () => now) };
}
describe("SessionActivity", () => {
  it.each(["read", "activity", "renew"] as const)("devuelve solo los cuatro plazos calculados por servidor para %s", async (operation) => {
    const f = fixture();
    const result = await f.activity.execute(f.session.id, f.session.userId, operation);
    expect(result).toEqual({ serverNow: now.toISOString(), warningAt: new Date(now.getTime() + 1080_000).toISOString(),
      idleExpiresAt: new Date(now.getTime() + 1200_000).toISOString(), absoluteExpiresAt: f.session.expiresAt.toISOString() });
    expect(f.repository.access).toHaveBeenCalledWith(f.session.id, f.session.userId, operation, now,
      { idleTtlSeconds: 1800, idleWarningSeconds: 120 });
  });
  it("adelanta el aviso si el vencimiento absoluto ocurre primero", async () => {
    const f = fixture(); f.session.expiresAt = new Date(now.getTime() + 90_000);
    expect(await f.activity.execute(f.session.id, f.session.userId, "read")).toMatchObject({ warningAt: new Date(now.getTime() - 30_000).toISOString(),
      absoluteExpiresAt: f.session.expiresAt.toISOString() });
  });
  it.each([null, [], { lastActivityAt: now.toISOString() }, { userId: "other" }, { sessionId: "other" }])("rechaza payload ajeno antes de consultar persistencia %#", async (input) => {
    const f = fixture();
    await expect(f.activity.execute(f.session.id, f.session.userId, "renew", input)).rejects.toBeTruthy();
    expect(f.repository.access).not.toHaveBeenCalled();
  });
  it("acepta el objeto vacío que envían clientes existentes", async () => {
    const f = fixture();
    await expect(f.activity.execute(f.session.id, f.session.userId, "activity", {})).resolves.toBeTruthy();
  });
  it("no devuelve plazos si la sesión dejó de ser válida mientras esperaba el bloqueo", async () => {
    const f = fixture(); f.repository.access.mockResolvedValue(null);
    await expect(f.activity.execute(f.session.id, f.session.userId, "renew")).rejects.toBeTruthy();
  });
});
