import { Prisma, type FeedbackReporte, type Feedback } from "../../generated/prisma/client.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination } from "../../shared/domain/pagination.js";
import type { FeedbackReporteRepository } from "../application/ports/feedback-reporte.repository.js";
import type { CreateFeedbackReporteInput, ResolveFeedbackReporteInput, FeedbackReporteQuery } from "../application/feedback-reporte-input.js";
import { FeedbackReporteError } from "../application/feedback-reporte.service.js";
import { FeedbackNotFoundError } from "../application/errors.js";
import { isFeedbackVisible } from "../domain/feedback-visibility.js";
import type { FeedbackReporteReceipt, FeedbackReporteAdmin, ReporteExperience, ReporteCounts } from "../domain/feedback-reporte.js";

type Transaction = Prisma.TransactionClient;
const receipt = (row: FeedbackReporte): FeedbackReporteReceipt => ({
  id: row.id, feedbackId: row.feedbackId, versionReportada: row.versionReportada,
  motivo: row.motivo, descripcion: row.descripcion, estado: row.estado, createdAt: row.createdAt, resolvedAt: row.resolvedAt,
});
const admin = (row: FeedbackReporte): FeedbackReporteAdmin => ({ ...receipt(row), denuncianteId: row.denuncianteId,
  historialId: row.historialId, administradorId: row.administradorId, justificacion: row.justificacion });
const experience = (row: Feedback & { comision: { carrera: "S" | "C" | "Q" | "I" | "M" } }): ReporteExperience => ({
  id: row.id, deletedAt: row.deletedAt, estadoModeracion: row.estadoModeracion, versionModeracion: row.versionModeracion,
  requiereRevisionHumana: row.requiereRevisionHumana, motivoRechazo: row.motivoRechazo,
  ocultoAutor: row.ocultoAutor, ocultoAdministracion: row.ocultoAdministracion, ocultoReportes: row.ocultoReportes,
  contexto: { carrera: row.comision.carrera, comisionId: row.comisionId, nombre: row.comisionNombre,
    materiaId: row.materiaId, materiaNombre: row.materiaNombre, cursadaId: row.cursadaId, anio: row.anio,
    modalidad: row.modalidad, cuatrimestre: row.cuatrimestre },
});
const recent = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.FeedbackReporteOrderByWithRelationInput[];
const paging = ({ page, pageSize }: Pagination) => ({ skip: (page - 1) * pageSize, take: pageSize });
const feedbackInclude = { comision: { select: { carrera: true } } } as const;

/** Reliable across versions. For threshold decisions caller MUST hold the Feedback lock. */
export async function countFeedbackReportesAbiertos(tx: Transaction, feedbackId: string) {
  return (await reportCounts(tx, [feedbackId])).get(feedbackId) ?? { cantidadReportesActivos: 0, denunciantesAbiertos: 0 };
}
async function reportCounts(tx: Transaction, ids: string[]) {
  const result = new Map<string, ReporteCounts>();
  if (!ids.length) return result;
  const rows = await tx.$queryRaw<{ feedbackId: string; cantidad: bigint; denunciantes: bigint }[]>`
    SELECT "feedbackId", COUNT(*) AS cantidad, COUNT(DISTINCT "denuncianteId") AS denunciantes
    FROM "FeedbackReporte" WHERE "feedbackId" IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
      AND "estado" = 'ABIERTO' GROUP BY "feedbackId"`;
  for (const row of rows) result.set(row.feedbackId, { cantidadReportesActivos: Number(row.cantidad), denunciantesAbiertos: Number(row.denunciantes) });
  return result;
}

