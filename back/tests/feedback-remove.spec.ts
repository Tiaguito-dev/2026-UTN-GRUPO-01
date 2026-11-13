import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { FeedbackForbiddenError, FeedbackNotFoundError } from "../src/reviews/application/errors.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";

function fixture({ puntuacion = 5, remaining = false, vote = true, deletedVote = false }: {
  puntuacion?: number | null; remaining?: boolean; vote?: boolean; deletedVote?: boolean;
} = {}) {
  const usuarioId = randomUUID();
  const materiaId = randomUUID();
  const comisionId = randomUUID();
  const row = { id: randomUUID(), autorId: usuarioId, materiaId, comisionId, texto: "Comentario", anonimo: true,
    puntuacion, deletedAt: null as Date | null };
  const previous = vote ? { usuarioId, materiaId, puntuacion: 5, createdAt: new Date("2026-11-01"), deletedAt: deletedVote ? new Date("2026-11-02") : null } : null;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: comisionId }]),
    feedback: { findUnique: vi.fn().mockResolvedValue(row), update: vi.fn().mockResolvedValue(row),
      findFirst: vi.fn().mockResolvedValue(remaining ? { id: randomUUID() } : null) },
    valoracionMateria: { findUnique: vi.fn().mockResolvedValue(previous), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(), upsert: vi.fn() },
    administracionHistorial: { create: vi.fn().mockResolvedValue({}) },
  };
  const transaction = vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  const repository = new PrismaFeedbackRepository({ ...tx, $transaction: transaction } as unknown as PrismaService);
  return { repository, tx, transaction, row, previous, usuarioId, materiaId, comisionId };
}

