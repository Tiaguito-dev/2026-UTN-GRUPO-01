import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import type { SessionActivityRepository, SessionOperation } from "../domain/session-activity.repository.js";
import { sessionExpired, sessionStatus, type SessionStatus } from "../domain/session-lifetime.js";

export class SessionActivity {
  constructor(private readonly sessions: SessionActivityRepository, private readonly idleTtlSeconds = 1800,
    private readonly idleWarningSeconds = 120, private readonly now: () => Date = () => new Date()) {}

  async execute(sessionId: string, userId: string, operation: SessionOperation, input?: unknown): Promise<SessionStatus> {
    if (operation !== "read" && input !== undefined &&
      (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length > 0)) {
      throw new BadRequestException("La solicitud no debe incluir datos de sesión. Intentá nuevamente.");
    }
    const policy = { idleTtlSeconds: this.idleTtlSeconds, idleWarningSeconds: this.idleWarningSeconds };
    const startedAt = this.now();
    const session = await this.sessions.access(sessionId, userId, operation, startedAt, policy);
    const checkedAt = new Date(Math.max(startedAt.getTime(), this.now().getTime()));
    if (!session || session.userId !== userId || sessionExpired(session, checkedAt, this.idleTtlSeconds)) {
      throw new UnauthorizedException("La sesión terminó. Iniciá sesión nuevamente.");
    }
    return sessionStatus(session, checkedAt, policy);
  }
}
