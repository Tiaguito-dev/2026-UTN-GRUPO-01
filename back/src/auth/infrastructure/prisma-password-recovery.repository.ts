import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { PasswordRecoveryRepository, PasswordResetCredential } from "../domain/password-recovery.repository.js";

export class PrismaPasswordRecoveryRepository implements PasswordRecoveryRepository {
  constructor(private readonly prisma: PrismaService, private readonly now: () => Date = () => new Date()) {}

  async issue(credential: PasswordResetCredential): Promise<void> {
    if (credential.consumedAt !== null || credential.invalidatedAt !== null || credential.deliveredAt !== null || credential.expiresAt <= credential.createdAt) {
      throw new Error("La credencial de recuperación no respeta sus límites.");
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, credential.userId);
      const checkedAt = this.checkedAt(credential.createdAt);
      if (credential.expiresAt <= checkedAt) throw new Error("La credencial de recuperación venció antes de persistirse.");
      await tx.passwordResetCredential.updateMany({ where: { userId: credential.userId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: checkedAt } });
      await tx.passwordResetCredential.create({ data: credential });
    }, { isolationLevel: "ReadCommitted" });
  }

  async invalidate(credentialId: string, now: Date): Promise<void> {
    // Delivery failure can affect this credential only, even if another request issued
    // a newer one while SMTP was running. No locks are held during delivery.
    await this.prisma.passwordResetCredential.updateMany({ where: { id: credentialId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: this.checkedAt(now) } });
  }

  async findByHash(hash: string): Promise<PasswordResetCredential | null> {
    return this.prisma.passwordResetCredential.findUnique({ where: { tokenHash: hash } });
  }

  async markDelivered(credentialId: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.passwordResetCredential.findUnique({ where: { id: credentialId } });
      if (!candidate) return;
      await this.lockUser(tx, candidate.userId);
      const checkedAt = this.checkedAt(now);
      // A later issue/change must not be undone by a slow successful SMTP delivery.
      await tx.passwordResetCredential.updateMany({ where: {
        id: credentialId, consumedAt: null, invalidatedAt: null, deliveredAt: null,
        expiresAt: { gt: checkedAt },
      }, data: { deliveredAt: checkedAt } });
    }, { isolationLevel: "ReadCommitted" });
  }

  async findPasswordByUserId(userId: string): Promise<{ id: string; passwordHash: string } | null> {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
  }

  async reset(hash: string, newPasswordHash: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.passwordResetCredential.findUnique({ where: { tokenHash: hash } });
      if (!candidate) return false;
      await this.lockUser(tx, candidate.userId);
      await this.lockSessions(tx, candidate.userId);
      const credential = await tx.passwordResetCredential.findUnique({ where: { tokenHash: hash } });
      const checkedAt = this.checkedAt(now);
      if (!credential || credential.deliveredAt === null || credential.consumedAt !== null || credential.invalidatedAt !== null || credential.expiresAt <= checkedAt) return false;
      await tx.user.update({ where: { id: credential.userId }, data: { passwordHash: newPasswordHash } });
      await tx.passwordResetCredential.update({ where: { id: credential.id }, data: { consumedAt: checkedAt } });
      await this.invalidateAndRevoke(tx, credential.userId, checkedAt);
      return true;
    }, { isolationLevel: "ReadCommitted" });
  }

  async change(userId: string, expectedPasswordHash: string, newPasswordHash: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
      if (!user || user.passwordHash !== expectedPasswordHash) return false;
      await this.lockSessions(tx, userId);
      await tx.user.update({ where: { id: userId }, data: { passwordHash: newPasswordHash } });
      await this.invalidateAndRevoke(tx, userId, this.checkedAt(now));
      return true;
    }, { isolationLevel: "ReadCommitted" });
  }

  private async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    // Login and password mutations use User -> ordered Sessions. Refresh/logout only
    // lock Session and never acquire User, preventing an inverse lock dependency.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  }

  private async lockSessions(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "userId" = ${userId}::uuid ORDER BY "id" FOR UPDATE`;
  }

  private async invalidateAndRevoke(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> {
    await tx.passwordResetCredential.updateMany({ where: { userId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.refreshCredential.updateMany({ where: { session: { userId }, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
  }

  private checkedAt(supplied: Date): Date {
    return new Date(Math.max(supplied.getTime(), this.now().getTime()));
  }
}
