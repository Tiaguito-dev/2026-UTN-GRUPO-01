import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { Comision } from "../domain/comision.js";
import { ComisionAlreadyExistsError } from "../application/errors.js";
import type { ComisionRepository, CreateComisionInput } from "../application/ports/comision.repository.js";

export class PrismaComisionRepository implements ComisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCursadaId(cursadaId: string, pagination: Pagination): Promise<PaginatedResult<Comision>> {
    const where = { cursadaId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.comision.findMany({
        where,
        orderBy: { nombre: "asc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.comision.count({ where }),
    ]);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findByCursadaIdAndNombre(cursadaId: string, nombre: string): Promise<Comision | null> {
    return this.prisma.comision.findFirst({ where: { cursadaId, nombre, deletedAt: null } });
  }

  async create(input: CreateComisionInput): Promise<Comision> {
    try {
      return await this.prisma.comision.create({ data: input });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ComisionAlreadyExistsError();
      }
      throw error;
    }
  }
}
