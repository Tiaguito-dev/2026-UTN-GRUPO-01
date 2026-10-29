import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { PaginatedResult, Pagination } from "../../shared/domain/pagination.js";
import { AcademicRelationshipsError, ComisionNotFoundError, CursadaNotFoundError, MateriaNotFoundError, ProfesorNotFoundError } from "../application/errors.js";
import type { AcademicAdministrationRepository, AcademicEntity, AcademicHistoryEntry } from "../application/ports/academic-administration.repository.js";
import { parseAcademicHistoryChanges } from "../application/academic-history.js";

const TABLES: Record<AcademicEntity, string> = { materia: '"Materia"', profesor: '"Profesor"', cursada: '"Cursada"', comision: '"Comision"' };
const NOT_FOUND = { materia: MateriaNotFoundError, profesor: ProfesorNotFoundError, cursada: CursadaNotFoundError, comision: ComisionNotFoundError };

export class PrismaAcademicAdministrationRepository implements AcademicAdministrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async eliminar(entidad: AcademicEntity, id: string, actorId: string): Promise<void> {
    const blocked = await this.prisma.$transaction(async (tx) => {
      // Identificadores SQL provienen exclusivamente de esta tabla cerrada, nunca del input HTTP.
      const current = await tx.$queryRaw<{ id: string; deletedAt: Date | null; activa?: boolean }[]>(Prisma.sql`
        SELECT "id", "deletedAt", ${entidad === "comision" ? Prisma.sql`"activa"` : Prisma.sql`NULL`} AS "activa" FROM ${Prisma.raw(TABLES[entidad])} WHERE "id" = ${id}::uuid FOR UPDATE`);
      if (!current[0] || current[0].deletedAt) throw new NOT_FOUND[entidad]();
      const reason = await this.blockingReason(tx, entidad, id);
      if (reason) {
        await tx.administracionHistorial.create({ data: { entidad, entidadId: id, actorId, accion: "BAJA_BLOQUEADA",
          cambios: [{ campo: "resultado", anterior: null, nuevo: "BLOQUEADA" }, { campo: "motivo", anterior: null, nuevo: reason }] } });
        // El conflicto se comunica después del commit: arrojarlo aquí perdería el intento auditado.
        return reason;
      }
      const deletedAt = new Date();
      switch (entidad) {
        case "materia": await tx.materia.update({ where: { id }, data: { deletedAt } }); break;
        case "profesor": await tx.profesor.update({ where: { id }, data: { deletedAt } }); break;
        case "cursada": await tx.cursada.update({ where: { id }, data: { deletedAt } }); break;
        case "comision": await tx.comision.update({ where: { id }, data: { deletedAt, activa: false } }); break;
      }
      const cambios: {campo: string; anterior: string | null; nuevo: string | null}[] = [{ campo: "deletedAt", anterior: null, nuevo: deletedAt.toISOString() }];
      if (entidad === "comision" && current[0].activa) cambios.push({campo: "activa", anterior: "true", nuevo: "false"});
      const eventId = randomUUID();
      // El historial de campos de Materia mantiene su contrato estricto. El ledger registra el resultado.
      if (entidad === "materia") await tx.materiaHistorial.create({ data: { id: eventId, materiaId: id, actorId, cambios, createdAt: deletedAt } });
      await tx.administracionHistorial.create({ data: { id: eventId, entidad, entidadId: id, actorId, accion: "ELIMINACION",
        cambios: [...cambios, { campo: "resultado", anterior: null, nuevo: "EXITOSA" }], createdAt: deletedAt } });
      return null;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    if (blocked) throw new AcademicRelationshipsError(blocked);
  }

  private async blockingReason(tx: Prisma.TransactionClient, entidad: AcademicEntity, id: string): Promise<string | null> {
    if (entidad === "materia" && await tx.cursada.count({ where: { materiaId: id, deletedAt: null } })) {
      return "No se puede dar de baja la materia porque tiene períodos de cursada vigentes. Solicitá la baja de esos períodos primero.";
    }
    if (entidad === "cursada" && await tx.comision.count({ where: { cursadaId: id, deletedAt: null } })) {
      return "No se puede dar de baja el período porque tiene comisiones vigentes. Solicitá la baja de esas comisiones primero.";
    }
    if (entidad === "profesor" && await tx.comisionProfesor.count({ where: { profesorId: id, comision: { deletedAt: null } } })) {
      return "No se puede dar de baja al profesor porque tiene asignaciones en comisiones vigentes. Quitá esas asignaciones primero; desvincularlo sólo quita la relación con esa comisión.";
    }
    return null;
  }

  async historial(entidad: AcademicEntity, id: string, pagination: Pagination): Promise<PaginatedResult<AcademicHistoryEntry>> {
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM ${Prisma.raw(TABLES[entidad])} WHERE "id" = ${id}::uuid`);
      if (!exists.length) throw new NOT_FOUND[entidad]();
      const where = { entidad, entidadId: id };
      const [entries, total] = await Promise.all([
        tx.administracionHistorial.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }),
        tx.administracionHistorial.count({ where }),
      ]);
      return { items: entries.map((entry) => ({ id: entry.id, actorId: entry.actorId, accion: entry.accion, cambios: parseAcademicHistoryChanges(entry.cambios), createdAt: entry.createdAt })), total, ...pagination };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
