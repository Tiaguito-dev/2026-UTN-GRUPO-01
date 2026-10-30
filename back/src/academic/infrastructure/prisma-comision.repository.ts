import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { CargoDocente, Comision, ComisionDetalle } from "../domain/comision.js";
import type { Carrera } from "../domain/materia.js";
import { ComisionAlreadyExistsError, ComisionNotFoundError, CursadaNotFoundError, MateriaNotFoundError, InvalidAcademicInputError, ProfesorNotFoundError } from "../application/errors.js";
import type { ComisionRepository, CreateComisionInput } from "../application/ports/comision.repository.js";
import { registrarEdicionAcademica } from "./registrar-edicion-academica.js";

const conProfesores = {
  profesores: {
    where: { profesor: { deletedAt: null } },
    include: { profesor: { select: { nombreCompleto: true } } },
    orderBy: [{ cargo: "asc" }, { profesor: { nombreCompleto: "asc" } }, { profesorId: "asc" }],
  },
} satisfies Prisma.ComisionInclude;

type ComisionRow = Prisma.ComisionGetPayload<{ include: typeof conProfesores }>;

export class PrismaComisionRepository implements ComisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCursadaId(cursadaId: string, pagination: Pagination, carrera?: Carrera): Promise<PaginatedResult<Comision>> {
    const where = { cursadaId, deletedAt: null, ...(carrera ? { carrera } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.comision.findMany({
        where,
        include: conProfesores,
        orderBy: [{ carrera: "asc" }, { numero: "asc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.comision.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: items.map(toComision), total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async findByCursadaIdCarreraNumero(cursadaId: string, carrera: Carrera, numero: number): Promise<Comision | null> {
    const row = await this.prisma.comision.findFirst({ where: { cursadaId, carrera, numero, deletedAt: null }, include: conProfesores });
    return row ? toComision(row) : null;
  }

  async findById(id: string): Promise<Comision | null> {
    const row = await this.prisma.comision.findFirst({ where: { id, deletedAt: null }, include: conProfesores });
    return row ? toComision(row) : null;
  }

  async findDetalleById(id: string): Promise<ComisionDetalle | null> {
    const row = await this.prisma.comision.findFirst({
      where: { id, deletedAt: null, cursada: { deletedAt: null, materia: { deletedAt: null } } },
      include: { ...conProfesores, cursada: { select: { id: true, anio: true, cuatrimestre: true, materia: { select: { id: true, nombre: true, modalidad: true } } } } },
    });
    return row ? { ...toComision(row), cursada: row.cursada } : null;
  }

  async existsByMateriaAndCarrera(materiaId: string, carrera: Carrera): Promise<boolean> {
    return (await this.prisma.comision.count({ where: { carrera, deletedAt: null, cursada: { materiaId } } })) > 0;
  }

  async asignarProfesor(comisionId: string, profesorId: string, cargo: CargoDocente, actorId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Baja de comisión y baja de profesor toman respectivamente estos mismos bloqueos.
      await tx.$queryRaw`SELECT "id" FROM "Comision" WHERE "id" = ${comisionId}::uuid FOR UPDATE`;
      if (!await tx.comision.findFirst({ where: { id: comisionId, deletedAt: null } })) throw new ComisionNotFoundError();
      await tx.$queryRaw`SELECT "id" FROM "Profesor" WHERE "id" = ${profesorId}::uuid FOR SHARE`;
      if (!await tx.profesor.findFirst({ where: { id: profesorId, deletedAt: null } })) throw new ProfesorNotFoundError();
      const before = await tx.comisionProfesor.findUnique({ where: { comisionId_profesorId: { comisionId, profesorId } } });
      await tx.comisionProfesor.upsert({
        where: { comisionId_profesorId: { comisionId, profesorId } },
        create: { comisionId, profesorId, cargo },
        update: { cargo },
      });
      if (actorId && before?.cargo !== cargo) await tx.administracionHistorial.create({ data: { entidad: "comision", entidadId: comisionId, actorId, accion: before ? "EDICION" : "VINCULACION", cambios: [{ campo: `profesor:${profesorId}`, anterior: before?.cargo ?? null, nuevo: cargo }] } });
    });
  }

  async quitarProfesor(comisionId: string, profesorId: string, actorId?: string): Promise<boolean> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Comision" WHERE "id" = ${comisionId}::uuid FOR UPDATE`;
      if (!await tx.comision.findFirst({ where: { id: comisionId, deletedAt: null } })) throw new ComisionNotFoundError();
      const before = await tx.comisionProfesor.findUnique({ where: { comisionId_profesorId: { comisionId, profesorId } } });
      if (!before) return false;
      await tx.comisionProfesor.delete({ where: { comisionId_profesorId: { comisionId, profesorId } } });
      if (actorId) await tx.administracionHistorial.create({ data: { entidad: "comision", entidadId: comisionId, actorId, accion: "DESVINCULACION", cambios: [{ campo: `profesor:${profesorId}`, anterior: before.cargo, nuevo: null }] } });
      return true;
    });
  }

