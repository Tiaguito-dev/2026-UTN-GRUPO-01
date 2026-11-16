import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { FilaValoracion } from "../domain/ranking.js";
import type { RankingRepository } from "../application/ports/ranking.repository.js";

type Row = Omit<FilaValoracion, "suma" | "cantidad"> & { suma: bigint; cantidad: bigint };

export class PrismaRankingRepository implements RankingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async filasValoracion(): Promise<FilaValoracion[]> {
    // One row per commission and professor (NULL when the vote names none). A deleted professor
    // falls into the NULL group: the vote still counts for its commission. No author columns leave SQL.
    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT c."id" AS "comisionId", c."carrera"::text || '-' || c."numero" AS "comisionNombre",
        c."carrera"::text AS "carrera", c."activa", m."id" AS "materiaId", m."nombre" AS "materiaNombre",
        cu."id" AS "cursadaId", cu."anio", cu."cuatrimestre"::text AS "cuatrimestre",
        p."id" AS "profesorId", p."nombreCompleto" AS "profesorNombre", cp."cargo"::text AS "cargo",
        SUM(f."puntuacion") AS "suma", COUNT(*) AS "cantidad"
      FROM "Feedback" f
      JOIN "Comision" c ON c."id" = f."comisionId"
      JOIN "Cursada" cu ON cu."id" = c."cursadaId"
      JOIN "Materia" m ON m."id" = cu."materiaId"
      LEFT JOIN "Profesor" p ON p."id" = f."profesorId" AND p."deletedAt" IS NULL
      LEFT JOIN "ComisionProfesor" cp ON cp."comisionId" = c."id" AND cp."profesorId" = p."id"
      WHERE f."deletedAt" IS NULL AND f."puntuacion" IS NOT NULL
        AND c."deletedAt" IS NULL AND cu."deletedAt" IS NULL AND m."deletedAt" IS NULL
      GROUP BY c."id", m."id", cu."id", p."id", cp."cargo"`);
    return rows.map(row => ({ ...row, suma: Number(row.suma), cantidad: Number(row.cantidad) }));
  }

  profesores() {
    return this.prisma.profesor.findMany({ where: { deletedAt: null }, select: { id: true, nombreCompleto: true } });
  }
}
