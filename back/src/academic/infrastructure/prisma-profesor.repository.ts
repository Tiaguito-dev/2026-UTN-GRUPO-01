import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { Profesor } from "../domain/profesor.js";
import type { CreateProfesorInput, ProfesorRepository } from "../application/ports/profesor.repository.js";

export class PrismaProfesorRepository implements ProfesorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination): Promise<PaginatedResult<Profesor>> {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.profesor.findMany({
        where,
        orderBy: { nombreCompleto: "asc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.profesor.count({ where }),
    ]);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findById(id: string): Promise<Profesor | null> {
    return this.prisma.profesor.findFirst({ where: { id, deletedAt: null } });
  }

  // Sin traducción de P2002: Profesor.nombreCompleto no tiene restricción única (homónimos).
  async create(input: CreateProfesorInput): Promise<Profesor> {
    return this.prisma.profesor.create({ data: input });
  }
}
