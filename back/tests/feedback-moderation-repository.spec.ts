import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";

function fixture() {
  const owner = { id: randomUUID(), role: "USER" as const };
  const admin = { id: randomUUID(), role: "ADMIN" as const };
  const row = { id: randomUUID(), autorId: owner.id, comisionId: randomUUID(), materiaId: randomUUID(), texto: "Texto original",
    puntuacion: 4, anonimo: true, deletedAt: null as Date | null, estadoModeracion: "PENDIENTE" as "PENDIENTE" | "APROBADO" | "RECHAZADO",
    versionModeracion: 1, requiereRevisionHumana: false, motivoRechazo: null as string | null,
    ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false };
  const tx = {
    $queryRaw: vi.fn().mockImplementation(async (query: unknown) => Array.isArray(query) ? [{ id: row.id }] : []),
    feedback: { findUnique: vi.fn().mockResolvedValue(row), update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data })) },
    feedbackHistorial: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    valoracionMateria: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn(), updateMany: vi.fn() },
    administracionHistorial: { create: vi.fn().mockResolvedValue({}) },
  };
  const transaction = vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  const repository = new PrismaFeedbackRepository({ ...tx, $transaction: transaction } as unknown as PrismaService);
  return { repository, tx, transaction, owner, admin, row };
}

describe("T1: persistencia interna de moderación", () => {
  it("guarda estado, snapshot y actor correlacionados en una transacción", async () => {
    const f = fixture();
    const result = await f.repository.transitionModeration(f.row.id, f.admin, { accion: "RECHAZO", versionEsperada: 1, motivo: "  Datos personales  " });
    expect(result).toMatchObject({ estadoModeracion: "RECHAZADO", versionModeracion: 2, motivoRechazo: "Datos personales", requiereRevisionHumana: true });
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    const update = f.tx.feedback.update.mock.calls[0]![0];
    const snapshot = update.data["historial"] as { create: Record<string, unknown> };
    expect(snapshot.create).toMatchObject({ accion: "RECHAZO", texto: f.row.texto, puntuacion: 4, anonimo: true,
      estadoModeracion: "RECHAZADO", versionModeracion: 2, motivoRechazo: "Datos personales", motivoModeracion: "Datos personales" });
    expect(f.tx.administracionHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: snapshot.create["id"], entidad: "feedback", entidadId: f.row.id, actorId: f.admin.id, accion: "RECHAZO",
      cambios: expect.arrayContaining([{ campo: "estadoModeracion", anterior: "PENDIENTE", nuevo: "RECHAZADO" }]),
    }) });
    const queries = f.tx.$queryRaw.mock.calls.slice(0, 2).map(call => (call[0] as TemplateStringsArray).join("?"));
    expect(queries[0]).toContain('FROM "Comision"');
    expect(queries[0]).toContain("FOR UPDATE");
    expect(queries[1]).toContain('FROM "Feedback"');
    expect(queries[1]).toContain("FOR UPDATE");
  });

  it("vuelve a comprobar la versión después de adquirir el bloqueo", async () => {
    const f = fixture();
    f.tx.feedback.findUnique.mockResolvedValueOnce(f.row).mockResolvedValue({ ...f.row, versionModeracion: 2 });
    await expect(f.repository.transitionModeration(f.row.id, f.admin, { accion: "APROBACION", versionEsperada: 1, motivo: "Revisión completada" })).rejects.toMatchObject({ httpStatus: 409 });
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });

  it("no-op autorizado no genera snapshot, ledger ni modificación de versión", async () => {
    const f = fixture();
    Object.assign(f.row, { estadoModeracion: "APROBADO", ocultoAutor: true });
    const result = await f.repository.transitionModeration(f.row.id, f.owner, { accion: "OCULTAMIENTO_AUTOR", versionEsperada: 1 });
    expect(result.versionModeracion).toBe(1);
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    expect(f.tx.feedbackHistorial.create).not.toHaveBeenCalled();
    expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });

  it("no confía en una solicitud de revisión sin comparar el texto rechazado", async () => {
    const f = fixture();
    Object.assign(f.row, { estadoModeracion: "RECHAZADO", requiereRevisionHumana: true, motivoRechazo: "Ataque" });
    f.tx.feedbackHistorial.findFirst.mockResolvedValue({ texto: f.row.texto });
    await expect(f.repository.transitionModeration(f.row.id, f.owner, { accion: "SOLICITUD_REVISION", versionEsperada: 1 })).rejects.toMatchObject({ httpStatus: 409 });
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    f.tx.feedbackHistorial.findFirst.mockResolvedValue({ texto: "Texto rechazado anterior" });
    expect(await f.repository.transitionModeration(f.row.id, f.owner, { accion: "SOLICITUD_REVISION", versionEsperada: 1 })).toMatchObject({ estadoModeracion: "PENDIENTE", requiereRevisionHumana: true, versionModeracion: 2 });
  });

  it("si falta el snapshot de rechazo no permite eludir la revisión", async () => {
    const f = fixture();
    Object.assign(f.row, { estadoModeracion: "RECHAZADO", requiereRevisionHumana: true, motivoRechazo: "Ataque" });
    await expect(f.repository.transitionModeration(f.row.id, f.owner, { accion: "SOLICITUD_REVISION", versionEsperada: 1 })).rejects.toMatchObject({ httpStatus: 409 });
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
  });

  it("ausente o eliminado rechaza sin escribir auditoría", async () => {
    const absent = fixture();
    absent.tx.feedback.findUnique.mockResolvedValue(null);
    await expect(absent.repository.transitionModeration(absent.row.id, absent.admin, { accion: "APROBACION", versionEsperada: 1, motivo: "Revisión completada" })).rejects.toMatchObject({ httpStatus: 404 });
    expect(absent.tx.feedback.update).not.toHaveBeenCalled();
    const deleted = fixture();
    deleted.row.deletedAt = new Date();
    await expect(deleted.repository.transitionModeration(deleted.row.id, deleted.admin, { accion: "APROBACION", versionEsperada: 1, motivo: "Revisión completada" })).rejects.toMatchObject({ httpStatus: 404 });
    expect(deleted.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });

  it("propaga errores de auditoría al límite transaccional", async () => {
    const f = fixture();
    const failure = new Error("ledger unavailable");
    f.tx.administracionHistorial.create.mockRejectedValue(failure);
    await expect(f.repository.transitionModeration(f.row.id, f.admin, { accion: "APROBACION", versionEsperada: 1, motivo: "Revisión completada" })).rejects.toBe(failure);
  });
});
