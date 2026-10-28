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
    await this.prisma.$transaction(async (tx) => {
      // Identificadores SQL provienen exclusivamente de esta tabla cerrada, nunca del input HTTP.
      const current = await tx.$queryRaw<{ id: string; deletedAt: Date | null }[]>(Prisma.sql`
        SELECT "id", "deletedAt" FROM ${Prisma.raw(TABLES[entidad])} WHERE "id" = ${id}::uuid FOR UPDATE`);
      if (!current[0] || current[0].deletedAt) throw new NOT_FOUND[entidad]();
      if (entidad === "materia" && await tx.cursada.count({ where: { materiaId: id, deletedAt: null } })) {
        throw new AcademicRelationshipsError("No se puede eliminar la materia porque tiene cursadas vigentes. Eliminá sus cursadas primero.");
      }
      if (entidad === "cursada" && await tx.comision.count({ where: { cursadaId: id, deletedAt: null } })) {
        throw new AcademicRelationshipsError("No se puede eliminar la cursada porque tiene comisiones vigentes. Eliminá sus comisiones primero.");
      }
      if (entidad === "profesor" && await tx.comisionProfesor.count({ where: { profesorId: id, comision: { deletedAt: null } } })) {
        throw new AcademicRelationshipsError("No se puede eliminar el profesor porque tiene comisiones asignadas. Desvinculalo de esas comisiones primero.");
      }
      const deletedAt = new Date();
      switch (entidad) {
        case "materia": await tx.materia.update({ where: { id }, data: { deletedAt } }); break;
        case "profesor": await tx.profesor.update({ where: { id }, data: { deletedAt } }); break;
        case "cursada": await tx.cursada.update({ where: { id }, data: { deletedAt } }); break;
        case "comision": await tx.comision.update({ where: { id }, data: { deletedAt, activa: false } }); break;
      }
      const cambios = [{ campo: "deletedAt", anterior: null, nuevo: deletedAt.toISOString() }];
      if (entidad === "materia") await tx.materiaHistorial.create({ data: { materiaId: id, actorId, cambios } });
      await tx.administracionHistorial.create({ data: { entidad, entidadId: id, actorId, accion: "ELIMINACION", cambios } });
    });
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
