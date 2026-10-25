import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { Cuatrimestre, Cursada, CursadaResumen } from "../domain/cursada.js";
import { CARRERAS } from "../domain/materia.js";
import { CursadaAlreadyExistsError } from "../application/errors.js";
import type { CreateCursadaInput, CursadaRepository } from "../application/ports/cursada.repository.js";

// Solo para contar: comisiones activas y no borradas, con sus profesores no borrados.
const conResumen = {
  comisiones: {
    where: { activa: true, deletedAt: null },
    select: { carrera: true, profesores: { where: { profesor: { deletedAt: null } }, select: { profesorId: true } } },
  },
} satisfies Prisma.CursadaInclude;

export class PrismaCursadaRepository implements CursadaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByMateriaId(materiaId: string, pagination: Pagination): Promise<PaginatedResult<CursadaResumen>> {
    const where = { materiaId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.cursada.findMany({
        where,
        include: conResumen,
        orderBy: [{ anio: "desc" }, { cuatrimestre: "desc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.cursada.count({ where }),
    ]);
    return {
      items: items.map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- descarta materiaId, no viaja en el resumen paginado
        const { materiaId: _, ...resumen } = toResumen(item);
        return resumen;
      }),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async findById(id: string): Promise<(CursadaResumen & { materiaId: string }) | null> {
    const row = await this.prisma.cursada.findFirst({ where: { id, deletedAt: null }, include: conResumen });
    return row ? toResumen(row) : null;
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

function toResumen({ comisiones, ...cursada }: Prisma.CursadaGetPayload<{ include: typeof conResumen }>): CursadaResumen & { materiaId: string } {
  return {
    id: cursada.id,
    materiaId: cursada.materiaId,
    anio: cursada.anio,
    cuatrimestre: cursada.cuatrimestre as Cuatrimestre,
    comisiones: comisiones.length,
    profesores: new Set(comisiones.flatMap((comision) => comision.profesores.map((fila) => fila.profesorId))).size,
    carreras: CARRERAS.filter((carrera) => comisiones.some((comision) => comision.carrera === carrera)),
  };
}
