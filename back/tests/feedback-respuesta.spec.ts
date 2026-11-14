import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { validateCreateFeedbackRespuesta } from "../src/reviews/application/feedback-respuesta-input.js";
import { FeedbackRespuestaService } from "../src/reviews/application/feedback-respuesta.service.js";
import { PrismaFeedbackRespuestaRepository } from "../src/reviews/infrastructure/prisma-feedback-respuesta.repository.js";

const viewer = randomUUID();
const id = randomUUID();
const comisionId = randomUUID();
const input = { solicitudId: randomUUID(), texto: "Respuesta", anonimo: true };

describe("Respuestas: validación", () => {
  it("normaliza texto y UUID sin exigir estrellas", () => {
    expect(validateCreateFeedbackRespuesta({ ...input, solicitudId: input.solicitudId.toUpperCase(), texto: "  Respuesta  " })).toEqual(input);
    expect(validateCreateFeedbackRespuesta({ ...input, texto: "😀".repeat(3000) }).texto).toHaveLength(6000);
  });
  it.each([
    {}, { ...input, solicitudId: undefined }, { ...input, solicitudId: "invalid" },
    { ...input, texto: " " }, { ...input, texto: "x".repeat(3001) }, { ...input, texto: "a\u0000b" },
    { ...input, texto: null }, { ...input, anonimo: undefined }, { ...input, anonimo: "true" },
    { ...input, autorId: viewer }, { ...input, puntuacion: 4 }, { ...input, feedbackId: id },
  ])("rechaza cuerpo inválido %j", body => {
    expect(() => validateCreateFeedbackRespuesta(body)).toThrow();
  });
  it("no llega a persistencia con UUID o cuerpo inválidos", () => {
    const create = vi.fn();
    const service = new FeedbackRespuestaService({ create });
    expect(() => service.create("invalid", viewer, input)).toThrow();
    expect(() => service.create(id, viewer, {})).toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});

function setup() {
  const order: string[] = [];
  const parent = { id, comisionId, deletedAt: null as Date | null };
  const context = { activa: true };
  const now = new Date();
  const row = {
    id: randomUUID(), feedbackId: id, autorId: viewer, autor: { displayName: "Identidad privada" },
    ...input, createdAt: now, updatedAt: now, deletedAt: null as Date | null,
    historial: [{ texto: input.texto, anonimo: input.anonimo }],
  };
  const query = vi.fn().mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes('FROM "Comision"')) { order.push("comision"); return [{ id: comisionId }]; }
    if (sql.includes('FROM "Feedback"')) { order.push("feedback"); return [parent]; }
    if (sql.includes('FROM "FeedbackRespuesta"')) { order.push("respuesta"); return []; }
    throw new Error("SQL inesperado");
  });
  const create = vi.fn().mockResolvedValue(row);
  const existing = vi.fn().mockResolvedValue(row);
  const audit = vi.fn().mockResolvedValue({});
  const academic = vi.fn().mockResolvedValue(context);
  const tx = { $queryRaw: query, comision: { findFirst: academic }, feedbackRespuesta: { create, findUnique: existing }, administracionHistorial: { create: audit } };
  const transaction = vi.fn().mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  const repository = new PrismaFeedbackRespuestaRepository({ feedback: { findUnique: vi.fn().mockResolvedValue({ comisionId }) }, $transaction: transaction } as unknown as PrismaService);
  return { repository, order, parent, context, row, query, create, existing, audit, academic, transaction };
}

