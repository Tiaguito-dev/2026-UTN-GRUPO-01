import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { FeedbackFeedRepository } from "../application/ports/feedback-feed.repository.js";
import type { FeedbackFeed, FeedbackFeedPoint, FeedbackFeedQuery } from "../domain/feedback-feed.js";
import { includeAutor, present } from "./prisma-feedback.repository.js";

function boundary(point: FeedbackFeedPoint, inclusive: boolean): Prisma.FeedbackWhereInput {
  const createdAt = new Date(point.createdAt);
  return { OR: [
    { createdAt: { lt: createdAt } },
    { createdAt, id: inclusive ? { lte: point.id } : { lt: point.id } },
  ] };
}

export class PrismaFeedbackFeedRepository implements FeedbackFeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(viewer: string, { pageSize, cursor }: FeedbackFeedQuery): Promise<FeedbackFeed> {
    // The page and its aggregated interactions share a snapshot within this request only.
    return this.prisma.$transaction(async tx => {
      const rows = await tx.feedback.findMany({
        where: { deletedAt: null, ...(cursor ? { AND: [boundary(cursor.upper, true), boundary(cursor.after, false)] } : {}) },
        include: includeAutor,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pageSize + 1,
      });
      const hasMore = rows.length > pageSize;
      const items = rows.slice(0, pageSize);
      const likes = items.length ? await tx.$queryRaw<{ feedbackId: string; cantidadLikes: bigint; meGusta: boolean }[]>(Prisma.sql`
        SELECT "feedbackId", COUNT(*) AS "cantidadLikes", BOOL_OR("usuarioId" = ${viewer}::uuid) AS "meGusta"
        FROM "FeedbackLike" WHERE "deletedAt" IS NULL
          AND "feedbackId" IN (${Prisma.join(items.map(item => Prisma.sql`${item.id}::uuid`))})
        GROUP BY "feedbackId"`) : [];
      const replies = items.length ? await tx.feedbackRespuesta.groupBy({
        by: ["feedbackId"], where: { deletedAt: null, feedback: { deletedAt: null }, feedbackId: { in: items.map(item => item.id) } },
        _count: { _all: true },
      }) : [];
      const byReplies = new Map(replies.map(reply => [reply.feedbackId, reply._count._all]));
      const byFeedback = new Map(likes.map(like => [like.feedbackId, like]));
      const first = items[0];
      const last = items.at(-1);
      const nextCursor = hasMore && first && last ? Buffer.from(JSON.stringify({
        v: 1, pageSize,
        upper: cursor?.upper ?? { createdAt: first.createdAt.toISOString(), id: first.id },
        after: { createdAt: last.createdAt.toISOString(), id: last.id },
      })).toString("base64url") : null;
      return { items: items.map(row => {
        const summary = byFeedback.get(row.id);
        return { ...present(row, viewer), cantidadRespuestas: byReplies.get(row.id) ?? 0, cantidadLikes: Number(summary?.cantidadLikes ?? 0n), meGusta: summary?.meGusta ?? false };
      }), nextCursor, hasMore };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
