import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { RefreshCredentialRepository } from "../domain/refresh-credential.repository.js";
import type { RefreshCredential } from "../domain/refresh-credential.js";
import type { Session } from "../domain/session.js";
import type { PublicUser } from "../../users/domain/user.js";
import { InvalidRefreshCredentialError } from "../domain/refresh-errors.js";

export class PrismaRefreshCredentialRepository implements RefreshCredentialRepository {
  constructor(private readonly prisma: PrismaService, private readonly now: () => Date = () => new Date()) {}

  async createSession(session: Session, credential: RefreshCredential, expectedPasswordHash: string): Promise<boolean> {
    this.validateReplacement(session, credential);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
      if (!user || user.passwordHash !== expectedPasswordHash) return false;
      await tx.session.create({ data: session });
      await tx.refreshCredential.create({ data: credential });
      return true;
    }, { isolationLevel: "ReadCommitted" });
  }

  async findByHash(hash: string): Promise<RefreshCredential | null> {
    return this.prisma.refreshCredential.findUnique({ where: { tokenHash: hash } });
  }

  async rotate(hash: string, now: Date, prepareReplacement: (session: Session, user: PublicUser | null) => Promise<RefreshCredential>): Promise<"rotated" | "invalid" | "reused"> {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.refreshCredential.findUnique({ where: { tokenHash: hash } });
      if (!candidate) return "invalid";
      // All rotation and revocation operations lock the session first. State is read again
      // after this PostgreSQL row lock, including across application processes.
      await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${candidate.sessionId}::uuid FOR UPDATE`;
      const session = await tx.session.findUnique({ where: { id: candidate.sessionId } });
      const credential = await tx.refreshCredential.findUnique({ where: { tokenHash: hash } });
      let checkedAt = this.checkedAt(now);
      if (!session || !credential || session.revokedAt !== null || session.expiresAt <= checkedAt) return "invalid";
      if (credential.consumedAt !== null) {
        await tx.session.update({ where: { id: session.id }, data: { revokedAt: checkedAt } });
        await tx.refreshCredential.updateMany({ where: { sessionId: session.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: checkedAt } });
        // Returning a status commits revocation. Throwing here would undo reuse detection.
        return "reused";
      }
      if (credential.invalidatedAt !== null || credential.expiresAt <= checkedAt) return "invalid";
      // Use the transaction's connection: an external user lookup while holding the
      // session lock could exhaust the pool when concurrent transactions wait for it.
      const user = await tx.user.findUnique({ where: { id: session.userId },
        select: { id: true, email: true, displayName: true, role: true, createdAt: true } });
      const replacement = await prepareReplacement(session, user);
      this.validateReplacement(session, replacement);
      checkedAt = this.checkedAt(now);
      if (session.expiresAt <= checkedAt || credential.expiresAt <= checkedAt || replacement.expiresAt <= checkedAt) return "invalid";
      await tx.refreshCredential.update({ where: { id: credential.id }, data: { consumedAt: checkedAt } });
      await tx.refreshCredential.create({ data: replacement });
      if (session.expiresAt <= this.checkedAt(now)) throw new InvalidRefreshCredentialError();
      return "rotated";
    }, { isolationLevel: "ReadCommitted" });
  }

  async revokeSession(sessionId: string, now: Date, expectedUserId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${sessionId}::uuid FOR UPDATE`;
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (!session || (expectedUserId !== undefined && session.userId !== expectedUserId)) return;
      const checkedAt = this.checkedAt(now);
      if (session.revokedAt === null) await tx.session.update({ where: { id: sessionId }, data: { revokedAt: checkedAt } });
      await tx.refreshCredential.updateMany({ where: { sessionId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: checkedAt } });
    }, { isolationLevel: "ReadCommitted" });
  }

  private checkedAt(supplied: Date): Date {
    return new Date(Math.max(supplied.getTime(), this.now().getTime()));
  }

  private validateReplacement(session: Session, credential: RefreshCredential): void {
    if (credential.sessionId !== session.id || credential.consumedAt !== null || credential.invalidatedAt !== null ||
      credential.expiresAt > session.expiresAt || credential.createdAt < session.createdAt || credential.expiresAt <= credential.createdAt) {
      throw new Error("La credencial de renovación no respeta los límites de la sesión.");
    }
  }
}