  async update(id: string, input: Partial<Pick<CreateComisionInput, "carrera" | "numero">>, actorId?: string): Promise<Comision> {
    try {
      return await this.prisma.$transaction(async tx => {
        const candidate = await tx.comision.findFirst({ where: { id, deletedAt: null } });
        if (!candidate) throw new ComisionNotFoundError();
        await this.lockContext(tx, candidate.cursadaId);
        await tx.$queryRaw`SELECT "id" FROM "Comision" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const current = await tx.comision.findFirst({ where: { id, deletedAt: null } });
        if (!current) throw new ComisionNotFoundError();
        await this.validateCarrera(tx, current.cursadaId, input.carrera ?? current.carrera);
        const updated = await tx.comision.update({ where: { id }, data: input, include: conProfesores });
        if (actorId) await registrarEdicionAcademica(tx, "comision", id, actorId, current, updated, ["carrera", "numero"]);
        return toComision(updated);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ComisionAlreadyExistsError();
      throw error;
    }
  }

  private async lockContext(tx: Prisma.TransactionClient, cursadaId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "Cursada" WHERE "id" = ${cursadaId}::uuid FOR UPDATE`;
    const cursada = await tx.cursada.findFirst({ where: { id: cursadaId, deletedAt: null } });
    if (!cursada) throw new CursadaNotFoundError();
    await tx.$queryRaw`SELECT "id" FROM "Materia" WHERE "id" = ${cursada.materiaId}::uuid FOR SHARE`;
    if (!await tx.materia.findFirst({ where: { id: cursada.materiaId, deletedAt: null } })) throw new MateriaNotFoundError();
  }

  private async validateCarrera(tx: Prisma.TransactionClient, cursadaId: string, carrera: Carrera): Promise<void> {
    const cursada = await tx.cursada.findUniqueOrThrow({ where: { id: cursadaId } });
    if (!await tx.materiaCarrera.findFirst({ where: { materiaId: cursada.materiaId, carrera } })) {
      throw new InvalidAcademicInputError("La carrera no corresponde a la materia de la cursada.");
    }
  }

  async create(input: CreateComisionInput, actorId?: string): Promise<Comision> {
    try {
      return await this.prisma.$transaction(async tx => {
        await this.lockContext(tx, input.cursadaId);
        await this.validateCarrera(tx, input.cursadaId, input.carrera);
        const row = await tx.comision.create({ data: input, include: conProfesores });
        if (actorId) await tx.administracionHistorial.create({ data: { entidad: "comision", entidadId: row.id, actorId, accion: "CREACION", cambios: [] } });
        return toComision(row);
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ComisionAlreadyExistsError();
      }
      throw error;
    }
  }
}

function toComision(row: ComisionRow): Comision {
  return {
    id: row.id,
    cursadaId: row.cursadaId,
    nombre: `${row.carrera}-${row.numero}`,
    activa: row.activa,
    carrera: row.carrera,
    numero: row.numero,
    profesores: row.profesores.map((fila) => ({ id: fila.profesorId, nombreCompleto: fila.profesor.nombreCompleto, cargo: fila.cargo })),
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  };
}