describe("Feedback: eliminación y baja del voto sin PostgreSQL", () => {
  it("último participante da de baja el voto conservando puntuación, identidad y createdAt", async () => {
    const f = fixture();
    await f.repository.remove(f.row.id, f.usuarioId);
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    const args = f.tx.feedback.update.mock.calls[0]![0];
    const now = args.data.deletedAt;
    expect(now).toBeInstanceOf(Date);
    expect(args.data.historial.create).toMatchObject({ accion: "ELIMINACION", texto: "Comentario", anonimo: true, puntuacion: 5 });
    expect(f.tx.valoracionMateria.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { usuarioId: f.usuarioId, materiaId: f.materiaId, deletedAt: null },
      data: { deletedAt: now, updatedAt: now },
    });
    expect(f.tx.valoracionMateria.create).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
    expect(f.tx.administracionHistorial.create).toHaveBeenCalledWith({ data: {
      id: args.data.historial.create.id, entidad: "feedback", entidadId: f.row.id, actorId: f.usuarioId, accion: "ELIMINACION",
      cambios: [{ campo: "deletedAt", anterior: null, nuevo: now.toISOString() },
        { campo: "valoracionMateria.deletedAt", anterior: null, nuevo: now.toISOString() }],
    } });
  });

  it("consulta participantes activos y puntuados en toda la materia después de la baja", async () => {
    const f = fixture();
    await f.repository.remove(f.row.id, f.usuarioId);
    expect(f.tx.feedback.findFirst).toHaveBeenCalledExactlyOnceWith({
      where: { autorId: f.usuarioId, materiaId: f.materiaId, deletedAt: null, puntuacion: { not: null } },
      select: { id: true },
    });
    expect(f.tx.feedback.update.mock.invocationCallOrder[0]).toBeLessThan(f.tx.feedback.findFirst.mock.invocationCallOrder[0]!);
  });

  it("mantiene el voto sin recalcularlo si queda un participante en otra comisión", async () => {
    const f = fixture({ remaining: true });
    await f.repository.remove(f.row.id, f.usuarioId);
    expect(f.tx.feedback.findFirst).toHaveBeenCalled();
    expect(f.tx.valoracionMateria.findUnique).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.updateMany).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).toHaveLength(1);
  });

  it("bloquea comisión antes del mismo par usuario/materia usado por creación y edición", async () => {
    const f = fixture();
    await f.repository.remove(f.row.id, f.usuarioId);
    const queries = f.tx.$queryRaw.mock.calls;
    expect(queries).toHaveLength(2);
    expect((queries[0]![0] as TemplateStringsArray).join("?")).toContain('FROM "Comision"');
    expect((queries[0]![0] as TemplateStringsArray).join("?")).toContain("FOR UPDATE");
    expect((queries[1]![0] as TemplateStringsArray).join("?")).toContain("pg_advisory_xact_lock(2026071, hashtext(");
    expect(queries[1]![1]).toBe(`${f.usuarioId}:${f.materiaId}`);
    expect(f.tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(f.tx.feedback.update.mock.invocationCallOrder[0]!);
  });

  it("ADMIN retira el voto del autor real y se registra como actor", async () => {
    const f = fixture();
    const adminId = randomUUID();
    await f.repository.remove(f.row.id, adminId, "ADMIN");
    expect(f.tx.$queryRaw.mock.calls[1]![1]).toBe(`${f.usuarioId}:${f.materiaId}`);
    expect(f.tx.valoracionMateria.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId: f.usuarioId, materiaId: f.materiaId, deletedAt: null },
    }));
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.actorId).toBe(adminId);
  });

  it("histórico sin estrellas no consulta participantes ni modifica el voto", async () => {
    const f = fixture({ puntuacion: null });
    await f.repository.remove(f.row.id, f.usuarioId);
    expect(f.tx.feedback.findFirst).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.findUnique).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.updateMany).not.toHaveBeenCalled();
    expect(f.tx.feedback.update.mock.calls[0]![0].data.historial.create.puntuacion).toBeNull();
  });

  it.each([
    { name: "ausente", vote: false, deletedVote: false },
    { name: "ya dado de baja", vote: true, deletedVote: true },
  ])("voto $name no provoca creación ni baja adicional", async ({ vote, deletedVote }) => {
    const f = fixture({ vote, deletedVote });
    await f.repository.remove(f.row.id, f.usuarioId);
    expect(f.tx.valoracionMateria.updateMany).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.create).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).toHaveLength(1);
  });

  it("no audita una baja global si la actualización condicional no afecta filas", async () => {
    const f = fixture();
    f.tx.valoracionMateria.updateMany.mockResolvedValue({ count: 0 });
    await f.repository.remove(f.row.id, f.usuarioId);
    expect(f.tx.valoracionMateria.updateMany).toHaveBeenCalledTimes(1);
    expect(f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios).toHaveLength(1);
  });

  it("tercero USER no puede eliminar ni tocar el voto", async () => {
    const f = fixture();
    await expect(f.repository.remove(f.row.id, randomUUID())).rejects.toBeInstanceOf(FeedbackForbiddenError);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it("comentario ya eliminado devuelve 404 sin nuevas escrituras", async () => {
    const f = fixture();
    f.row.deletedAt = new Date();
    await expect(f.repository.remove(f.row.id, f.usuarioId)).rejects.toBeInstanceOf(FeedbackNotFoundError);
    expect(f.transaction).not.toHaveBeenCalled();
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.updateMany).not.toHaveBeenCalled();
  });

  it("revalida baja y permisos después de bloquear comisión", async () => {
    const f = fixture();
    f.tx.feedback.findUnique.mockResolvedValueOnce(f.row).mockResolvedValueOnce({ ...f.row, deletedAt: new Date() });
    await expect(f.repository.remove(f.row.id, f.usuarioId)).rejects.toBeInstanceOf(FeedbackNotFoundError);
    expect(f.tx.feedback.update).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.updateMany).not.toHaveBeenCalled();
  });

  it.each(["comentario", "participantes", "lectura del voto", "baja del voto", "auditoría"])("propaga fallo de %s para revertir la transacción", async (step) => {
    const f = fixture();
    const error = new Error(`fallo ${step}`);
    const operation = step === "comentario" ? f.tx.feedback.update : step === "participantes" ? f.tx.feedback.findFirst
      : step === "lectura del voto" ? f.tx.valoracionMateria.findUnique : step === "baja del voto" ? f.tx.valoracionMateria.updateMany : f.tx.administracionHistorial.create;
    operation.mockRejectedValueOnce(error);
    await expect(f.repository.remove(f.row.id, f.usuarioId)).rejects.toBe(error);
    if (step !== "auditoría") expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });
});
