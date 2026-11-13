import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { FeedbackService } from "../src/reviews/application/feedback.service.js";
import { FeedbackClosedError, FeedbackForbiddenError, FeedbackInputError, FeedbackNotFoundError } from "../src/reviews/application/errors.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";

function fixture(puntuacion: number | null = 2, previous: { puntuacion: number; deletedAt: Date | null } | null = { puntuacion: 2, deletedAt: null }) {
  const usuarioId = randomUUID();
  const materiaId = randomUUID();
  const comisionId = randomUUID();
  const row = { id: randomUUID(), autorId: usuarioId, materiaId, comisionId, texto: "Original", anonimo: true,
    puntuacion, deletedAt: null as Date | null, autor: { displayName: "Identidad privada" }, comision: { carrera: "S" },
    profesorId: null, profesorNombre: null, profesorCargo: null, comisionNombre: "S-31", materiaNombre: "Materia",
    cursadaId: randomUUID(), anio: 2026, modalidad: "PRIMERO", cuatrimestre: "PRIMERO",
    createdAt: new Date("2026-11-01"), updatedAt: new Date("2026-11-01") };
  const context = { id: comisionId, materiaId, activa: true };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValueOnce([{ id: comisionId }]).mockResolvedValueOnce([context]).mockResolvedValue([{ locked: 1 }]),
    feedback: { findUnique: vi.fn().mockResolvedValue(row), update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data })) },
    valoracionMateria: { findUnique: vi.fn().mockResolvedValue(previous), upsert: vi.fn().mockResolvedValue({}) },
    administracionHistorial: { create: vi.fn().mockResolvedValue({}) },
  };
  const transaction = vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  const repository = new PrismaFeedbackRepository({ ...tx, $transaction: transaction } as unknown as PrismaService);
  return { repository, tx, transaction, row, context, usuarioId, materiaId, comisionId };
}

