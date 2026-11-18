import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { PublicSubjectRepository } from "../application/ports/public-subject.repository.js";
import { publicFeedbackWhere } from "../../reviews/infrastructure/prisma-feedback-visibility.js";

const publicSubjectFields = { id: true, nombre: true } as const;

export class PrismaPublicSubjectRepository implements PublicSubjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(q: string) {
    // Treat SQL LIKE metacharacters as literal search text.
    const search = q.replace(/[\\%_]/g, "\\$&");
    return this.prisma.materia.findMany({
      where: { deletedAt: null, ...(search ? { nombre: { contains: search, mode: "insensitive" } } : {}) },
      select: publicSubjectFields,
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
      take: 8,
    });
  }

  findRecentExperiences(subjectId: string) {
    return this.prisma.$transaction(async (tx) => {
      const materia = await tx.materia.findFirst({ where: { id: subjectId, deletedAt: null }, select: publicSubjectFields });
      if (!materia) return null;
      const rows = await tx.feedback.findMany({
        where: {
          ...publicFeedbackWhere,
          // Use the current hierarchy instead of the historical snapshot stored in Feedback.
          comision: { activa: true, deletedAt: null, cursada: { materiaId: subjectId, deletedAt: null } },
        },
        select: { id: true, texto: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      });
      return rows.map((row) => ({ ...row, materia }));
    }, { isolationLevel: "RepeatableRead" });
  }
}
