import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { FeedbackService } from "../src/reviews/application/feedback.service.js";
import { FeedbackClosedError, FeedbackForbiddenError, FeedbackInputError, FeedbackNotFoundError } from "../src/reviews/application/errors.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";
import { lockMateriaVote, syncMateriaVote } from "../src/reviews/infrastructure/prisma-feedback-rating.js";
// T2 writer orchestration; the real selection and cache are covered by PostgreSQL integration.
vi.mock("../src/reviews/infrastructure/prisma-feedback-rating.js", () => ({ lockMateriaVote: vi.fn(), syncMateriaVote: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(lockMateriaVote).mockResolvedValue(undefined); vi.mocked(syncMateriaVote).mockResolvedValue([]); });
function fixture(puntuacion: number | null = 2, estadoModeracion: "APROBADO" | "PENDIENTE" | "RECHAZADO" = "APROBADO") {
  const usuarioId = randomUUID(); const materiaId = randomUUID(); const comisionId = randomUUID();
  const row = { id: randomUUID(), autorId: usuarioId, comisionId, materiaId, texto: "Original", anonimo: true, puntuacion,
    autor: { displayName: "Identidad privada" }, comision: { carrera: "S" }, profesorId: null, profesorNombre: null, profesorCargo: null,
    comisionNombre: "S-31", materiaNombre: "Materia", cursadaId: randomUUID(), anio: 2026, cuatrimestre: "PRIMERO", modalidad: "PRIMERO",
    deletedAt: null as Date | null, createdAt: new Date("2026-11-01"), updatedAt: new Date("2026-11-01"), estadoModeracion, versionModeracion: 3,
    requiereRevisionHumana: estadoModeracion === "RECHAZADO", motivoRechazo: estadoModeracion === "RECHAZADO" ? "Corregir" : null,
    ocultoAutor: true, ocultoAdministracion: false, ocultoReportes: false };
  const context = { id: comisionId, materiaId, activa: true };
  const tx = { $queryRaw: vi.fn().mockResolvedValueOnce([{ id: comisionId }]).mockResolvedValueOnce([context]),
    feedback: { findUnique: vi.fn().mockResolvedValue(row), update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data })) },
    administracionHistorial: { create: vi.fn().mockResolvedValue({}) } };
  const transaction = vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  return { repository: new PrismaFeedbackRepository({ ...tx, $transaction: transaction } as unknown as PrismaService), tx, transaction, row, context, usuarioId, materiaId };
}
describe("T2 Feedback: edición conserva aprobación y sincroniza el voto visible", () => {
  it.each([1, 5])("guarda puntuación %i aprobada, incrementa versión y conserva causas", async puntuacion => {
    const f = fixture(); const result = await f.repository.update(f.row.id, f.usuarioId, { puntuacion });
    expect(result).toMatchObject({ puntuacion, autor: null, propio: true }); expect(result).not.toHaveProperty("autorId"); expect(JSON.stringify(result)).not.toContain("Identidad privada");
    expect(f.tx.feedback.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ puntuacion, estadoModeracion: "APROBADO", versionModeracion: 4,
      historial: { create: expect.objectContaining({ accion: "EDICION", puntuacion, estadoModeracion: "APROBADO", versionModeracion: 4, ocultoAutor: true }) },
    }) }));
    expect(syncMateriaVote).toHaveBeenCalledExactlyOnceWith(f.tx, f.usuarioId, f.materiaId, expect.any(Date));
  });
  it.each([null, 2])("texto/anonimato también reevalúa contribución con puntuación %j", async puntuacion => {
    const f = fixture(puntuacion); await f.repository.update(f.row.id, f.usuarioId, { texto: "Ampliado", anonimo: false });
    expect(f.tx.feedback.update.mock.calls[0]![0].data).toMatchObject({ texto: "Ampliado", anonimo: false, puntuacion, estadoModeracion: "APROBADO" }); expect(syncMateriaVote).toHaveBeenCalledTimes(1);
  });
  it.each(["PENDIENTE", "RECHAZADO"] as const)("editar %s no concede aprobación ni borra rechazo", async estado => {
    const f = fixture(2, estado); await f.repository.update(f.row.id, f.usuarioId, { texto: "Contenido corregido" });
    expect(f.tx.feedback.update.mock.calls[0]![0].data.historial.create).toMatchObject({ estadoModeracion: estado, requiereRevisionHumana: estado === "RECHAZADO", motivoRechazo: f.row.motivoRechazo });
  });
  it("T2 agregar estrellas a un legado conserva NULL previo en auditoría y requiere revisión", async () => {
    const f = fixture(null); await f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 });
    expect(f.tx.feedback.update.mock.calls[0]![0].data.historial.create).toMatchObject({ puntuacion: 5, estadoModeracion: "APROBADO" });
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).toEqual(expect.arrayContaining([{ campo: "puntuacion", anterior: null, nuevo: "5" }]));
    expect(syncMateriaVote).toHaveBeenCalledTimes(1);
  });
  it("bloquea comisión y par antes de escribir, sincroniza después y audita diferencias reales", async () => {
    const f = fixture(); const changes = [{ campo: "valoracionMateria.deletedAt", anterior: null, nuevo: "2026-11-17T00:00:00.000Z" }]; vi.mocked(syncMateriaVote).mockResolvedValueOnce(changes);
    await f.repository.update(f.row.id, f.usuarioId, { texto: "Ampliado", anonimo: false, puntuacion: 4 });
    expect(lockMateriaVote).toHaveBeenCalledExactlyOnceWith(f.tx, f.usuarioId, f.materiaId);
    expect(f.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(lockMateriaVote).mock.invocationCallOrder[0]!);
    expect(vi.mocked(lockMateriaVote).mock.invocationCallOrder[0]).toBeLessThan(f.tx.feedback.update.mock.invocationCallOrder[0]!);
    expect(f.tx.feedback.update.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(syncMateriaVote).mock.invocationCallOrder[0]!);
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    const snapshot = f.tx.feedback.update.mock.calls[0]![0].data.historial.create;
    expect(f.tx.administracionHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: snapshot.id, actorId: f.usuarioId, accion: "EDICION",
      cambios: expect.arrayContaining([{ campo: "texto", anterior: "Original", nuevo: "Ampliado" }, { campo: "anonimo", anterior: "true", nuevo: "false" }, { campo: "puntuacion", anterior: "2", nuevo: "4" }, ...changes]),
    }) });
  });
  it.each([{}, { texto: "Original", anonimo: true, puntuacion: 2 }])("no-op no incrementa ni sincroniza/agrega eventos: %j", async input => {
    const f = fixture(); expect(await f.repository.update(f.row.id, f.usuarioId, input)).toMatchObject({ texto: "Original", puntuacion: 2 });
    expect(f.tx.feedback.update).not.toHaveBeenCalled(); expect(syncMateriaVote).not.toHaveBeenCalled(); expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });
  it("NULL se rechaza en servicio antes de persistencia", () => {
    const f = fixture(); expect(() => new FeedbackService(f.repository).update(f.row.id, f.usuarioId, { puntuacion: null })).toThrow(FeedbackInputError); expect(f.transaction).not.toHaveBeenCalled();
  });
  it("otro usuario o ADMIN ajeno no puede editar", async () => {
    const f = fixture(); f.row.ocultoAutor = false;
    await expect(f.repository.update(f.row.id, randomUUID(), { puntuacion: 5 })).rejects.toBeInstanceOf(FeedbackForbiddenError); expect(f.transaction).not.toHaveBeenCalled();
  });
  it("revalida autoría después de bloquear comisión", async () => {
    const f = fixture(); f.row.ocultoAutor = false;
    f.tx.feedback.findUnique.mockResolvedValueOnce(f.row).mockResolvedValueOnce({ ...f.row, autorId: randomUUID() });
    await expect(f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 })).rejects.toBeInstanceOf(FeedbackForbiddenError); expect(f.tx.feedback.update).not.toHaveBeenCalled(); expect(syncMateriaVote).not.toHaveBeenCalled();
  });
  it("T2 un tercero recibe 404 si el comentario es privado", async () => {
    const f = fixture(); await expect(f.repository.update(f.row.id, randomUUID(), { texto: "Intento" })).rejects.toBeInstanceOf(FeedbackNotFoundError);
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it("eliminado no admite cambios", async () => {
    const f = fixture(); f.row.deletedAt = new Date(); await expect(f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 })).rejects.toBeInstanceOf(FeedbackNotFoundError); expect(f.tx.feedback.update).not.toHaveBeenCalled();
  });
  it("comisión inactiva impide editar incluso estrellas idénticas", async () => {
    const f = fixture(); f.context.activa = false; await expect(f.repository.update(f.row.id, f.usuarioId, { puntuacion: 2 })).rejects.toBeInstanceOf(FeedbackClosedError); expect(syncMateriaVote).not.toHaveBeenCalled();
  });
  it("T3 sin versión del cliente usa la lectura inicial y detecta una decisión antes del bloqueo", async () => {
    const f = fixture();
    f.tx.feedback.findUnique.mockResolvedValueOnce({ ...f.row }).mockResolvedValueOnce({ ...f.row, versionModeracion: 4 });
    await expect(f.repository.update(f.row.id, f.usuarioId, { texto: "Actualización simultánea" })).rejects.toMatchObject({ httpStatus: 409 });
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    expect(syncMateriaVote).not.toHaveBeenCalled();
  });
  it("T3 versión explícita obsoleta falla incluso con contenido idéntico", async () => {
    const f = fixture();
    await expect(f.repository.update(f.row.id, f.usuarioId, { texto: f.row.texto, versionEsperada: 2 })).rejects.toMatchObject({ httpStatus: 409 });
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
  });
  it.each(["bloqueo", "comentario", "sincronización", "auditoría"])("propaga fallo de %s para rollback", async step => {
    const f = fixture(); const error = new Error(`fallo ${step}`);
    if (step === "bloqueo") vi.mocked(lockMateriaVote).mockRejectedValueOnce(error); else if (step === "sincronización") vi.mocked(syncMateriaVote).mockRejectedValueOnce(error);
    else (step === "comentario" ? f.tx.feedback.update : f.tx.administracionHistorial.create).mockRejectedValueOnce(error);
    await expect(f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 })).rejects.toBe(error); if (step !== "auditoría") expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });
});
