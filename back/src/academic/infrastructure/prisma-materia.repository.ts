import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { Materia } from "../domain/materia.js";
import { MateriaAlreadyExistsError } from "../application/errors.js";
import type { CreateMateriaInput, MateriaRepository } from "../application/ports/materia.repository.js";

export class PrismaMateriaRepository implements MateriaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination): Promise<PaginatedResult<Materia>> {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.materia.findMany({
        where,
        orderBy: { nombre: "asc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.materia.count({ where }),
    ]);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findById(id: string): Promise<Materia | null> {
    return this.prisma.materia.findFirst({ where: { id, deletedAt: null } });
  }

  async findByNombre(nombre: string): Promise<Materia | null> {
    return this.prisma.materia.findFirst({ where: { nombre, deletedAt: null } });
  }

  async create(input: CreateMateriaInput): Promise<Materia> {
    try {
      return await this.prisma.materia.create({ data: input });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new MateriaAlreadyExistsError();
      }
      throw error;
    }
  }
}
