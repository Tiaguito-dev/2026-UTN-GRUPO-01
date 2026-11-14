import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { FeedbackService } from "../src/reviews/application/feedback.service.js";
import type { FeedbackRepository } from "../src/reviews/application/ports/feedback.repository.js";
import { FeedbackClosedError, FeedbackDuplicateError } from "../src/reviews/application/errors.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";

function fixture(previous: { puntuacion: number; deletedAt: Date | null } | null = null) {
  const usuarioId = randomUUID();
  const materiaId = randomUUID();
  const comisionId = randomUUID();
  const now = new Date("2026-11-12T12:00:00Z");
  const context = { id: comisionId, materiaId, carrera: "S", numero: 31, activa: true,
    materiaNombre: "Análisis", cursadaId: randomUUID(), anio: 2026, modalidad: "PRIMERO",
    profesorId: null, profesorNombre: null, profesorCargo: null };
  const row = { id: randomUUID(), autorId: usuarioId, comisionId, materiaId, texto: "Bien", anonimo: true,
    puntuacion: 4, autor: { displayName: "Nombre privado" }, comision: { carrera: "S" },
    profesorId: null, profesorNombre: null, profesorCargo: null, comisionNombre: "S-31",
    materiaNombre: "Análisis", cursadaId: context.cursadaId, anio: 2026, modalidad: "PRIMERO",
    cuatrimestre: "PRIMERO", createdAt: now, updatedAt: now, deletedAt: null };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValueOnce([{ id: comisionId }]).mockResolvedValueOnce([context]).mockResolvedValue([{ locked: 1 }]),
    feedback: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(row),
      findUnique: vi.fn().mockResolvedValue(row), update: vi.fn().mockResolvedValue(row) },
    feedbackHistorial: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    aceptacionNormas: { findUnique: vi.fn<() => Promise<{ usuarioId: string } | null>>().mockResolvedValue({ usuarioId }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    valoracionMateria: { findUnique: vi.fn().mockResolvedValue(previous), upsert: vi.fn().mockResolvedValue({}) },
    administracionHistorial: { create: vi.fn().mockResolvedValue({}) },
  };
  const transaction = vi.fn(async (work: unknown) => typeof work === "function" ? work(tx) : Promise.all(work as Promise<unknown>[]));
  const prisma = { ...tx, $transaction: transaction } as unknown as PrismaService;
  const repository = new PrismaFeedbackRepository(prisma);
  return { repository, tx, transaction, usuarioId, materiaId, comisionId, row, context,
    input: { texto: "Bien", anonimo: true, puntuacion: 4 } };
}

