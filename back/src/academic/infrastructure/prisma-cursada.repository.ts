import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { Cuatrimestre, Cursada } from "../domain/cursada.js";
import { CursadaAlreadyExistsError } from "../application/errors.js";
import type { CreateCursadaInput, CursadaRepository } from "../application/ports/cursada.repository.js";

export class PrismaCursadaRepository implements CursadaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByMateriaId(materiaId: string, pagination: Pagination): Promise<PaginatedResult<Cursada>> {
    const where = { materiaId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.cursada.findMany({
        where,
        orderBy: [{ anio: "desc" }, { cuatrimestre: "desc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.cursada.count({ where }),
    ]);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findById(id: string): Promise<Cursada | null> {
    return this.prisma.cursada.findFirst({ where: { id, deletedAt: null } });
  }

  async findByPeriodo(materiaId: string, anio: number, cuatrimestre: Cuatrimestre): Promise<Cursada | null> {
    return this.prisma.cursada.findFirst({ where: { materiaId, anio, cuatrimestre, deletedAt: null } });
  }

  async create(input: CreateCursadaInput): Promise<Cursada> {
    try {
      return await this.prisma.cursada.create({ data: input });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new CursadaAlreadyExistsError();
      }
      throw error;
    }
  }
}
