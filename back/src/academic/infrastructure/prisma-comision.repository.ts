import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { CargoDocente, Comision, ComisionDetalle } from "../domain/comision.js";
import type { Carrera } from "../domain/materia.js";
import { ComisionAlreadyExistsError } from "../application/errors.js";
import type { ComisionRepository, CreateComisionInput } from "../application/ports/comision.repository.js";

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

  async findByCursadaId(cursadaId: string, pagination: Pagination): Promise<PaginatedResult<Comision>> {
    const where = { cursadaId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.comision.findMany({
        where,
        include: conProfesores,
        orderBy: [{ carrera: "asc" }, { numero: "asc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.comision.count({ where }),
    ]);
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
      include: { ...conProfesores, cursada: { select: { id: true, anio: true, materia: { select: { id: true, nombre: true, modalidad: true } } } } },
    });
    return row ? { ...toComision(row), cursada: row.cursada } : null;
  }

  async existsByMateriaAndCarrera(materiaId: string, carrera: Carrera): Promise<boolean> {
    return (await this.prisma.comision.count({ where: { carrera, deletedAt: null, cursada: { materiaId } } })) > 0;
  }

  async asignarProfesor(comisionId: string, profesorId: string, cargo: CargoDocente): Promise<void> {
    await this.prisma.comisionProfesor.upsert({
      where: { comisionId_profesorId: { comisionId, profesorId } },
      create: { comisionId, profesorId, cargo },
      update: { cargo },
    });
  }

  async quitarProfesor(comisionId: string, profesorId: string): Promise<boolean> {
    return (await this.prisma.comisionProfesor.deleteMany({ where: { comisionId, profesorId } })).count > 0;
  }

  async create(input: CreateComisionInput): Promise<Comision> {
    try {
      return toComision(await this.prisma.comision.create({ data: input, include: conProfesores }));
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