describe("Feedback: edición de estrellas sin PostgreSQL", () => {
  it.each([1, 5])("actualiza puntuación individual a %i y el mismo voto en una transacción", async (puntuacion) => {
    const f = fixture();
    const result = await f.repository.update(f.row.id, f.usuarioId, { puntuacion });
    expect(result).toMatchObject({ puntuacion, autor: null, propio: true });
    expect(result).not.toHaveProperty("autorId");
    expect(JSON.stringify(result)).not.toContain("Identidad privada");
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    expect(f.tx.feedback.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ puntuacion,
      historial: { create: expect.objectContaining({ accion: "EDICION", puntuacion }) },
    }) }));
    expect(f.tx.valoracionMateria.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { usuarioId_materiaId: { usuarioId: f.usuarioId, materiaId: f.materiaId } },
      create: { usuarioId: f.usuarioId, materiaId: f.materiaId, puntuacion },
      update: { puntuacion, deletedAt: null, updatedAt: expect.any(Date) },
    });
  });

  it("adquiere el mismo bloqueo del par que creación, después de comisión y antes de leer el voto", async () => {
    const f = fixture();
    await f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 });
    const queries = f.tx.$queryRaw.mock.calls;
    expect(queries).toHaveLength(3);
    expect((queries[0]![0] as TemplateStringsArray).join("?")).toContain('FROM "Comision"');
    expect((queries[0]![0] as TemplateStringsArray).join("?")).toContain("FOR UPDATE");
    expect((queries[2]![0] as TemplateStringsArray).join("?")).toContain("pg_advisory_xact_lock(2026071, hashtext(");
    expect(queries[2]![1]).toBe(`${f.usuarioId}:${f.materiaId}`);
    expect(f.tx.$queryRaw.mock.invocationCallOrder[2]).toBeLessThan(f.tx.valoracionMateria.findUnique.mock.invocationCallOrder[0]!);
    expect(f.tx.valoracionMateria.findUnique.mock.invocationCallOrder[0]).toBeLessThan(f.tx.feedback.update.mock.invocationCallOrder[0]!);
  });

  it("registra estrellas anteriores/nuevas y correlaciona snapshot y auditoría", async () => {
    const f = fixture();
    await f.repository.update(f.row.id, f.usuarioId, { texto: "Ampliado", anonimo: false, puntuacion: 4 });
    const snapshot = f.tx.feedback.update.mock.calls[0]![0].data["historial"] as { create: { id: string } };
    expect(f.tx.administracionHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: snapshot.create.id, entidad: "feedback", entidadId: f.row.id, actorId: f.usuarioId, accion: "EDICION",
      cambios: expect.arrayContaining([
        { campo: "texto", anterior: "Original", nuevo: "Ampliado" },
        { campo: "anonimo", anterior: "true", nuevo: "false" },
        { campo: "puntuacion", anterior: "2", nuevo: "4" },
        { campo: "valoracionMateria.puntuacion", anterior: "2", nuevo: "4" },
      ]),
    }) });
  });

  it.each([
    { name: "crea", previous: null },
    { name: "actualiza", previous: { puntuacion: 1, deletedAt: null } },
    { name: "reactiva", previous: { puntuacion: 1, deletedAt: new Date("2026-11-01") } },
  ])("histórico incorpora estrellas y $name su valoración", async ({ previous }) => {
    const f = fixture(null, previous);
    const result = await f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 });
    expect(result.puntuacion).toBe(5);
    expect(f.tx.valoracionMateria.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { puntuacion: 5, deletedAt: null, updatedAt: expect.any(Date) },
    }));
    const changes = f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios;
    expect(changes).toContainEqual({ campo: "puntuacion", anterior: null, nuevo: "5" });
    if (previous?.deletedAt) expect(changes).toContainEqual({ campo: "valoracionMateria.deletedAt", anterior: previous.deletedAt.toISOString(), nuevo: null });
  });

  it.each([null, 2])("texto/anonimato sin estrellas conserva puntuación %j y no lee ni escribe voto", async (puntuacion) => {
    const f = fixture(puntuacion);
    const result = await f.repository.update(f.row.id, f.usuarioId, { texto: "Ampliado", anonimo: false });
    expect(result).toMatchObject({ texto: "Ampliado", anonimo: false, puntuacion });
    expect(f.tx.valoracionMateria.findUnique).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
    expect(f.tx.$queryRaw).toHaveBeenCalledTimes(2);
    const snapshot = f.tx.feedback.update.mock.calls[0]![0].data["historial"] as { create: { puntuacion: number | null } };
    expect(snapshot.create.puntuacion).toBe(puntuacion);
  });

  it("puntuación idéntica es no-op aunque otro comentario haya dejado otro voto global", async () => {
    const f = fixture(2, { puntuacion: 5, deletedAt: null });
    const result = await f.repository.update(f.row.id, f.usuarioId, { puntuacion: 2 });
    expect(result.puntuacion).toBe(2);
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.findUnique).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
    expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });

  it("puntuación idéntica junto con texto nuevo audita solo el texto", async () => {
    const f = fixture(2, { puntuacion: 5, deletedAt: null });
    await f.repository.update(f.row.id, f.usuarioId, { texto: "Ampliado", puntuacion: 2 });
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).toEqual([
      { campo: "texto", anterior: "Original", nuevo: "Ampliado" },
    ]);
  });

  it("cambiar estrellas individuales no inventa diferencia global si ese voto ya coincide", async () => {
    const f = fixture(2, { puntuacion: 5, deletedAt: null });
    await f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 });
    expect(f.tx.valoracionMateria.upsert).toHaveBeenCalledTimes(1);
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).toEqual([
      { campo: "puntuacion", anterior: "2", nuevo: "5" },
    ]);
  });

  it("NULL se rechaza en el servicio antes de llegar a persistencia", () => {
    const f = fixture();
    const service = new FeedbackService(f.repository);
    expect(() => service.update(f.row.id, f.usuarioId, { puntuacion: null })).toThrow(FeedbackInputError);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it("otro usuario o ADMIN ajeno no puede editar", async () => {
    const f = fixture();
    await expect(f.repository.update(f.row.id, randomUUID(), { puntuacion: 5 })).rejects.toBeInstanceOf(FeedbackForbiddenError);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it("revalida autoría después del bloqueo de comisión", async () => {
    const f = fixture();
    f.tx.feedback.findUnique.mockResolvedValueOnce(f.row).mockResolvedValueOnce({ ...f.row, autorId: randomUUID() });
    await expect(f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 })).rejects.toBeInstanceOf(FeedbackForbiddenError);
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
  });

  it("comentario eliminado no admite cambios", async () => {
    const f = fixture();
    f.row.deletedAt = new Date();
    await expect(f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 })).rejects.toBeInstanceOf(FeedbackNotFoundError);
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
  });

  it("comisión inactiva impide editar incluso estrellas idénticas", async () => {
    const f = fixture();
    f.context.activa = false;
    await expect(f.repository.update(f.row.id, f.usuarioId, { puntuacion: 2 })).rejects.toBeInstanceOf(FeedbackClosedError);
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
  });

  it.each(["lectura", "comentario", "voto", "auditoría"])("propaga error de %s sin reportar éxito", async (step) => {
    const f = fixture();
    const error = new Error(`fallo ${step}`);
    const write = step === "lectura" ? f.tx.valoracionMateria.findUnique : step === "comentario" ? f.tx.feedback.update
      : step === "voto" ? f.tx.valoracionMateria.upsert : f.tx.administracionHistorial.create;
    write.mockRejectedValueOnce(error);
    await expect(f.repository.update(f.row.id, f.usuarioId, { puntuacion: 5 })).rejects.toBe(error);
    if (step === "lectura") expect(f.tx.feedback.update).not.toHaveBeenCalled();
    if (step !== "auditoría") expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });
});
