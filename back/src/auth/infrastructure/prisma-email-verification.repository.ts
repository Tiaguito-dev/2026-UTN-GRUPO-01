import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { EmailVerificationCredential, EmailVerificationRepository } from "../domain/email-verification.js";
export class PrismaEmailVerificationRepository implements EmailVerificationRepository {
  constructor(private readonly prisma: PrismaService, private readonly now: () => Date = () => new Date()) {}
  async issue(credential: EmailVerificationCredential): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${credential.userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: credential.userId } });
      const now = this.checkedAt(credential.createdAt);
      if (!user || user.disabledAt || user.role === "ADMIN" || user.emailVerifiedAt !== null || credential.expiresAt <= now) return false;
      await tx.emailVerificationCredential.updateMany({ where: { userId: user.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
      await tx.emailVerificationCredential.create({ data: credential });
      return true;
    }, { isolationLevel: "ReadCommitted" });
  }
  async invalidate(id: string, now: Date): Promise<void> {
    await this.prisma.emailVerificationCredential.updateMany({ where: { id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: this.checkedAt(now) } });
  }
  async markDelivered(id: string, supplied: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.emailVerificationCredential.findUnique({ where: { id } });
      if (!candidate) return;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${candidate.userId}::uuid FOR UPDATE`;
      const now = this.checkedAt(supplied);
      await tx.emailVerificationCredential.updateMany({ where: { id, consumedAt: null, invalidatedAt: null, deliveredAt: null, expiresAt: { gt: now } }, data: { deliveredAt: now } });
    }, { isolationLevel: "ReadCommitted" });
  }
  async verify(hash: string, supplied: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.emailVerificationCredential.findUnique({ where: { tokenHash: hash } });
      if (!candidate) return false;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${candidate.userId}::uuid FOR UPDATE`;
      const credential = await tx.emailVerificationCredential.findUnique({ where: { tokenHash: hash } });
      if (!credential || credential.invalidatedAt !== null) return false;
      if (credential.consumedAt !== null) return true;
      const now = this.checkedAt(supplied);
      if (!credential.deliveredAt || credential.expiresAt <= now) return false;
      const user = await tx.user.findUnique({ where: { id: credential.userId } });
      if (!user || user.disabledAt || user.emailVerifiedAt !== null) return false;
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      await tx.emailVerificationCredential.update({ where: { id: credential.id }, data: { consumedAt: now } });
      await tx.emailVerificationCredential.updateMany({ where: { userId: user.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
      return true;
    }, { isolationLevel: "ReadCommitted" });
  }
  private checkedAt(now: Date): Date { return new Date(Math.max(now.getTime(), this.now().getTime())); }
}
