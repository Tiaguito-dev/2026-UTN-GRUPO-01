import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { validateId } from "../academic/application/academic-id.js";
import { validateMateriaPagination } from "../academic/application/materia-input.js";
import { parseAcademicHistoryChanges } from "../academic/application/academic-history.js";

const entities = { materias: "materia", profesores: "profesor", cursadas: "cursada", comisiones: "comision", users: "usuario", feedback: "feedback" } as const;
const safeFields = new Set(["nombre", "modalidad", "carreras", "nombreCompleto", "materiaId", "anio", "cuatrimestre", "carrera", "numero", "deletedAt", "disabledAt", "activa", "estado", "texto", "anonimo", "profesores", "resultado", "motivo"]);

@Injectable()
export class AdminDetailService {
  constructor(private readonly prisma: PrismaService) {}
  async execute(kind: string, input: unknown, query: unknown) {
    const id = validateId(input);
    const pagination = validateMateriaPagination(query, 3);
    if (!Object.hasOwn(entities, kind)) throw new NotFoundException();
    const entity = entities[kind as keyof typeof entities];
    return this.prisma.$transaction(async tx => {
      const registro = await this.record(tx, kind, id);
      if (!registro) throw new NotFoundException("Registro no encontrado.");
      const where = { entidad: entity, entidadId: id };
      const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];
      const [ledger, creation, edition, deletion] = await Promise.all([
        tx.administracionHistorial.findMany({ where, orderBy, skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }),
        tx.administracionHistorial.findFirst({ where: { ...where, accion: "CREACION" }, orderBy }),
        tx.administracionHistorial.findFirst({ where: { ...where, accion: { notIn: ["CREACION", "BAJA_BLOQUEADA"] } }, orderBy }),
        tx.administracionHistorial.findFirst({ where: { ...where, accion: { in: ["ELIMINACION", "DESACTIVACION"] } }, orderBy }),
      ]);
      let total = await tx.administracionHistorial.count({ where });
      let items = ledger.map(entry => ({ ...entry, cambios: parseAcademicHistoryChanges(entry.cambios).filter(change => safeFields.has(change.campo) || change.campo.startsWith("profesor:")) }));
      let materiaLatest: {actorId: string; createdAt: Date} | null = null;
      if (kind === "materias") {
        const offset = (pagination.page - 1) * pagination.pageSize;
        const rows = await tx.$queryRaw<{id:string;actorId:string;createdAt:Date;accion:string;cambios:Prisma.JsonValue}[]>(Prisma.sql`
          SELECT h."id", h."actorId", h."createdAt", CASE WHEN h."cambios"::text LIKE '%"deletedAt"%' THEN 'ELIMINACION' ELSE 'EDICION' END AS "accion", COALESCE(a."cambios", h."cambios") AS "cambios"
          FROM "MateriaHistorial" h LEFT JOIN "AdministracionHistorial" a ON a."id" = h."id" AND a."entidad" = 'materia' AND a."entidadId" = h."materiaId"
          WHERE h."materiaId" = ${id}::uuid
          UNION ALL
          SELECT "id", "actorId", "createdAt", "accion", "cambios" FROM "AdministracionHistorial"
          WHERE "entidad" = 'materia' AND "entidadId" = ${id}::uuid AND "accion" IN ('CREACION', 'BAJA_BLOQUEADA')
          ORDER BY "createdAt" DESC, "id" DESC LIMIT ${pagination.pageSize} OFFSET ${offset}`);
        total = await tx.materiaHistorial.count({where: {materiaId: id}}) + await tx.administracionHistorial.count({where: {...where, accion: {in: ["CREACION", "BAJA_BLOQUEADA"]}}});
        items = rows.map(row => ({...row, entidad: entity, entidadId: id, cambios: parseAcademicHistoryChanges(row.cambios).filter(change => safeFields.has(change.campo))}));
        materiaLatest = await tx.materiaHistorial.findFirst({where: {materiaId: id}, orderBy, select: {actorId:true,createdAt:true}});
      }
      let history: { id: string; actorId: string | null; accion: string; createdAt: Date; cambios: {campo: string; anterior: string | null; nuevo: string | null}[] }[] = items;
      if (kind === "feedback") {
        const snapshots = await tx.feedbackHistorial.findMany({ where: { feedbackId: id }, orderBy, skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize + 1 });
        const actors = await tx.administracionHistorial.findMany({ where: { ...where, id: { in: snapshots.map(row => row.id) } } });
        history = snapshots.slice(0, pagination.pageSize).map((row, index) => {
          const event = actors.find(entry => entry.id === row.id);
          const previous = snapshots[index + 1];
          return { id: row.id, actorId: event?.actorId ?? null, accion: row.accion, createdAt: row.createdAt,
            cambios: event ? parseAcademicHistoryChanges(event.cambios).filter(change => safeFields.has(change.campo)) : [{ campo: "texto", anterior: previous?.texto ?? null, nuevo: row.texto }, { campo: "anonimo", anterior: previous ? String(previous.anonimo) : null, nuevo: String(row.anonimo) }].filter(change => change.anterior !== change.nuevo) };
        });
        total = await tx.feedbackHistorial.count({ where: { feedbackId: id } });
      }
      const dates = registro as {createdAt: Date; updatedAt?: Date; deletedAt?: Date | null; disabledAt?: Date | null};
      // Only user details resolve names; other administrative contracts remain unchanged.
      const actorIds = kind === "users" ? [...new Set([creation?.actorId, edition?.actorId, deletion?.actorId, ...history.map(entry => entry.actorId)].filter((value): value is string => Boolean(value)))] : [];
      const actors = actorIds.length ? await tx.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, displayName: true } }) : [];
      const names = new Map(actors.map(actor => [actor.id, actor.displayName]));
      const actorName = (actorId: string | null | undefined) => actorId ? names.get(actorId) ?? null : null;
      return { registro, auditoria: { id, createdAt: dates.createdAt, createdBy: creation?.actorId ?? null,
        ...(kind === "users" ? { createdByName: actorName(creation?.actorId), updatedByName: actorName(edition?.actorId), deletedByName: (dates.deletedAt || dates.disabledAt) ? actorName(deletion?.actorId) : null } : {}),
        updatedAt: dates.updatedAt ?? materiaLatest?.createdAt ?? edition?.createdAt ?? null, updatedBy: materiaLatest?.actorId ?? edition?.actorId ?? null,
        deletedAt: dates.deletedAt ?? dates.disabledAt ?? null, deletedBy: (dates.deletedAt || dates.disabledAt) ? deletion?.actorId ?? null : null },
        historial: { items: kind === "users" ? history.map(entry => ({ ...entry, actorName: actorName(entry.actorId) })) : history, total, ...pagination } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  private async record(tx: Prisma.TransactionClient, kind: string, id: string) {
    switch (kind) {
      case "users": return tx.user.findUnique({ where: {id}, select: {id:true,email:true,displayName:true,role:true,createdAt:true,emailVerifiedAt:true,disabledAt:true} });
      case "feedback": return tx.feedback.findUnique({ where: {id}, include: {autor: {select: {id:true,displayName:true}}, comision: {select: {carrera:true}}} });
      case "materias": return tx.materia.findUnique({ where: {id}, include: {carreras:true} });
      case "profesores": return tx.profesor.findUnique({ where: {id} });
      case "cursadas": return tx.cursada.findUnique({ where: {id}, include: {materia: {select: {id:true,nombre:true,modalidad:true}}} });
      case "comisiones": {
        const row = await tx.comision.findUnique({ where: {id}, include: {cursada: {select: {id:true,anio:true,cuatrimestre:true,materia: {select: {id:true,nombre:true,modalidad:true}}}}, profesores: {include: {profesor: {select: {id:true,nombreCompleto:true}}}}} });
        return row ? {...row, nombre: `${row.carrera}-${row.numero}`, profesores: row.profesores.map(link => ({id:link.profesorId,nombreCompleto:link.profesor.nombreCompleto,cargo:link.cargo}))} : null;
      }
      default: throw new NotFoundException();
    }
  }
}
