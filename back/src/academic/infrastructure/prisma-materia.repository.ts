import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import { serializarCarreras, type AnioCarrera, type Carrera, type NivelElectiva, type Materia, type MateriaCambio, type MateriaCarrera, type MateriaHistorial } from "../domain/materia.js";
import { CarreraConComisionesError, MateriaAlreadyExistsError, MateriaNotFoundError } from "../application/errors.js";
import type { CreateMateriaInput, MateriaFilters, MateriaRepository } from "../application/ports/materia.repository.js";

const conCarreras = { carreras: { orderBy: { carrera: "asc" } } } satisfies Prisma.MateriaInclude;

export class PrismaMateriaRepository implements MateriaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination, filters: MateriaFilters = {}): Promise<PaginatedResult<Materia>> {
    // PostgreSQL LIKE metacharacters must be escaped for a literal substring search.
    const q = filters.q?.replace(/[\\%_]/g, "\\$&");
    const nombre: Prisma.StringFilter | undefined = q ? { contains: q, mode: "insensitive" } : undefined;
    const skip = (pagination.page - 1) * pagination.pageSize;
    if (filters.carrera) {
      const where: Prisma.MateriaCarreraWhereInput = { carrera: filters.carrera,
        ...(filters.anioCarrera ? { anioCarrera: filters.anioCarrera } : {}),
        ...(filters.nivelElectiva ? { nivelElectiva: filters.nivelElectiva } : {}),
        materia: { deletedAt: null, ...(nombre ? { nombre } : {}) },
      };
      const [filas, total] = await Promise.all([
        this.prisma.materiaCarrera.findMany({
          where,
          include: { materia: { include: conCarreras } },
          orderBy: [{ anioCarrera: "asc" }, { nivelElectiva: { sort: "asc", nulls: "last" } },
            { materia: { nombre: "asc" } }, { materiaId: "asc" }],
          skip,
          take: pagination.pageSize,
        }),
        this.prisma.materiaCarrera.count({ where }),
      ]);
      return { items: filas.map((fila) => toMateria(fila.materia)), total, page: pagination.page, pageSize: pagination.pageSize };
    }
    const where: Prisma.MateriaWhereInput = { deletedAt: null,
      ...(nombre ? { nombre } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.materia.findMany({
        where,
        include: conCarreras,
        orderBy: [{ nombre: "asc" }, { id: "asc" }],
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.materia.count({ where }),
    ]);
    return { items: items.map(toMateria), total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findById(id: string): Promise<Materia | null> {
    const materia = await this.prisma.materia.findFirst({ where: { id, deletedAt: null }, include: conCarreras });
    return materia ? toMateria(materia) : null;
  }

  async findByNombre(nombre: string): Promise<Materia | null> {
    const materia = await this.prisma.materia.findFirst({ where: { nombre, deletedAt: null }, include: conCarreras });
    return materia ? toMateria(materia) : null;
  }

  async findCarreras(materiaId: string): Promise<Carrera[]> {
    const filas = await this.prisma.materiaCarrera.findMany({ where: { materiaId }, select: { carrera: true } });
    return filas.map((fila) => fila.carrera);
  }

  async create({ carreras, ...input }: CreateMateriaInput): Promise<Materia> {
    try {
      return toMateria(await this.prisma.materia.create({ data: { ...input, carreras: { create: carreras } }, include: conCarreras }));
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
        const current = await tx.materia.findFirst({ where: { id, deletedAt: null }, include: conCarreras });
        if (!current) throw new MateriaNotFoundError();
        if (input.carreras) {
          const carreras = input.carreras.map(fila => fila.carrera);
          if (await tx.comision.count({ where: { deletedAt: null, cursada: { materiaId: id }, carrera: { notIn: carreras } } })) {
            throw new CarreraConComisionesError();
          }
        }
        const cambios: MateriaCambio[] = [];
        const data: Prisma.MateriaUpdateInput = {};
        if (input.nombre !== undefined && input.nombre !== current.nombre) {
          data.nombre = input.nombre;
          cambios.push({ campo: "nombre", anterior: current.nombre, nuevo: input.nombre });
        }
        let reemplazarCarreras = false;
        if (input.carreras) {
          const anterior = serializarCarreras(current.carreras.map(toMateriaCarrera));
          const nuevo = serializarCarreras(input.carreras);
          if (anterior !== nuevo) {
            reemplazarCarreras = true;
            cambios.push({ campo: "carreras", anterior: anterior || null, nuevo });
          }
        }
        if (cambios.length === 0 && Object.keys(data).length === 0) return toMateria(current);
        const updated = Object.keys(data).length > 0
          ? await tx.materia.update({ where: { id }, data })
          : current;
        if (reemplazarCarreras && input.carreras) {
          await tx.materiaCarrera.deleteMany({ where: { materiaId: id } });
          await tx.materiaCarrera.createMany({ data: input.carreras.map((fila) => ({ materiaId: id, ...fila })) });
        }
        if (cambios.length > 0) {
          await tx.materiaHistorial.create({ data: { materiaId: id, actorId,
            cambios: cambios.map((cambio) => ({ ...cambio })) } });
        }
        return toMateria({ ...updated, carreras: await tx.materiaCarrera.findMany({ where: { materiaId: id }, ...conCarreras.carreras }) });
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new MateriaAlreadyExistsError();
      throw error;
    }
  }

  async findHistorial(id: string, pagination: Pagination): Promise<PaginatedResult<MateriaHistorial>> {
    const where = { materiaId: id };
    const [rows, total] = await Promise.all([
      this.prisma.materiaHistorial.findMany({
        where,
        include: { actor: { select: { id: true, displayName: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.materiaHistorial.count({ where }),
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      materiaId: row.materiaId,
      actor: row.actor,
      createdAt: row.createdAt,
      cambios: row.cambios as unknown as MateriaCambio[],
    }));
    return { items, total, ...pagination };
  }
}

function toMateria(row: Prisma.MateriaGetPayload<{ include: typeof conCarreras }>): Materia {
  return { id: row.id, nombre: row.nombre, carreras: row.carreras.map(toMateriaCarrera),
    createdAt: row.createdAt, deletedAt: row.deletedAt };
}

function toMateriaCarrera(row: { carrera: Carrera; anioCarrera: string; nivelElectiva: string | null }): MateriaCarrera {
  return { carrera: row.carrera, anioCarrera: row.anioCarrera as AnioCarrera, nivelElectiva: row.nivelElectiva as NivelElectiva | null };
}
