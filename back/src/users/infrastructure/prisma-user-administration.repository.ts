import { z } from "zod";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { UsuarioAdministrativo, UserAdministrationRepository, UserHistoryEntry } from "../domain/user-administration.repository.js";
import { UserAdministrationForbiddenError, UserNotFoundError, UserStateConflictError } from "../domain/errors.js";

const fields = { id: true, email: true, displayName: true, role: true, createdAt: true, disabledAt: true } as const;
const cambiosSchema = z.array(z.object({ campo: z.string(), anterior: z.string().nullable(), nuevo: z.string().nullable() }));

export class PrismaUserAdministrationRepository implements UserAdministrationRepository {
  constructor(private readonly prisma: PrismaService, private readonly now: () => Date = () => new Date()) {}

  async setActive(id: string, activo: boolean, actorId: string): Promise<UsuarioAdministrativo> {
    return this.prisma.$transaction(async (tx) => {
      // Serializa cambios de estado de administradores para impedir bloqueos mutuos y perder el último ADMIN.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(2026070, 1)`;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${id}::uuid, ${actorId}::uuid) ORDER BY "id" FOR UPDATE`;
      const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, disabledAt: true } });
      if (!actor || actor.role !== "ADMIN" || actor.disabledAt !== null) throw new UserAdministrationForbiddenError();
      const current = await tx.user.findUnique({ where: { id }, select: fields });
      if (!current) throw new UserNotFoundError();
      if (!activo && id === actorId) throw new UserStateConflictError("No puede desactivar su propia cuenta. Solicite la operación a otro administrador.");
      if (activo === (current.disabledAt === null)) return current;
      if (!activo && current.role === "ADMIN" && await tx.user.count({ where: { role: "ADMIN", disabledAt: null } }) <= 1) {
        throw new UserStateConflictError("Debe conservar al menos un administrador activo. Active otra cuenta administradora antes de continuar.");
      }
      const changedAt = this.now();
      if (!activo) {
        // Igual que cambios de contraseña: User -> Sessions ordenadas; refresh solo bloquea Session.
        await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "userId" = ${id}::uuid ORDER BY "id" FOR UPDATE`;
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: changedAt } });
        await tx.refreshCredential.updateMany({ where: { session: { userId: id }, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: changedAt } });
        await tx.passwordResetCredential.updateMany({ where: { userId: id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: changedAt } });
        await tx.emailVerificationCredential.updateMany({ where: { userId: id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: changedAt } });
      }
      const updated = await tx.user.update({ where: { id }, data: { disabledAt: activo ? null : changedAt }, select: fields });
      await tx.administracionHistorial.create({ data: { entidad: "usuario", entidadId: id, actorId, accion: activo ? "ACTIVACION" : "DESACTIVACION",
        cambios: [{ campo: "estado", anterior: current.disabledAt ? "INACTIVO" : "ACTIVO", nuevo: activo ? "ACTIVO" : "INACTIVO" }], createdAt: changedAt } });
      return updated;
    }, { isolationLevel: "ReadCommitted" });
  }

  async findHistorial(id: string, pagination: Pagination): Promise<PaginatedResult<UserHistoryEntry>> {
    return this.prisma.$transaction(async (tx) => {
      if (!await tx.user.findUnique({ where: { id }, select: { id: true } })) throw new UserNotFoundError();
      const where = { entidad: "usuario", entidadId: id };
      const [rows, total] = await Promise.all([
        tx.administracionHistorial.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }),
        tx.administracionHistorial.count({ where }),
      ]);
      return { items: rows.map(({ id: entryId, actorId, accion, cambios, createdAt }) => ({ id: entryId, actorId, accion, cambios: cambiosSchema.parse(cambios), createdAt })), total, ...pagination };
    }, { isolationLevel: "RepeatableRead" });
  }
}
