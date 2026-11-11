import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import { serializarCarreras, type AnioCarrera, type Carrera, type NivelElectiva, type Materia, type MateriaCambio, type MateriaCarrera, type MateriaHistorial } from "../domain/materia.js";
import { CarreraConComisionesError, MateriaAlreadyExistsError, MateriaNotFoundError } from "../application/errors.js";
import type { CreateMateriaInput, MateriaFilters, MateriaRepository } from "../application/ports/materia.repository.js";
import { parseMateriaHistoryChanges } from "../application/academic-history.js";

const conCarreras = { carreras: { orderBy: { carrera: "asc" } } } satisfies Prisma.MateriaInclude;
// NFD separates Spanish accents/diacritics; translate removes the same combining marks on
// both SQL names and the search term, without requiring an extension or changing stored names.
const combiningMarks = Array.from({ length: 0x70 }, (_, index) => String.fromCodePoint(0x300 + index)).join("");
// Must match the unique index of migration 20261107000000_materia_nombre_normalizado; see the
// DATA-01 uniqueness test in tests/academic.integration.spec.ts.
const normalizedNombre = (nombre: Prisma.Sql) => Prisma.sql`lower(translate(normalize(${nombre}, NFD), ${combiningMarks}, ''))`;

export class PrismaMateriaRepository implements MateriaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination, filters: MateriaFilters = {}): Promise<PaginatedResult<Materia>> {
    const nombreNormalizado = normalizedNombre(Prisma.sql`m."nombre"`);
    const predicates: Prisma.Sql[] = [Prisma.sql`m."deletedAt" IS NULL`];
    const associations: Prisma.Sql[] = [];
    if (filters.carrera) associations.push(Prisma.sql`mc."carrera" = ${filters.carrera}::"Carrera"`);
    if (filters.anioCarrera) associations.push(Prisma.sql`mc."anioCarrera" = ${filters.anioCarrera}`);
    if (filters.nivelElectiva) associations.push(Prisma.sql`mc."nivelElectiva" = ${filters.nivelElectiva}`);
    if (associations.length) {
      // EXISTS keeps each subject unique, and all criteria must match the same association.
      predicates.push(Prisma.sql`EXISTS (SELECT 1 FROM "MateriaCarrera" mc
        WHERE mc."materiaId" = m."id" AND ${Prisma.join(associations, " AND ")})`);
    }
    if (filters.q) {
      const term = filters.q.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
      // Escape AFTER normalization: %, _ and backslash must remain literal input.
      const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
      predicates.push(Prisma.sql`${nombreNormalizado} LIKE ${pattern}`);
    }
    const where = Prisma.join(predicates, " AND ");
    const skip = (pagination.page - 1) * pagination.pageSize;
    return this.prisma.$transaction(async (tx) => {
      const [ids, counts] = await Promise.all([
        tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT m."id" FROM "Materia" m
          WHERE ${where} ORDER BY ${nombreNormalizado}, m."nombre", m."id"
          LIMIT ${pagination.pageSize} OFFSET ${skip}`),
        tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total FROM "Materia" m WHERE ${where}`),
      ]);
      // Hydrate only the requested page, retaining every career association for detail/grouping.
      const rows = ids.length ? await tx.materia.findMany({
        where: { id: { in: ids.map(({ id }) => id) } }, include: conCarreras,
      }) : [];
      const byId = new Map(rows.map((row) => [row.id, row]));
      return { items: ids.map(({ id }) => toMateria(byId.get(id)!)), total: Number(counts[0]!.total), ...pagination };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async findById(id: string): Promise<Materia | null> {
    const materia = await this.prisma.materia.findFirst({ where: { id, deletedAt: null }, include: conCarreras });
    return materia ? toMateria(materia) : null;
  }

  async findByNombre(nombre: string): Promise<Materia | null> {
    const [match] = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "Materia"
      WHERE "deletedAt" IS NULL AND ${normalizedNombre(Prisma.sql`"nombre"`)} = ${normalizedNombre(Prisma.sql`${nombre}`)} LIMIT 1`);
    return match ? this.findById(match.id) : null;
  }

  async findCarreras(materiaId: string): Promise<Carrera[]> {
    const filas = await this.prisma.materiaCarrera.findMany({ where: { materiaId }, select: { carrera: true } });
    return filas.map((fila) => fila.carrera);
  }

  async create({ carreras, ...input }: CreateMateriaInput, actorId?: string): Promise<Materia> {
    try {
      return await this.prisma.$transaction(async tx => {
        const row = await tx.materia.create({ data: { ...input, carreras: { create: carreras } }, include: conCarreras });
        if (actorId) await tx.administracionHistorial.create({ data: { entidad: "materia", entidadId: row.id, actorId, accion: "CREACION", cambios: [] } });
        return toMateria(row);
      });
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
        if (input.modalidad !== undefined && input.modalidad !== current.modalidad) {
          data.modalidad = input.modalidad;
          cambios.push({ campo: "modalidad", anterior: current.modalidad, nuevo: input.modalidad });
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
    if (!await this.prisma.materia.findUnique({ where: { id }, select: { id: true } })) throw new MateriaNotFoundError();
    const where = { materiaId: id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.materiaHistorial.findMany({
        where,
        include: { actor: { select: { id: true, displayName: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.materiaHistorial.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const items = rows.map((row) => ({
      id: row.id,
      materiaId: row.materiaId,
      actor: row.actor,
      createdAt: row.createdAt,
      cambios: parseMateriaHistoryChanges(row.cambios),
    }));
    return { items, total, ...pagination };
  }
}

function toMateria(row: Prisma.MateriaGetPayload<{ include: typeof conCarreras }>): Materia {
  return { id: row.id, nombre: row.nombre, modalidad: row.modalidad, carreras: row.carreras.map(toMateriaCarrera),
    createdAt: row.createdAt, deletedAt: row.deletedAt };
}

function toMateriaCarrera(row: { carrera: Carrera; anioCarrera: string; nivelElectiva: string | null }): MateriaCarrera {
  return { carrera: row.carrera, anioCarrera: row.anioCarrera as AnioCarrera, nivelElectiva: row.nivelElectiva as NivelElectiva | null };
}
