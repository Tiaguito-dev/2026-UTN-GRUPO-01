import type { Prisma } from "../../generated/prisma/client.js";
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
    // One bounded page query with batched relations; no transaction survives between pages.
    // Value predicates keep working when either anchor row has been soft-deleted.
    const rows = await this.prisma.feedback.findMany({
      where: { deletedAt: null, ...(cursor ? { AND: [boundary(cursor.upper, true), boundary(cursor.after, false)] } : {}) },
      include: includeAutor,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
    });
    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize);
    const first = items[0];
    const last = items.at(-1);
    const nextCursor = hasMore && first && last ? Buffer.from(JSON.stringify({
      v: 1, pageSize,
      upper: cursor?.upper ?? { createdAt: first.createdAt.toISOString(), id: first.id },
      after: { createdAt: last.createdAt.toISOString(), id: last.id },
    })).toString("base64url") : null;
    return { items: items.map(row => present(row, viewer)), nextCursor, hasMore };
  }
}
