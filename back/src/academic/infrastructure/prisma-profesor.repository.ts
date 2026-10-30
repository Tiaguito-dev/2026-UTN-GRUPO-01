import { ProfesorNotFoundError } from "../application/errors.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { Profesor } from "../domain/profesor.js";
import type { CreateProfesorInput, ProfesorRepository } from "../application/ports/profesor.repository.js";
import type { ProfesorFilters } from "../application/ports/profesor.repository.js";
import { Prisma } from "../../generated/prisma/client.js";
import { registrarEdicionAcademica } from "./registrar-edicion-academica.js";

const combiningMarks = Array.from({ length: 0x70 }, (_, index) => String.fromCodePoint(0x300 + index)).join("");

export class PrismaProfesorRepository implements ProfesorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination, filters: ProfesorFilters = {}): Promise<PaginatedResult<Profesor>> {
    const normalized = Prisma.sql`lower(translate(normalize(p."nombreCompleto", NFD), ${combiningMarks}, ''))`;
    const conditions = [Prisma.sql`p."deletedAt" IS NULL`];
    if (filters.q) {
      const term = filters.q.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
      const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(Prisma.sql`${normalized} LIKE ${pattern}`);
    }
    const where = Prisma.join(conditions, " AND ");
    return this.prisma.$transaction(async (tx) => {
      const [items, counts] = await Promise.all([
        tx.$queryRaw<Profesor[]>(Prisma.sql`SELECT p."id", p."nombreCompleto", p."createdAt", p."deletedAt" FROM "Profesor" p
          WHERE ${where} ORDER BY ${normalized}, p."nombreCompleto", p."id"
          LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`),
        tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total FROM "Profesor" p WHERE ${where}`),
      ]);
      return { items, total: Number(counts[0]!.total), ...pagination };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async findById(id: string): Promise<Profesor | null> {
    return this.prisma.profesor.findFirst({ where: { id, deletedAt: null } });
  }

  async update(id: string, input: Partial<CreateProfesorInput>, actorId?: string): Promise<Profesor> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Profesor" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const current = await tx.profesor.findFirst({ where: { id, deletedAt: null } });
      if (!current) throw new ProfesorNotFoundError();
      const updated = await tx.profesor.update({ where: { id }, data: input });
      if (actorId) await registrarEdicionAcademica(tx, "profesor", id, actorId, current, updated, ["nombreCompleto"]);
      return updated;
    });
  }

  // Sin traducción de P2002: Profesor.nombreCompleto no tiene restricción única (homónimos).
  async create(input: CreateProfesorInput, actorId?: string): Promise<Profesor> {
    return this.prisma.$transaction(async tx => {
      const row = await tx.profesor.create({ data: input });
      if (actorId) await tx.administracionHistorial.create({ data: { entidad: "profesor", entidadId: row.id, actorId, accion: "CREACION", cambios: [] } });
      return row;
    });
  }
}
