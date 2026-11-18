import { Prisma } from "../../generated/prisma/client.js";
import { publicFeedbackSql } from "./prisma-feedback-visibility.js";

type Transaction = Prisma.TransactionClient;
export interface VisibleMateriaVote { usuarioId: string; materiaId: string; puntuacion: number }
export interface RatingChange { campo: string; anterior: string | null; nuevo: string | null }

/** Latest content event, not latest moderation/visibility update. One row per author/subject. */
export function visibleMateriaVotesSql(materiaIds?: string[], autorId?: string): Prisma.Sql {
  const filters = [publicFeedbackSql(), Prisma.sql`f."puntuacion" IS NOT NULL`];
  if (materiaIds) filters.push(materiaIds.length
    ? Prisma.sql`f."materiaId" IN (${Prisma.join(materiaIds.map(id => Prisma.sql`${id}::uuid`))})`
    : Prisma.sql`FALSE`);
  if (autorId) filters.push(Prisma.sql`f."autorId" = ${autorId}::uuid`);
  return Prisma.sql`
    SELECT DISTINCT ON (f."autorId", f."materiaId")
      f."autorId" AS "usuarioId", f."materiaId", f."puntuacion"
    FROM "Feedback" f
    LEFT JOIN LATERAL (
      SELECT h."createdAt", h."id" FROM "FeedbackHistorial" h
      WHERE h."feedbackId" = f."id" AND h."accion" IN ('CREACION', 'EDICION')
      ORDER BY h."createdAt" DESC, h."id" DESC LIMIT 1
    ) content ON TRUE
    WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY f."autorId", f."materiaId", COALESCE(content."createdAt", f."createdAt") DESC,
      COALESCE(content."id", f."id") DESC, f."id" DESC`;
}

export async function lockMateriaVote(tx: Transaction, autorId: string, materiaId: string): Promise<void> {
  const key = `${autorId.toLowerCase()}:${materiaId.toLowerCase()}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(2026071, hashtext(${key}))`;
}

/** Caller holds commission/feedback locks, then this pair's advisory lock, until commit. */
export async function syncMateriaVote(tx: Transaction, autorId: string, materiaId: string, now: Date): Promise<RatingChange[]> {
  const [candidate] = await tx.$queryRaw<VisibleMateriaVote[]>(visibleMateriaVotesSql([materiaId], autorId));
  const where = { usuarioId_materiaId: { usuarioId: autorId, materiaId } };
  const previous = await tx.valoracionMateria.findUnique({ where });
  const changes: RatingChange[] = [];
  if (candidate) {
    if (previous?.puntuacion === candidate.puntuacion && previous.deletedAt === null) return changes;
    await tx.valoracionMateria.upsert({ where,
      create: { usuarioId: autorId, materiaId, puntuacion: candidate.puntuacion },
      update: { puntuacion: candidate.puntuacion, deletedAt: null, updatedAt: now },
    });
    if (previous?.puntuacion !== candidate.puntuacion) changes.push({ campo: "valoracionMateria.puntuacion",
      anterior: previous ? String(previous.puntuacion) : null, nuevo: String(candidate.puntuacion) });
    if (previous?.deletedAt) changes.push({ campo: "valoracionMateria.deletedAt", anterior: previous.deletedAt.toISOString(), nuevo: null });
  } else if (previous && previous.deletedAt === null) {
    const retired = await tx.valoracionMateria.updateMany({ where: { usuarioId: autorId, materiaId, deletedAt: null },
      data: { deletedAt: now, updatedAt: now } });
    if (retired.count) changes.push({ campo: "valoracionMateria.deletedAt", anterior: null, nuevo: now.toISOString() });
  }
  return changes;
}