describe("Feedback: creación con estrellas sin base de datos", () => {
  it.each([null, 0, 6, 1.5, "4"])("rechaza puntuación inválida %s aunque se envíen normas vigentes", (puntuacion) => {
    const create = vi.fn();
    const service = new FeedbackService({ create } as unknown as FeedbackRepository);
    expect(() => service.create(randomUUID(), "usuario", {
      texto: "Bien", anonimo: true, puntuacion, versionNormas: "1",
    })).toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("registra normas vigentes antes del comentario, voto y auditoría en la misma transacción", async () => {
    const f = fixture();
    await f.repository.create(f.comisionId, f.usuarioId, { ...f.input, versionNormas: "1" });
    expect(f.tx.aceptacionNormas.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [{ usuarioId: f.usuarioId, version: "1" }], skipDuplicates: true,
    });
    expect(f.tx.aceptacionNormas.createMany.mock.invocationCallOrder[0]).toBeLessThan(f.tx.feedback.create.mock.invocationCallOrder[0]!);
    expect(f.tx.feedback.create.mock.invocationCallOrder[0]).toBeLessThan(f.tx.valoracionMateria.upsert.mock.invocationCallOrder[0]!);
    expect(f.tx.valoracionMateria.upsert.mock.invocationCallOrder[0]).toBeLessThan(f.tx.administracionHistorial.create.mock.invocationCallOrder[0]!);
    expect(f.tx.feedback.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      puntuacion: 4, historial: { create: expect.objectContaining({ puntuacion: 4 }) },
    }) }));
  });

  it("rechaza normas ausentes o antiguas antes de publicar y reutiliza aceptación vigente", async () => {
    const f = fixture();
    f.tx.aceptacionNormas.findUnique.mockResolvedValueOnce(null);
    await expect(f.repository.create(f.comisionId, f.usuarioId, f.input)).rejects.toMatchObject({ httpStatus: 409 });
    const stale = fixture();
    await expect(stale.repository.create(stale.comisionId, stale.usuarioId, { ...stale.input, versionNormas: "anterior" })).rejects.toMatchObject({ httpStatus: 409 });
    expect(stale.tx.feedback.create).not.toHaveBeenCalled();
    expect(f.tx.feedback.create).not.toHaveBeenCalled();
    const accepted = fixture();
    await accepted.repository.create(accepted.comisionId, accepted.usuarioId, accepted.input);
    expect(accepted.tx.feedback.create).toHaveBeenCalledTimes(1);
    expect(accepted.tx.aceptacionNormas.createMany).not.toHaveBeenCalled();
  });

  it("el servicio transporta estrellas y texto normalizado sin cambiar la identidad", async () => {
    const create = vi.fn().mockResolvedValue({});
    const service = new FeedbackService({ create } as unknown as FeedbackRepository);
    const id = randomUUID();
    await service.create(id, "usuario", { texto: "  Bien  ", anonimo: true, puntuacion: 5 });
    expect(create).toHaveBeenCalledExactlyOnceWith(id, "usuario", { texto: "Bien", anonimo: true, puntuacion: 5 });
    expect(() => service.create(id, "usuario", { texto: "Bien", anonimo: true })).toThrow();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("guarda estrellas individuales, snapshot y voto dentro de una sola transacción", async () => {
    const f = fixture();
    const result = await f.repository.create(f.comisionId, f.usuarioId, f.input);
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    expect(f.tx.feedback.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      autorId: f.usuarioId, materiaId: f.materiaId, puntuacion: 4,
      historial: { create: expect.objectContaining({ accion: "CREACION", puntuacion: 4, texto: "Bien", anonimo: true }) },
    }) }));
    expect(f.tx.valoracionMateria.upsert).toHaveBeenCalledWith({
      where: { usuarioId_materiaId: { usuarioId: f.usuarioId, materiaId: f.materiaId } },
      create: { usuarioId: f.usuarioId, materiaId: f.materiaId, puntuacion: 4 },
      update: { puntuacion: 4, deletedAt: null, updatedAt: expect.any(Date) },
    });
    expect(result).toMatchObject({ puntuacion: 4, autor: null, anonimo: true, propio: true });
    expect(result).not.toHaveProperty("autorId");
    expect(JSON.stringify(result)).not.toContain("Nombre privado");
  });

  it("toma comisión antes que usuario/materia y lee el voto solo después de ambos bloqueos", async () => {
    const f = fixture();
    await f.repository.create(f.comisionId, f.usuarioId, f.input);
    const queries = f.tx.$queryRaw.mock.calls;
    expect(queries).toHaveLength(3);
    expect((queries[0]![0] as TemplateStringsArray).join("?")).toContain('FROM "Comision"');
    expect((queries[0]![0] as TemplateStringsArray).join("?")).toContain("FOR UPDATE");
    expect((queries[2]![0] as TemplateStringsArray).join("?")).toContain("pg_advisory_xact_lock(2026071, hashtext(");
    expect(queries[2]![1]).toBe(`${f.usuarioId}:${f.materiaId}`);
    expect(f.tx.$queryRaw.mock.invocationCallOrder[2]).toBeLessThan(f.tx.valoracionMateria.findUnique.mock.invocationCallOrder[0]!);
    expect(f.tx.valoracionMateria.findUnique.mock.invocationCallOrder[0]).toBeLessThan(f.tx.feedback.create.mock.invocationCallOrder[0]!);
  });

  it.each([
    { name: "vigente", previous: { puntuacion: 2, deletedAt: null } },
    { name: "dada de baja", previous: { puntuacion: 2, deletedAt: new Date("2026-11-01") } },
  ])("actualiza la misma identidad global cuando está $name", async ({ previous }) => {
    const f = fixture(previous);
    await f.repository.create(f.comisionId, f.usuarioId, f.input);
    expect(f.tx.valoracionMateria.findUnique).toHaveBeenCalledWith({ where: { usuarioId_materiaId: { usuarioId: f.usuarioId, materiaId: f.materiaId } } });
    expect(f.tx.valoracionMateria.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { puntuacion: 4, deletedAt: null, updatedAt: expect.any(Date) },
    }));
    const changes = f.tx.administracionHistorial.create.mock.calls[0]![0].data.cambios;
    expect(changes).toContainEqual({ campo: "valoracionMateria.puntuacion", anterior: "2", nuevo: "4" });
    if (previous.deletedAt) expect(changes).toContainEqual({ campo: "valoracionMateria.deletedAt", anterior: previous.deletedAt.toISOString(), nuevo: null });
  });

  it("correlaciona snapshot y auditoría con el mismo UUID y registra al actor real", async () => {
    const f = fixture();
    await f.repository.create(f.comisionId, f.usuarioId, f.input);
    const snapshot = f.tx.feedback.create.mock.calls[0]![0].data.historial.create;
    expect(f.tx.administracionHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: snapshot.id, entidad: "feedback", entidadId: f.row.id, actorId: f.usuarioId, accion: "CREACION",
      cambios: expect.arrayContaining([{ campo: "puntuacion", anterior: null, nuevo: "4" },
        { campo: "valoracionMateria.puntuacion", anterior: null, nuevo: "4" }]),
    }) });
  });

  it("duplicado no modifica el voto ni crea eventos", async () => {
    const f = fixture();
    f.tx.feedback.findFirst.mockResolvedValue({ id: randomUUID() });
    await expect(f.repository.create(f.comisionId, f.usuarioId, f.input)).rejects.toBeInstanceOf(FeedbackDuplicateError);
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
    expect(f.tx.feedback.create).not.toHaveBeenCalled();
    expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });

  it("comisión inactiva no produce escrituras", async () => {
    const f = fixture();
    f.context.activa = false;
    await expect(f.repository.create(f.comisionId, f.usuarioId, f.input)).rejects.toBeInstanceOf(FeedbackClosedError);
    expect(f.tx.feedback.create).not.toHaveBeenCalled();
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
  });

  it.each(["comentario", "voto", "auditoría"])("propaga fallo de %s fuera de la transacción, sin reportar éxito", async (step) => {
    const f = fixture();
    const error = new Error(`fallo ${step}`);
    const write = step === "comentario" ? f.tx.feedback.create : step === "voto" ? f.tx.valoracionMateria.upsert : f.tx.administracionHistorial.create;
    write.mockRejectedValue(error);
    await expect(f.repository.create(f.comisionId, f.usuarioId, f.input)).rejects.toBe(error);
    if (step === "comentario") expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
    if (step !== "auditoría") expect(f.tx.administracionHistorial.create).not.toHaveBeenCalled();
  });

  it.each([
    { target: ["autorId", "comisionId"], duplicate: true },
    { target: "Feedback_autor_comision_vigente_key", duplicate: true },
    { target: ["usuarioId", "materiaId"], duplicate: false },
    { target: ["id"], duplicate: false },
  ])("P2002 solo traduce la unicidad de comentario: $target", async ({ target, duplicate }) => {
    const f = fixture();
    const error = new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "6.19.3", meta: { target } });
    f.tx.feedback.create.mockRejectedValue(error);
    const pending = expect(f.repository.create(f.comisionId, f.usuarioId, f.input)).rejects;
    if (duplicate) await pending.toBeInstanceOf(FeedbackDuplicateError);
    else await pending.toBe(error);
  });

  it.each([null, 4])("edición de texto y baja copian puntuación %j al snapshot sin tocar el voto", async (puntuacion) => {
    const f = fixture();
    Object.assign(f.row, { puntuacion });
    f.tx.$queryRaw.mockReset().mockResolvedValueOnce([{ id: f.comisionId }]).mockResolvedValueOnce([f.context]).mockResolvedValue([{ id: f.comisionId }]);
    await f.repository.update(f.row.id, f.usuarioId, { texto: "Ampliado" });
    await f.repository.remove(f.row.id, f.usuarioId);
    for (const [args] of f.tx.feedback.update.mock.calls) expect(args.data.historial.create.puntuacion).toBe(puntuacion);
    expect(f.tx.valoracionMateria.upsert).not.toHaveBeenCalled();
  });
});
