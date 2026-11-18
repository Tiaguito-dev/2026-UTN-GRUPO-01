import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { FeedbackService } from "../src/reviews/application/feedback.service.js";
import type { FeedbackRepository } from "../src/reviews/application/ports/feedback.repository.js";
import { FeedbackClosedError, FeedbackDuplicateError } from "../src/reviews/application/errors.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";
import { lockMateriaVote, syncMateriaVote } from "../src/reviews/infrastructure/prisma-feedback-rating.js";

// T2 changes publication semantics. SQL selection/atomicity is exercised by PostgreSQL suites;
// the writer tests isolate that helper to verify its transaction, ordering and audit integration.
vi.mock("../src/reviews/infrastructure/prisma-feedback-rating.js", () => ({ lockMateriaVote: vi.fn(), syncMateriaVote: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(lockMateriaVote).mockResolvedValue(undefined); vi.mocked(syncMateriaVote).mockResolvedValue([]); });
function fixture() {
  const usuarioId = randomUUID(); const materiaId = randomUUID(); const comisionId = randomUUID();
  const context = { id: comisionId, materiaId, carrera: "S", numero: 31, activa: true,
    materiaNombre: "Análisis", cursadaId: randomUUID(), anio: 2026, modalidad: "PRIMERO", profesorId: null, profesorNombre: null, profesorCargo: null };
  const row = { id: randomUUID(), autorId: usuarioId, comisionId, materiaId, texto: "Bien", anonimo: true, puntuacion: 4,
    autor: { displayName: "Nombre privado" }, comision: { carrera: "S" }, profesorId: null, profesorNombre: null, profesorCargo: null,
    comisionNombre: "S-31", materiaNombre: "Análisis", cursadaId: context.cursadaId, anio: 2026, modalidad: "PRIMERO", cuatrimestre: "PRIMERO",
    createdAt: new Date(), updatedAt: new Date(), deletedAt: null, estadoModeracion: "APROBADO", versionModeracion: 1,
    requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false };
  const tx = { $queryRaw: vi.fn().mockResolvedValueOnce([{ id: comisionId }]).mockResolvedValueOnce([context]),
    feedback: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(row) },
    aceptacionNormas: { findUnique: vi.fn().mockResolvedValue({ usuarioId }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    administracionHistorial: { create: vi.fn().mockResolvedValue({}) } };
  const transaction = vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  return { repository: new PrismaFeedbackRepository({ ...tx, $transaction: transaction } as unknown as PrismaService), tx, transaction,
    usuarioId, materiaId, comisionId, row, context, input: { texto: "Bien", anonimo: true, puntuacion: 4 } };
}
describe("T2 Feedback: alta con publicación inmediata", () => {
  it.each([null, 0, 6, 1.5, "4"])("rechaza puntuación inválida %s antes de persistir", puntuacion => {
    const create = vi.fn(); const service = new FeedbackService({ create } as unknown as FeedbackRepository);
    expect(() => service.create(randomUUID(), "usuario", { texto: "Bien", anonimo: true, puntuacion })).toThrow(); expect(create).not.toHaveBeenCalled();
  });
  it("normaliza texto y transporta estrellas sin permitir autoría elegida por cliente", async () => {
    const create = vi.fn().mockResolvedValue({}); const service = new FeedbackService({ create } as unknown as FeedbackRepository); const id = randomUUID();
    await service.create(id, "usuario", { texto: "  Bien  ", anonimo: true, puntuacion: 5 });
    expect(create).toHaveBeenCalledExactlyOnceWith(id, "usuario", { texto: "Bien", anonimo: true, puntuacion: 5 });
    expect(() => service.create(id, "usuario", { texto: "Bien", anonimo: true })).toThrow();
    expect(() => service.create(id, "usuario", { texto: "Bien", anonimo: true, puntuacion: 5, autorId: randomUUID() })).toThrow();
  });
  it("guarda comentario y snapshot publicados sin consentimientos y sincroniza antes del ledger", async () => {
    const f = fixture(); await f.repository.create(f.comisionId, f.usuarioId, { ...f.input });
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    expect(f.tx.aceptacionNormas.findUnique).not.toHaveBeenCalled();
    expect(f.tx.aceptacionNormas.createMany).not.toHaveBeenCalled();
    expect(f.tx.feedback.create.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(syncMateriaVote).mock.invocationCallOrder[0]!);
    expect(vi.mocked(syncMateriaVote).mock.invocationCallOrder[0]).toBeLessThan(f.tx.administracionHistorial.create.mock.invocationCallOrder[0]!);
    expect(f.tx.feedback.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estadoModeracion: "APROBADO", versionModeracion: 1,
      historial: { create: expect.objectContaining({ accion: "CREACION", texto: "Bien", anonimo: true, puntuacion: 4, estadoModeracion: "APROBADO", versionModeracion: 1 }) },
    }) }));
    expect(syncMateriaVote).toHaveBeenCalledExactlyOnceWith(f.tx, f.usuarioId, f.materiaId, expect.any(Date));
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).not.toEqual(expect.arrayContaining([expect.objectContaining({ campo: "valoracionMateria.puntuacion" })]));
  });
  it("no consulta ni inventa consentimiento al crear desde una cuenta existente", async () => {
    const f = fixture(); f.tx.aceptacionNormas.findUnique.mockResolvedValueOnce(null);
    await f.repository.create(f.comisionId, f.usuarioId, f.input);
    expect(f.tx.aceptacionNormas.findUnique).not.toHaveBeenCalled();
    expect(f.tx.aceptacionNormas.createMany).not.toHaveBeenCalled();
    expect(f.tx.feedback.create).toHaveBeenCalledOnce();
  });
  it("bloquea comisión antes del par y no expone identidad o metadatos privados", async () => {
    const f = fixture(); const result = await f.repository.create(f.comisionId, f.usuarioId, f.input);
    expect(lockMateriaVote).toHaveBeenCalledExactlyOnceWith(f.tx, f.usuarioId, f.materiaId);
    expect(f.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(lockMateriaVote).mock.invocationCallOrder[0]!);
    expect(vi.mocked(lockMateriaVote).mock.invocationCallOrder[0]).toBeLessThan(f.tx.feedback.create.mock.invocationCallOrder[0]!);
    expect(result).toMatchObject({ puntuacion: 4, autor: null, propio: true });
    for (const field of ["autorId", "estadoModeracion", "motivoRechazo"]) expect(result).not.toHaveProperty(field);
    expect(JSON.stringify(result)).not.toContain("Nombre privado");
  });
  it("correlaciona snapshot/actor y agrega solo diferencias reales de reconciliación", async () => {
    const f = fixture(); const changes = [{ campo: "valoracionMateria.deletedAt", anterior: null, nuevo: "2026-11-17T00:00:00.000Z" }];
    vi.mocked(syncMateriaVote).mockResolvedValueOnce(changes); await f.repository.create(f.comisionId, f.usuarioId, f.input);
    const snapshot = f.tx.feedback.create.mock.calls[0]![0].data.historial.create;
    expect(f.tx.administracionHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: snapshot.id, actorId: f.usuarioId, accion: "CREACION", cambios: expect.arrayContaining(changes) }) });
  });
  it("publica una nueva experiencia sin heredar la revisión de registros retirados", async () => {
    const f = fixture(); f.tx.feedback.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: randomUUID() });
    await f.repository.create(f.comisionId, f.usuarioId, f.input);
    expect(f.tx.feedback.findFirst).toHaveBeenCalledTimes(1);
    expect(f.tx.feedback.create.mock.calls[0]![0].data).toMatchObject({ estadoModeracion: "APROBADO", requiereRevisionHumana: false });
    expect(f.tx.feedback.create.mock.calls[0]![0].data.historial.create).toMatchObject({ requiereRevisionHumana: false });
  });
  it("duplicado y comisión inactiva no escriben ni sincronizan", async () => {
    const duplicate = fixture(); duplicate.tx.feedback.findFirst.mockResolvedValue({ id: randomUUID() });
    await expect(duplicate.repository.create(duplicate.comisionId, duplicate.usuarioId, duplicate.input)).rejects.toBeInstanceOf(FeedbackDuplicateError);
    const closed = fixture(); closed.context.activa = false; await expect(closed.repository.create(closed.comisionId, closed.usuarioId, closed.input)).rejects.toBeInstanceOf(FeedbackClosedError);
    expect(syncMateriaVote).not.toHaveBeenCalled(); expect(duplicate.tx.feedback.create).not.toHaveBeenCalled(); expect(closed.tx.feedback.create).not.toHaveBeenCalled();
  });
  it.each(["comentario", "sincronización", "auditoría"])("propaga fallo de %s para revertir la transacción", async step => {
    const f = fixture(); const error = new Error(`fallo ${step}`);
    if (step === "sincronización") vi.mocked(syncMateriaVote).mockRejectedValueOnce(error); else (step === "comentario" ? f.tx.feedback.create : f.tx.administracionHistorial.create).mockRejectedValueOnce(error);
    await expect(f.repository.create(f.comisionId, f.usuarioId, f.input)).rejects.toBe(error); if (step !== "auditoría") expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });
  it.each([{ target: ["autorId", "comisionId"], duplicate: true }, { target: "Feedback_autor_comision_vigente_key", duplicate: true },
    { target: ["usuarioId", "materiaId"], duplicate: false }, { target: ["id"], duplicate: false }])("P2002 solo traduce la unicidad de comentario: $target", async ({ target, duplicate }) => {
    const f = fixture(); const error = new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "6.19.3", meta: { target } });
    f.tx.feedback.create.mockRejectedValueOnce(error); const pending = expect(f.repository.create(f.comisionId, f.usuarioId, f.input)).rejects;
    if (duplicate) await pending.toBeInstanceOf(FeedbackDuplicateError); else await pending.toBe(error);
  });
});
