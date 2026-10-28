import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { Cuatrimestre, Cursada, CursadaResumen } from "../domain/cursada.js";
import { CARRERAS } from "../domain/materia.js";
import { CursadaAlreadyExistsError, CursadaNotFoundError, MateriaNotFoundError, InvalidAcademicInputError } from "../application/errors.js";
import type { CreateCursadaInput, CursadaRepository } from "../application/ports/cursada.repository.js";
import { registrarEdicionAcademica } from "./registrar-edicion-academica.js";

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
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cursada.findMany({
        where,
        include: conResumen,
        orderBy: [{ anio: "desc" }, { cuatrimestre: "desc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.cursada.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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

  async findByPeriodo(materiaId: string, anio: number, cuatrimestre: Cuatrimestre | null): Promise<Cursada | null> {
    return this.prisma.cursada.findFirst({ where: { materiaId, anio, cuatrimestre, deletedAt: null } });
  }

  async update(id: string, input: Partial<CreateCursadaInput>, actorId?: string): Promise<Cursada> {
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Cursada" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const current = await tx.cursada.findFirst({ where: { id, deletedAt: null } });
        if (!current) throw new CursadaNotFoundError();
        const effective = { ...current, ...input };
        // All academic mutations acquire Cursada before ordered Materia locks.
        for (const materiaId of [...new Set([current.materiaId, effective.materiaId])].sort()) {
          await tx.$queryRaw`SELECT "id" FROM "Materia" WHERE "id" = ${materiaId}::uuid FOR SHARE`;
        }
        if (!await tx.materia.findFirst({ where: { id: effective.materiaId, deletedAt: null } })) throw new MateriaNotFoundError();
        const carreras = await tx.materiaCarrera.findMany({ where: { materiaId: effective.materiaId }, select: { carrera: true } });
        if (await tx.comision.count({ where: { cursadaId: id, deletedAt: null, carrera: { notIn: carreras.map(c => c.carrera) } } })) {
          throw new InvalidAcademicInputError("La materia destino no admite las carreras de todas las comisiones de la cursada.");
        }
        const updated = await tx.cursada.update({ where: { id }, data: input });
        if (actorId) await registrarEdicionAcademica(tx, "cursada", id, actorId, current, updated, ["materiaId", "anio", "cuatrimestre"]);
        return updated;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new CursadaAlreadyExistsError();
      throw error;
    }
  }

  async create(input: CreateCursadaInput, actorId?: string): Promise<Cursada> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Materia" WHERE "id" = ${input.materiaId}::uuid FOR SHARE`;
        if (!await tx.materia.findFirst({ where: { id: input.materiaId, deletedAt: null } })) throw new MateriaNotFoundError();
        const row = await tx.cursada.create({ data: input });
        if (actorId) await tx.administracionHistorial.create({ data: { entidad: "cursada", entidadId: row.id, actorId, accion: "CREACION", cambios: [] } });
        return row;
      });
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
    cuatrimestre: cursada.cuatrimestre,
    comisiones: comisiones.length,
    profesores: new Set(comisiones.flatMap((comision) => comision.profesores.map((fila) => fila.profesorId))).size,
    carreras: CARRERAS.filter((carrera) => comisiones.some((comision) => comision.carrera === carrera)),
  };
}
