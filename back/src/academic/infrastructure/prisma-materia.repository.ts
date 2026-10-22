import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { AnioCarrera, NivelElectiva, Materia, MateriaCambio, MateriaHistorial } from "../domain/materia.js";
import { resolveNivelElectiva } from "../application/materia-input.js";
import { InvalidAcademicInputError, MateriaAlreadyExistsError, MateriaNotFoundError } from "../application/errors.js";
import type { CreateMateriaInput, MateriaFilters, MateriaRepository } from "../application/ports/materia.repository.js";

export class PrismaMateriaRepository implements MateriaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination, filters: MateriaFilters = {}): Promise<PaginatedResult<Materia>> {
    // PostgreSQL LIKE metacharacters must be escaped for a literal substring search.
    const q = filters.q?.replace(/[\\%_]/g, "\\$&");
    const where: Prisma.MateriaWhereInput = { deletedAt: null,
      ...(filters.anioCarrera ? { anioCarrera: filters.anioCarrera } : {}),
      ...(filters.nivelElectiva ? { nivelElectiva: filters.nivelElectiva } : {}),
      ...(q ? { nombre: { contains: q, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.materia.findMany({
        where,
        orderBy: [{ anioCarrera: { sort: "asc", nulls: "last" } },
          { nivelElectiva: { sort: "asc", nulls: "last" } }, { nombre: "asc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.materia.count({ where }),
    ]);
    return { items: items.map(toMateria), total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findById(id: string): Promise<Materia | null> {
    const materia = await this.prisma.materia.findFirst({ where: { id, deletedAt: null } });
    return materia ? toMateria(materia) : null;
  }

  async findByNombre(nombre: string): Promise<Materia | null> {
    const materia = await this.prisma.materia.findFirst({ where: { nombre, deletedAt: null } });
    return materia ? toMateria(materia) : null;
  }

  async create(input: CreateMateriaInput): Promise<Materia> {
    try {
      return toMateria(await this.prisma.materia.create({ data: input }));
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new MateriaAlreadyExistsError();
      }
      throw error;
    }
  }

  async update(id: string, input: Partial<CreateMateriaInput>, actorId: string): Promise<Materia> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent edits so each history event records the actual previous values.
        await tx.$queryRaw`SELECT "id" FROM "Materia" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const current = await tx.materia.findFirst({ where: { id, deletedAt: null } });
        if (!current) throw new MateriaNotFoundError();
        if (!current.anioCarrera && !input.anioCarrera) {
          throw new InvalidAcademicInputError("Indique un año de carrera entre 1 y 5 o Electiva.");
        }
        const nivelElectiva = resolveNivelElectiva((input.anioCarrera ?? current.anioCarrera) as AnioCarrera | null,
          input.nivelElectiva === undefined ? current.nivelElectiva as NivelElectiva | null : input.nivelElectiva);
        const cambios: MateriaCambio[] = [];
        const data: Partial<CreateMateriaInput> = {};
        if (input.nombre !== undefined && input.nombre !== current.nombre) {
          data.nombre = input.nombre;
          cambios.push({ campo: "nombre", anterior: current.nombre, nuevo: input.nombre });
        }
        if (input.anioCarrera !== undefined && input.anioCarrera !== current.anioCarrera) {
          data.anioCarrera = input.anioCarrera;
          cambios.push({ campo: "anioCarrera", anterior: current.anioCarrera, nuevo: input.anioCarrera });
        }
        if (nivelElectiva !== current.nivelElectiva) {
          data.nivelElectiva = nivelElectiva;
          cambios.push({ campo: "nivelElectiva", anterior: current.nivelElectiva, nuevo: nivelElectiva });
        }
        if (cambios.length === 0) return toMateria(current);
        const updated = await tx.materia.update({ where: { id }, data });
        await tx.materiaHistorial.create({ data: { materiaId: id, actorId,
          cambios: cambios.map((cambio) => ({ ...cambio })) } });
        return toMateria(updated);
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new MateriaAlreadyExistsError();
      throw error;
    }
  }

  async findHistorial(id: string, pagination: Pagination): Promise<PaginatedResult<MateriaHistorial>> {
    const where = { materiaId: id };
    const [rows, total] = await Promise.all([
      this.prisma.materiaHistorial.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }),
      this.prisma.materiaHistorial.count({ where }),
    ]);
    const items = rows.map((row) => ({ ...row, cambios: row.cambios as unknown as MateriaCambio[] }));
    return { items, total, ...pagination };
  }
}

function toMateria(row: { id: string; nombre: string; anioCarrera: string | null; nivelElectiva: string | null; createdAt: Date; deletedAt: Date | null }): Materia {
  return { ...row, anioCarrera: row.anioCarrera as AnioCarrera | null, nivelElectiva: row.nivelElectiva as NivelElectiva | null };
}
