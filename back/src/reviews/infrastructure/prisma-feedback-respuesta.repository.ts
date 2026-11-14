import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { FeedbackRespuestaRepository } from "../application/ports/feedback-respuesta.repository.js";
import type { FeedbackRespuesta, FeedbackRespuestaCreada } from "../domain/feedback-respuesta.js";
import type { CreateFeedbackRespuestaInput, UpdateFeedbackRespuestaInput } from "../application/feedback-respuesta-input.js";
import { FeedbackRespuestaConflictError } from "../application/feedback-respuesta.service.js";
import { FeedbackNotFoundError } from "../application/errors.js";
import { ComisionNotFoundError } from "../../academic/application/errors.js";
import { assertFeedbackOpen, assertFeedbackOwner } from "../application/feedback-policy.js";

import type { Pagination } from "../../shared/domain/pagination.js";

const publicInclude = { autor: { select: { displayName: true } } } satisfies Prisma.FeedbackRespuestaInclude;
const retryInclude = { ...publicInclude, historial: {
  where: { accion: "CREACION" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1,
  select: { texto: true, anonimo: true },
} } satisfies Prisma.FeedbackRespuestaInclude;

function present(row: Prisma.FeedbackRespuestaGetPayload<{ include: typeof publicInclude }>, viewer: string): FeedbackRespuesta {
  return {
    id: row.id, feedbackId: row.feedbackId, texto: row.texto, anonimo: row.anonimo,
    autor: row.anonimo ? null : { displayName: row.autor.displayName }, propio: row.autorId === viewer,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function metadataObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function requestColumns(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(field => typeof field === "string")) return false;
  // The pg adapter returns quoted SQL identifiers; compare metadata, never error messages.
  const fields = value.map((field: string) => field.replace(/^"([^"]+)"$/, "$1"));
  return fields.includes("autorId") && fields.includes("solicitudId");
}

function requestCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const model = error.meta?.["modelName"];
  if (model !== undefined && model !== "FeedbackRespuesta") return false;
  const target = error.meta?.["target"];
  if (target !== undefined) return target === "FeedbackRespuesta_autorId_solicitudId_key" || requestColumns(target);
  const adapter = metadataObject(error.meta?.["driverAdapterError"]);
  const cause = metadataObject(adapter?.["cause"]);
  const constraint = metadataObject(cause?.["constraint"]);
  return requestColumns(constraint?.["fields"]);
}

export class PrismaFeedbackRespuestaRepository implements FeedbackRespuestaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(id: string, viewer: string, pagination: Pagination) {
    return this.prisma.$transaction(async tx => {
      const parent = await tx.feedback.findUnique({ where: { id }, select: { deletedAt: true } });
      if (!parent || parent.deletedAt) throw new FeedbackNotFoundError();
      const where = { feedbackId: id, deletedAt: null, feedback: { deletedAt: null } };
      const [rows, total] = await Promise.all([
        tx.feedbackRespuesta.findMany({ where, include: publicInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }),
        tx.feedbackRespuesta.count({ where }),
      ]);
      return { items: rows.map(row => present(row, viewer)), total, ...pagination };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async update(id: string, viewer: string, input: UpdateFeedbackRespuestaInput): Promise<FeedbackRespuesta> {
    return (await this.mutate(id, viewer, input))!;
  }

  async remove(id: string, viewer: string): Promise<void> {
    await this.mutate(id, viewer);
  }

  private async mutate(id: string, viewer: string, input?: UpdateFeedbackRespuestaInput) {
    const original = await this.prisma.feedbackRespuesta.findUnique({ where: { id }, select: { feedbackId: true, feedback: { select: { comisionId: true } } } });
    if (!original) throw new FeedbackNotFoundError();
    return this.prisma.$transaction(async tx => {
      const commissions = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Comision" WHERE "id"=${original.feedback.comisionId}::uuid FOR UPDATE`;
      if (!commissions.length) throw new FeedbackNotFoundError();
      const [parent] = await tx.$queryRaw<{ id: string; deletedAt: Date | null; comisionId: string }[]>`SELECT "id", "deletedAt", "comisionId" FROM "Feedback" WHERE "id"=${original.feedbackId}::uuid FOR UPDATE`;
      if (!parent || parent.deletedAt || parent.comisionId !== original.feedback.comisionId) throw new FeedbackNotFoundError();
      await tx.$queryRaw`SELECT "id" FROM "FeedbackRespuesta" WHERE "id"=${id}::uuid FOR UPDATE`;
      const row = await tx.feedbackRespuesta.findUnique({ where: { id }, include: publicInclude });
      if (!row || row.feedbackId !== parent.id || (input !== undefined && row.deletedAt)) throw new FeedbackNotFoundError();
      assertFeedbackOwner(row.autorId, viewer);
      if (input === undefined && row.deletedAt) return;
      if (input !== undefined) {
        const context = await tx.comision.findFirst({ where: { id: parent.comisionId, deletedAt: null, cursada: { deletedAt: null, materia: { deletedAt: null } } }, select: { activa: true } });
        if (!context) throw new ComisionNotFoundError();
        assertFeedbackOpen(context.activa);
      }
      const texto = input?.texto ?? row.texto;
      const anonimo = input?.anonimo ?? row.anonimo;
      if (input !== undefined && texto === row.texto && anonimo === row.anonimo) return present(row, viewer);
      const now = new Date(); const eventId = randomUUID();
      const accion = input === undefined ? "ELIMINACION" : "EDICION";
      const cambios = input === undefined ? [{ campo: "deletedAt", anterior: null, nuevo: now.toISOString() }] : [
        { campo: "texto", anterior: row.texto, nuevo: texto },
        { campo: "anonimo", anterior: String(row.anonimo), nuevo: String(anonimo) },
      ].filter(change => change.anterior !== change.nuevo);
      const updated = await tx.feedbackRespuesta.update({ where: { id }, data: {
        texto, anonimo, updatedAt: now, ...(input === undefined ? { deletedAt: now } : {}),
        historial: { create: { id: eventId, accion, texto, anonimo } },
      }, include: publicInclude });
      await tx.administracionHistorial.create({ data: { id: eventId, entidad: "respuesta", entidadId: id, actorId: viewer, accion, cambios } });
      return present(updated, viewer);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async create(id: string, viewer: string, input: CreateFeedbackRespuestaInput): Promise<FeedbackRespuestaCreada> {
    try {
      return await this.execute(id, viewer, input);
    } catch (error) {
      if (!requestCollision(error)) throw error;
      // The failed transaction has already rolled back. Resolve the winning request in a new one.
      return this.execute(id, viewer, input, error);
    }
  }

  private async execute(id: string, viewer: string, input: CreateFeedbackRespuestaInput, collision?: unknown): Promise<FeedbackRespuestaCreada> {
    const original = await this.prisma.feedback.findUnique({ where: { id }, select: { comisionId: true } });
    if (!original) throw new FeedbackNotFoundError();
    return this.prisma.$transaction(async tx => {
      const commissions = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Comision" WHERE "id" = ${original.comisionId}::uuid FOR UPDATE`;
      if (!commissions.length) throw new FeedbackNotFoundError();
      const [parent] = await tx.$queryRaw<{ id: string; comisionId: string; deletedAt: Date | null }[]>`
        SELECT "id", "comisionId", "deletedAt" FROM "Feedback" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (!parent || parent.deletedAt || parent.comisionId !== original.comisionId) throw new FeedbackNotFoundError();
      // Read ancestor validity without acquiring locks in the reverse of academic administration.
      const context = await tx.comision.findFirst({ where: {
        id: parent.comisionId, deletedAt: null, cursada: { deletedAt: null, materia: { deletedAt: null } },
      }, select: { activa: true } });
      if (!context) throw new ComisionNotFoundError();
      assertFeedbackOpen(context.activa);
      const [previous] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "FeedbackRespuesta"
        WHERE "autorId" = ${viewer}::uuid AND "solicitudId" = ${input.solicitudId}::uuid FOR UPDATE`;
      if (previous) {
        const row = await tx.feedbackRespuesta.findUnique({ where: { id: previous.id }, include: retryInclude });
        if (!row) throw new Error("La respuesta idempotente desapareció durante la transacción.");
        const snapshot = row.historial[0];
        if (!snapshot) throw new Error("La respuesta no tiene snapshot original de creación.");
        if (row.deletedAt || row.feedbackId !== id || snapshot.texto !== input.texto || snapshot.anonimo !== input.anonimo) {
          throw new FeedbackRespuestaConflictError();
        }
        return { respuesta: present(row, viewer), created: false };
      }
      if (collision) throw collision;
      const eventId = randomUUID();
      const row = await tx.feedbackRespuesta.create({ data: {
        feedbackId: id, autorId: viewer, ...input,
        historial: { create: { id: eventId, accion: "CREACION", texto: input.texto, anonimo: input.anonimo } },
      }, include: publicInclude });
      await tx.administracionHistorial.create({ data: {
        id: eventId, entidad: "respuesta", entidadId: row.id, actorId: viewer, accion: "CREACION", cambios: [],
      } });
      return { respuesta: present(row, viewer), created: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
