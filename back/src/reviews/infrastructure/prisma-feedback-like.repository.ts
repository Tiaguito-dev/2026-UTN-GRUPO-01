import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { FeedbackLikeRepository, FeedbackLikeState } from "../application/ports/feedback-like.repository.js";
import { FeedbackNotFoundError } from "../application/errors.js";
import { FeedbackSelfLikeError } from "../application/feedback-like.service.js";

export class PrismaFeedbackLikeRepository implements FeedbackLikeRepository {
  constructor(private readonly prisma: PrismaService) {}
  put(id: string, viewer: string) { return this.change(id, viewer, true); }
  remove(id: string, viewer: string) { return this.change(id, viewer, false); }

  private async change(id: string, viewer: string, active: boolean): Promise<FeedbackLikeState> {
    const original = await this.prisma.feedback.findUnique({ where: { id }, select: { comisionId: true } });
    if (!original) throw new FeedbackNotFoundError();
    return this.prisma.$transaction(async tx => {
      // Parent removal takes this same commission lock before touching Feedback.
      // No user/materia lock is needed: likes never write ratings.
      const commissions = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Comision" WHERE "id" = ${original.comisionId}::uuid FOR UPDATE`;
      if (!commissions.length) throw new FeedbackNotFoundError();
      const [parent] = await tx.$queryRaw<{ id: string; autorId: string; comisionId: string; deletedAt: Date | null }[]>`
        SELECT "id", "autorId", "comisionId", "deletedAt" FROM "Feedback" WHERE "id" = ${id}::uuid FOR UPDATE`;
      // Match public historical visibility: academic inactivity/deletion does not hide Feedback.
      if (!parent || parent.deletedAt || parent.comisionId !== original.comisionId) throw new FeedbackNotFoundError();
      if (parent.autorId === viewer) throw new FeedbackSelfLikeError();
      const [previous] = await tx.$queryRaw<{ deletedAt: Date | null }[]>`
        SELECT "deletedAt" FROM "FeedbackLike"
        WHERE "usuarioId" = ${viewer}::uuid AND "feedbackId" = ${id}::uuid FOR UPDATE`;
      const wasActive = previous !== undefined && previous.deletedAt === null;
      if (wasActive !== active) {
        const now = new Date();
        const deletedAt = active ? null : now;
        if (previous) await tx.feedbackLike.update({
          where: { usuarioId_feedbackId: { usuarioId: viewer, feedbackId: id } },
          data: { deletedAt, updatedAt: now },
        });
        else await tx.feedbackLike.create({ data: { usuarioId: viewer, feedbackId: id } });
        await tx.administracionHistorial.create({ data: {
          entidad: "feedbackLike", entidadId: id, actorId: viewer,
          accion: active ? (previous ? "REACTIVACION" : "CREACION") : "ELIMINACION",
          cambios: [{ campo: "deletedAt", anterior: previous?.deletedAt?.toISOString() ?? null, nuevo: deletedAt?.toISOString() ?? null }],
        } });
      }
      const cantidadLikes = await tx.feedbackLike.count({ where: { feedbackId: id, deletedAt: null } });
      return { meGusta: active, cantidadLikes };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
