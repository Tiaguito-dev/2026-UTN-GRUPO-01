import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { FeedbackForbiddenError, FeedbackNotFoundError } from "../src/reviews/application/errors.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";
import { lockMateriaVote, syncMateriaVote } from "../src/reviews/infrastructure/prisma-feedback-rating.js";
// T2 replaces "leave stale vote if any survivor exists" with visible-candidate reconciliation.
vi.mock("../src/reviews/infrastructure/prisma-feedback-rating.js", () => ({ lockMateriaVote: vi.fn(), syncMateriaVote: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(lockMateriaVote).mockResolvedValue(undefined); vi.mocked(syncMateriaVote).mockResolvedValue([]); });
function fixture(puntuacion: number | null = 5) {
  const usuarioId = randomUUID(); const materiaId = randomUUID(); const comisionId = randomUUID();
  const row = { id: randomUUID(), autorId: usuarioId, materiaId, comisionId, texto: "Comentario", anonimo: true, puntuacion, deletedAt: null as Date | null,
    estadoModeracion: "APROBADO", versionModeracion: 2, requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: true, ocultoAdministracion: false, ocultoReportes: true };
  const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: comisionId }]), feedback: { findUnique: vi.fn().mockResolvedValue(row), update: vi.fn().mockResolvedValue(row) },
    administracionHistorial: { create: vi.fn().mockResolvedValue({}) } };
  const transaction = vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  return { repository: new PrismaFeedbackRepository({ ...tx, $transaction: transaction } as unknown as PrismaService), tx, transaction, row, usuarioId, materiaId };
}
describe("T2 Feedback: baja lógica y última valoración visible", () => {
  it("conserva contenido/causas y audita snapshot versionado junto a la baja del voto", async () => {
    const f = fixture(); const changes = [{ campo: "valoracionMateria.deletedAt", anterior: null, nuevo: "2026-11-17T00:00:00.000Z" }]; vi.mocked(syncMateriaVote).mockResolvedValueOnce(changes);
    await f.repository.remove(f.row.id, f.usuarioId); const args = f.tx.feedback.update.mock.calls[0]![0]; const now = args.data.deletedAt;
    expect(now).toBeInstanceOf(Date); expect(args.data.versionModeracion).toBe(3);
    expect(args.data.historial.create).toMatchObject({ accion: "ELIMINACION", texto: "Comentario", anonimo: true, puntuacion: 5, estadoModeracion: "APROBADO", versionModeracion: 3, ocultoAutor: true, ocultoReportes: true });
    expect(f.tx.administracionHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: args.data.historial.create.id, entidad: "feedback", entidadId: f.row.id, actorId: f.usuarioId, accion: "ELIMINACION",
      cambios: expect.arrayContaining([{ campo: "deletedAt", anterior: null, nuevo: now.toISOString() }, ...changes]),
    }) });
  });
  it.each([null, 5])("sincroniza el par después de retirar puntuación %j", async puntuacion => {
    const f = fixture(puntuacion); await f.repository.remove(f.row.id, f.usuarioId);
    expect(syncMateriaVote).toHaveBeenCalledExactlyOnceWith(f.tx, f.usuarioId, f.materiaId, expect.any(Date));
    expect(f.tx.feedback.update.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(syncMateriaVote).mock.invocationCallOrder[0]!);
    expect(f.tx.feedback.update.mock.calls[0]![0].data.historial.create.puntuacion).toBe(puntuacion);
  });
  it("audita recuperación de voto previo elegible en vez de conservar uno retirado obsoleto", async () => {
    const f = fixture(); const changes = [{ campo: "valoracionMateria.puntuacion", anterior: "5", nuevo: "2" }]; vi.mocked(syncMateriaVote).mockResolvedValueOnce(changes);
    await f.repository.remove(f.row.id, f.usuarioId); expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).toEqual(expect.arrayContaining(changes));
  });
  it("no inventa diferencias cuando la proyección no cambia", async () => {
    const f = fixture(); await f.repository.remove(f.row.id, f.usuarioId);
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).not.toEqual(expect.arrayContaining([expect.objectContaining({ campo: "valoracionMateria.puntuacion" })]));
  });
  it("bloquea comisión antes del par y usa al autor real cuando retira ADMIN", async () => {
    const f = fixture(); const admin = randomUUID(); await f.repository.remove(f.row.id, admin, "ADMIN");
    expect((f.tx.$queryRaw.mock.calls[0]![0] as TemplateStringsArray).join("?")).toContain('FROM "Comision"');
    expect(lockMateriaVote).toHaveBeenCalledExactlyOnceWith(f.tx, f.usuarioId, f.materiaId);
    expect(f.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(lockMateriaVote).mock.invocationCallOrder[0]!);
    expect(vi.mocked(lockMateriaVote).mock.invocationCallOrder[0]).toBeLessThan(f.tx.feedback.update.mock.invocationCallOrder[0]!);
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.actorId).toBe(admin);
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
  });
  it("tercero USER no puede retirar ni sincronizar", async () => {
    const f = fixture(); await expect(f.repository.remove(f.row.id, randomUUID())).rejects.toBeInstanceOf(FeedbackForbiddenError); expect(f.transaction).not.toHaveBeenCalled(); expect(syncMateriaVote).not.toHaveBeenCalled();
  });
  it("baja previa devuelve 404 sin nuevos eventos", async () => {
    const f = fixture(); f.row.deletedAt = new Date(); await expect(f.repository.remove(f.row.id, f.usuarioId)).rejects.toBeInstanceOf(FeedbackNotFoundError); expect(f.tx.feedback.update).not.toHaveBeenCalled();
  });
  it("revalida baja y autoría después de bloquear", async () => {
    const f = fixture(); f.tx.feedback.findUnique.mockResolvedValueOnce(f.row).mockResolvedValueOnce({ ...f.row, deletedAt: new Date() });
    await expect(f.repository.remove(f.row.id, f.usuarioId)).rejects.toBeInstanceOf(FeedbackNotFoundError); expect(f.tx.feedback.update).not.toHaveBeenCalled();
  });
  it.each(["bloqueo", "comentario", "sincronización", "auditoría"])("propaga fallo de %s para rollback", async step => {
    const f = fixture(); const error = new Error(`fallo ${step}`);
    if (step === "bloqueo") vi.mocked(lockMateriaVote).mockRejectedValueOnce(error); else if (step === "sincronización") vi.mocked(syncMateriaVote).mockRejectedValueOnce(error);
    else (step === "comentario" ? f.tx.feedback.update : f.tx.administracionHistorial.create).mockRejectedValueOnce(error);
    await expect(f.repository.remove(f.row.id, f.usuarioId)).rejects.toBe(error); if (step !== "auditoría") expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });
});