export class PrismaFeedbackReporteRepository implements FeedbackReporteRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async lockFeedback(tx: Transaction, id: string, comisionId: string) {
    await tx.$queryRaw`SELECT "id" FROM "Comision" WHERE "id" = ${comisionId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Feedback" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const row = await tx.feedback.findUnique({ where: { id } });
    if (!row || row.comisionId !== comisionId) throw new FeedbackNotFoundError();
    return row;
  }

  async create(id: string, viewer: string, input: CreateFeedbackReporteInput) {
    const original = await this.prisma.feedback.findUnique({ where: { id }, select: { comisionId: true } });
    if (!original) throw new FeedbackNotFoundError();
    return this.prisma.$transaction(async tx => {
      // Serialize each reporter's sliding window across ALL feedback and processes.
      // Disjoint advisory key namespace; no User row locks and no rating locks.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`feedbackReporte:${viewer}`}, 0))::text`;
      const row = await this.lockFeedback(tx, id, original.comisionId);
      if (!isFeedbackVisible(row)) throw new FeedbackNotFoundError();
      if (row.autorId === viewer) throw new FeedbackReporteError(403, "No puede reportar su propia experiencia.");
      const previous = await tx.feedbackReporte.findUnique({ where: {
        denuncianteId_feedbackId_versionReportada: { denuncianteId: viewer, feedbackId: id, versionReportada: row.versionModeracion },
      } });
      if (previous) {
        if (previous.motivo !== input.motivo || previous.descripcion !== (input.descripcion ?? null)) {
          throw new FeedbackReporteError(409, "Ya reportó esta versión con otros datos. Consulte el reporte existente.");
        }
        return { created: false, reporte: receipt(previous) };
      }
      // clock_timestamp is evaluated after waiting for locks (transaction now() is too early).
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const now = clock!.now;
      const count = await tx.feedbackReporte.count({ where: { denuncianteId: viewer, createdAt: { gt: new Date(now.getTime() - 600_000) } } });
      if (count >= 5) throw new FeedbackReporteError(429, "Alcanzó el máximo de cinco reportes en diez minutos. Espere e intente nuevamente.");
      // Every content writer already persists an immutable snapshot. An explicit FK anchors
      // exact content even for legacy snapshots lacking moderation version metadata.
      const snapshot = await tx.feedbackHistorial.findFirst({ where: { feedbackId: id, texto: row.texto,
        puntuacion: row.puntuacion, anonimo: row.anonimo }, orderBy: recent });
      if (!snapshot) throw new FeedbackReporteError(409, "No pudimos recuperar la evidencia de esta experiencia. Intente nuevamente.");
      const reporte = await tx.feedbackReporte.create({ data: { feedbackId: id, denuncianteId: viewer,
        versionReportada: row.versionModeracion, historialId: snapshot.id, motivo: input.motivo,
        descripcion: input.descripcion ?? null, createdAt: now } });
      await tx.administracionHistorial.create({ data: { entidad: "feedbackReporte", entidadId: reporte.id,
        actorId: viewer, accion: "CREACION", createdAt: now, cambios: [
          { campo: "feedbackId", anterior: null, nuevo: id },
          { campo: "versionReportada", anterior: null, nuevo: String(row.versionModeracion) },
          { campo: "historialId", anterior: null, nuevo: snapshot.id },
          { campo: "motivo", anterior: null, nuevo: input.motivo },
          { campo: "descripcion", anterior: null, nuevo: input.descripcion ?? null },
          { campo: "estado", anterior: null, nuevo: "ABIERTO" },
        ] } });
      return { created: true, reporte: receipt(reporte) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async list(query: FeedbackReporteQuery) {
    return this.prisma.$transaction(async tx => {
      const where: Prisma.FeedbackReporteWhereInput = {
        ...(query.estado ? { estado: query.estado } : {}), ...(query.motivo ? { motivo: query.motivo } : {}),
        ...(query.feedbackId ? { feedbackId: query.feedbackId } : {}),
      };
      const total = await tx.feedbackReporte.count({ where });
      const rows = await tx.feedbackReporte.findMany({ where, ...paging(query), orderBy: recent,
        include: { feedback: { include: feedbackInclude } } });
      const counts = await reportCounts(tx, [...new Set(rows.map(row => row.feedbackId))]);
      return { total, page: query.page, pageSize: query.pageSize,
        items: rows.map(row => ({ ...admin(row), experiencia: experience(row.feedback),
          ...(counts.get(row.feedbackId) ?? { cantidadReportesActivos: 0, denunciantesAbiertos: 0 }) })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async get(id: string, query: Pagination) {
    return this.prisma.$transaction(async tx => {
      const row = await tx.feedbackReporte.findUnique({ where: { id }, include: {
        historial: true, feedback: { include: feedbackInclude },
        // Same safe identity projection as administrative audit actors; never load credentials.
        denunciante: { select: { id: true, displayName: true } },
      } });
      if (!row) throw new FeedbackReporteError(404, "El reporte solicitado no existe.");
      const where: Prisma.FeedbackReporteWhereInput = { feedbackId: row.feedbackId, estado: { not: "ABIERTO" }, id: { not: id } };
      const total = await tx.feedbackReporte.count({ where });
      const previous = await tx.feedbackReporte.findMany({ where, ...paging(query), orderBy: [{ resolvedAt: "desc" }, { id: "desc" }] });
      return { reporte: { ...admin(row), denunciante: { id: row.denunciante.id, displayName: row.denunciante.displayName } },
        experiencia: experience(row.feedback), ...await countFeedbackReportesAbiertos(tx, row.feedbackId),
        evidencia: { id: row.historial.id, texto: row.historial.texto, puntuacion: row.historial.puntuacion, anonimo: row.historial.anonimo,
          versionModeracion: row.historial.versionModeracion, createdAt: row.historial.createdAt },
        resolucionesAnteriores: { total, page: query.page, pageSize: query.pageSize, items: previous.map(admin) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async resolve(id: string, actor: { id: string; role: "ADMIN" | "USER" }, input: ResolveFeedbackReporteInput) {
    if (actor.role !== "ADMIN") throw new FeedbackReporteError(403, "Se requiere acceso administrativo.");
    const original = await this.prisma.feedbackReporte.findUnique({ where: { id }, select: { feedbackId: true, feedback: { select: { comisionId: true } } } });
    if (!original) throw new FeedbackReporteError(404, "El reporte solicitado no existe.");
    return this.prisma.$transaction(async tx => {
      await this.lockFeedback(tx, original.feedbackId, original.feedback.comisionId);
      await tx.$queryRaw`SELECT "id" FROM "FeedbackReporte" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const row = await tx.feedbackReporte.findUniqueOrThrow({ where: { id } });
      if (row.estado !== "ABIERTO") throw new FeedbackReporteError(409, "El reporte ya fue cerrado. Actualice la información.");
      // Recheck active ADMIN in the mutation transaction without changing auth infrastructure.
      const administrator = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, disabledAt: true } });
      if (!administrator || administrator.role !== "ADMIN" || administrator.disabledAt !== null) throw new FeedbackReporteError(403, "Se requiere acceso administrativo vigente.");
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const now = clock!.now;
      const updated = await tx.feedbackReporte.update({ where: { id }, data: { estado: input.estado, resolvedAt: now, administradorId: actor.id, justificacion: input.motivo } });
      await tx.administracionHistorial.create({ data: { entidad: "feedbackReporte", entidadId: id, actorId: actor.id,
        accion: input.estado === "RESUELTO" ? "RESOLUCION" : "DESESTIMACION", createdAt: now, cambios: [
          { campo: "estado", anterior: "ABIERTO", nuevo: input.estado },
          { campo: "justificacion", anterior: null, nuevo: input.motivo },
          { campo: "administradorId", anterior: null, nuevo: actor.id },
          { campo: "resolvedAt", anterior: null, nuevo: now.toISOString() },
        ] } });
      return admin(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