describe("Respuestas: transacción e idempotencia", () => {
  it("crea con snapshot y auditoría, sin exponer identidad ni solicitudId", async () => {
    const f = setup();
    const result = await f.repository.create(id, viewer, input);
    expect(result.created).toBe(true);
    expect(result.respuesta).toMatchObject({ texto: input.texto, anonimo: true, autor: null, propio: true, feedbackId: id });
    expect(JSON.stringify(result)).not.toMatch(/autorId|solicitudId|Identidad privada/);
    expect(f.order).toEqual(["comision", "feedback", "respuesta"]);
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      feedbackId: id, autorId: viewer, ...input, historial: { create: expect.objectContaining({ accion: "CREACION", texto: input.texto, anonimo: true }) },
    }) }));
    expect(f.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ entidad: "respuesta", entidadId: f.row.id, actorId: viewer, accion: "CREACION" }) });
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
  });
  it("repite según snapshot original sin sobrescribir ediciones posteriores", async () => {
    const f = setup();
    f.query.mockImplementation(async strings => {
      const sql = (strings as TemplateStringsArray).join("?");
      return sql.includes('FROM "FeedbackRespuesta"') ? [{ id: f.row.id }] : sql.includes('FROM "Feedback"') ? [f.parent] : [{ id: comisionId }];
    });
    f.row.texto = "Edición posterior";
    f.row.anonimo = false;
    const result = await f.repository.create(id, viewer, input);
    expect(result).toMatchObject({ created: false, respuesta: { texto: "Edición posterior", autor: { displayName: "Identidad privada" } } });
    expect(f.create).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
  });
  it.each(["texto", "anonimo", "feedbackId", "deletedAt"] as const)("conflicto si cambia %s o la respuesta fue eliminada", async field => {
    const f = setup();
    f.query.mockResolvedValueOnce([{ id: comisionId }]).mockResolvedValueOnce([f.parent]).mockResolvedValueOnce([{ id: f.row.id }]);
    if (field === "texto") f.row.historial[0]!.texto = "Otro original";
    if (field === "anonimo") f.row.historial[0]!.anonimo = false;
    if (field === "feedbackId") f.row.feedbackId = randomUUID();
    if (field === "deletedAt") f.row.deletedAt = new Date();
    await expect(f.repository.create(id, viewer, input)).rejects.toMatchObject({ httpStatus: 409 });
    expect(f.create).not.toHaveBeenCalled();
  });
  it("padre eliminado prevalece frente a idempotencia", async () => {
    const f = setup();
    f.parent.deletedAt = new Date();
    await expect(f.repository.create(id, viewer, input)).rejects.toMatchObject({ httpStatus: 404 });
    expect(f.create).not.toHaveBeenCalled();
  });
  it("rechaza comisión inactiva y contexto académico eliminado", async () => {
    const f = setup();
    f.context.activa = false;
    await expect(f.repository.create(id, viewer, input)).rejects.toMatchObject({ httpStatus: 409 });
    f.academic.mockResolvedValueOnce(null);
    await expect(f.repository.create(id, viewer, input)).rejects.toMatchObject({ httpStatus: 404 });
  });
  it("resuelve P2002 de la solicitud en una transacción nueva", async () => {
    const f = setup();
    const collision = new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6.19.3", meta: { target: ["autorId", "solicitudId"] } });
    f.transaction.mockRejectedValueOnce(collision);
    f.query.mockResolvedValueOnce([{ id: comisionId }]).mockResolvedValueOnce([f.parent]).mockResolvedValueOnce([{ id: f.row.id }]);
    expect(await f.repository.create(id, viewer, input)).toMatchObject({ created: false });
    expect(f.transaction).toHaveBeenCalledTimes(2);
    expect(f.create).not.toHaveBeenCalled();
  });
  it.each([
    { target: "FeedbackRespuesta_autorId_solicitudId_key" },
    { modelName: "FeedbackRespuesta", driverAdapterError: { cause: { kind: "UniqueConstraintViolation", originalCode: "23505", constraint: { fields: ['"autorId"', '"solicitudId"'] } } } },
    { modelName: "FeedbackRespuesta", driverAdapterError: { cause: { constraint: { fields: ["solicitudId", "autorId"] } } } },
  ])("reconoce únicamente la solicitud mediante metadatos %j", async meta => {
    const f = setup();
    f.transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("sin usar mensaje", { code: "P2002", clientVersion: "6.19.3", meta }));
    f.query.mockResolvedValueOnce([{ id: comisionId }]).mockResolvedValueOnce([f.parent]).mockResolvedValueOnce([{ id: f.row.id }]);
    expect(await f.repository.create(id, viewer, input)).toMatchObject({ created: false });
    expect(f.transaction).toHaveBeenCalledTimes(2);
    expect(f.create).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
  });
  it.each([
    undefined, {}, { target: ["id"] }, { target: ["autorId", "autorId"] },
    { driverAdapterError: null }, { driverAdapterError: { cause: { constraint: { fields: ['"id"'] } } } },
    { driverAdapterError: { cause: { constraint: { fields: ["autorId", "solicitudId", "feedbackId"] } } } },
    { driverAdapterError: { cause: { constraint: { fields: ["autorId", 1] } } } },
    { modelName: "OtroModelo", target: ["autorId", "solicitudId"] },
    { modelName: "OtroModelo", driverAdapterError: { cause: { constraint: { fields: ["autorId", "solicitudId"] } } } },
  ])("no reinterpreta otra restricción ni metadatos incompletos %j", async meta => {
    const f = setup();
    const error = new Prisma.PrismaClientKnownRequestError("autorId solicitudId: este mensaje no identifica una restricción", { code: "P2002", clientVersion: "6.19.3", ...(meta === undefined ? {} : { meta }) });
    f.transaction.mockRejectedValueOnce(error);
    await expect(f.repository.create(id, viewer, input)).rejects.toBe(error);
    expect(f.transaction).toHaveBeenCalledOnce();
  });
  it("no convierte otras colisiones ni errores de auditoría en reintentos", async () => {
    const f = setup();
    const error = new Prisma.PrismaClientKnownRequestError("duplicate id", { code: "P2002", clientVersion: "6.19.3", meta: { target: ["id"] } });
    f.transaction.mockRejectedValueOnce(error);
    await expect(f.repository.create(id, viewer, input)).rejects.toBe(error);
    expect(f.transaction).toHaveBeenCalledOnce();
    f.audit.mockRejectedValueOnce(new Error("auditoría fallida"));
    await expect(f.repository.create(id, viewer, input)).rejects.toThrow("auditoría fallida");
  });
});
