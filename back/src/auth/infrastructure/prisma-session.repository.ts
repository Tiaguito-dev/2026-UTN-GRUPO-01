import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Session } from "../domain/session.js";
import type { SessionRepository } from "../domain/session.repository.js";

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(session: Session): Promise<void> { await this.prisma.session.create({ data: session }); }
  async findById(id: string): Promise<Session | null> { return this.prisma.session.findUnique({ where: { id } }); }
  async findValidById(id: string, now: Date): Promise<Session | null> {
    return this.prisma.session.findFirst({ where: { id, revokedAt: null, expiresAt: { gt: now } } });
  }
}
