import { UnauthorizedException } from "@nestjs/common";
import { canAuthenticate } from "../../users/domain/user.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SessionActivityRepository, SessionOperation } from "../domain/session-activity.repository.js";
import type { Session } from "../domain/session.js";
import { sessionExpired, sessionStatus, type IdleSessionPolicy } from "../domain/session-lifetime.js";

export class PrismaSessionActivityRepository implements SessionActivityRepository {
  constructor(private readonly prisma: PrismaService, private readonly now: () => Date = () => new Date()) {}

  async access(sessionId: string, userId: string, operation: SessionOperation, now: Date,
    policy: IdleSessionPolicy): Promise<Session | null> {
    return this.prisma.$transaction(async (tx) => {
      // Refresh and logout acquire this same row lock before reading or changing the session.
      await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${sessionId}::uuid FOR UPDATE`;
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      let checkedAt = this.checkedAt(now);
      if (!session || session.userId !== userId || sessionExpired(session, checkedAt, policy.idleTtlSeconds)) return null;
      const user = await tx.user.findUnique({ where: { id: userId },
        select: { role: true, emailVerifiedAt: true, disabledAt: true } });
      checkedAt = this.checkedAt(now);
      if (!user || !canAuthenticate(user) || sessionExpired(session, checkedAt, policy.idleTtlSeconds)) return null;
      const warningAt = new Date(sessionStatus(session, checkedAt, policy).warningAt);
      const update = operation === "renew" || (operation === "activity" && checkedAt < warningAt);
      if (!update) return session;
      const updated = await tx.session.update({ where: { id: sessionId }, data: { lastActivityAt: checkedAt } });
      // If the request crossed its old deadline while writing, roll back instead of reviving it.
      if (sessionExpired(session, this.checkedAt(now), policy.idleTtlSeconds)) {
        throw new UnauthorizedException("La sesión terminó. Iniciá sesión nuevamente.");
      }
      return updated;
    }, { isolationLevel: "ReadCommitted" });
  }

  private checkedAt(supplied: Date): Date {
    return new Date(Math.max(supplied.getTime(), this.now().getTime()));
  }
}
