import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { PaginatedResult, Pagination } from "../../shared/domain/pagination.js";
import type { Feedback } from "../domain/feedback.js";
import type { FeedbackRepository } from "../application/ports/feedback.repository.js";
import type { CreateFeedbackInput, UpdateFeedbackInput, FeedbackFilters } from "../application/feedback-input.js";
import { FeedbackDuplicateError, FeedbackNotFoundError } from "../application/errors.js";
import { assertFeedbackOpen, assertFeedbackOwner, assertFeedbackRemoval, selectFeedbackProfesor } from "../application/feedback-policy.js";
import type { UserRole } from "../../users/domain/user.js";
import { ComisionNotFoundError } from "../../academic/application/errors.js";

type Transaction = Prisma.TransactionClient;
export const includeAutor = { autor: { select: { displayName: true } }, comision: { select: { carrera: true } } } satisfies Prisma.FeedbackInclude;
type FeedbackRow = Prisma.FeedbackGetPayload<{ include: typeof includeAutor }>;
type SnapshotRow = {
  id: string; carrera: string; numero: number; activa: boolean;
  materiaId: string; materiaNombre: string; cursadaId: string; anio: number;
  modalidad: "ANUAL" | "PRIMERO" | "SEGUNDO" | null;
  profesorId: string | null; profesorNombre: string | null; profesorCargo: "TITULAR" | "ADJUNTO" | "JTP" | null;
};

export function present(row: FeedbackRow, viewer: string): Feedback {
  return {
    id: row.id, texto: row.texto, puntuacion: row.puntuacion, anonimo: row.anonimo,
    autor: row.anonimo ? null : { displayName: row.autor.displayName }, propio: row.autorId === viewer,
    profesor: row.profesorId && row.profesorNombre && row.profesorCargo
      ? { id: row.profesorId, nombreCompleto: row.profesorNombre, cargo: row.profesorCargo } : null,
    contexto: { carrera: row.comision.carrera, comisionId: row.comisionId, nombre: row.comisionNombre, materiaId: row.materiaId,
      materiaNombre: row.materiaNombre, cursadaId: row.cursadaId, anio: row.anio, cuatrimestre: row.cuatrimestre, modalidad: row.modalidad },
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}
const paging = ({ page, pageSize }: Pagination) => ({ skip: (page - 1) * pageSize, take: pageSize });
const recent = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.FeedbackOrderByWithRelationInput[];

export class PrismaFeedbackRepository implements FeedbackRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async comisionExists(id: string, tx: Transaction = this.prisma) {
    // Historical reading survives academic soft deletion; only publication requires live ancestors.
    if (!(await tx.comision.findUnique({ where: { id }, select: { id: true } }))) throw new ComisionNotFoundError();
  }

  private async lockComision(tx: Transaction, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Comision" WHERE "id" = ${id}::uuid FOR UPDATE`;
    if (!rows.length) throw new ComisionNotFoundError();
  }

  private async snapshot(tx: Transaction, id: string): Promise<SnapshotRow[]> {
    // One SQL statement gives a single MVCC snapshot of context and assignments, even if an
    // administrator reassigns a professor concurrently. Later reads never rebuild this snapshot.
    const rows = await tx.$queryRaw<SnapshotRow[]>`
      SELECT c."id", c."carrera"::text, c."numero", c."activa", cu."id" AS "cursadaId",
        cu."anio", cu."cuatrimestre"::text AS "modalidad", m."id" AS "materiaId", m."nombre" AS "materiaNombre",
        p."id" AS "profesorId", p."nombreCompleto" AS "profesorNombre", cp."cargo" AS "profesorCargo"
      FROM "Comision" c JOIN "Cursada" cu ON cu."id" = c."cursadaId"
      JOIN "Materia" m ON m."id" = cu."materiaId"
      LEFT JOIN "ComisionProfesor" cp ON cp."comisionId" = c."id"
      LEFT JOIN "Profesor" p ON p."id" = cp."profesorId" AND p."deletedAt" IS NULL
      WHERE c."id" = ${id}::uuid AND c."deletedAt" IS NULL
        AND cu."deletedAt" IS NULL AND m."deletedAt" IS NULL`;
    if (!rows.length) throw new ComisionNotFoundError();
    return rows;
  }

  private async listing(where: Prisma.FeedbackWhereInput, viewer: string, pagination: Pagination): Promise<PaginatedResult<Feedback>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({ where, include: includeAutor, orderBy: recent, ...paging(pagination) }),
      this.prisma.feedback.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: items.map((row) => present(row, viewer)), total, ...pagination };
  }

  listGeneral(viewer: string, pagination: Pagination, filters: FeedbackFilters = {}) {
    return this.listing({ deletedAt: null,
      ...(filters.carrera ? { comision: { carrera: filters.carrera } } : {}),
      ...(filters.materiaId ? { materiaId: filters.materiaId } : {}),
    }, viewer, pagination);
  }

  async listComision(id: string, viewer: string, pagination: Pagination) {
    await this.comisionExists(id);
    return this.listing({ comisionId: id, deletedAt: null }, viewer, pagination);
  }

  async propio(id: string, viewer: string) {
    await this.comisionExists(id);
    const row = await this.prisma.feedback.findFirst({ where: { comisionId: id, autorId: viewer, deletedAt: null }, include: includeAutor });
    return row ? present(row, viewer) : null;
  }

  async create(id: string, viewer: string, input: CreateFeedbackInput): Promise<Feedback> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockComision(tx, id);
        const rows = await this.snapshot(tx, id);
        const context = rows[0]!;
        assertFeedbackOpen(context.activa);
        if (await tx.feedback.findFirst({ where: { comisionId: id, autorId: viewer, deletedAt: null }, select: { id: true } })) throw new FeedbackDuplicateError();
        const docente = selectFeedbackProfesor(rows, input.profesorId);
        // Comisión primero, luego el par: coordina también primeras valoraciones entre comisiones.
        // Namespace distinto del bloqueo de administración de usuarios. Colisiones solo serializan.
        const ratingKey = `${viewer.toLowerCase()}:${context.materiaId.toLowerCase()}`;
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(2026071, hashtext(${ratingKey}))`;
        const ratingWhere = { usuarioId_materiaId: { usuarioId: viewer, materiaId: context.materiaId } };
        // Lectura interna incluye bajas para reactivar la identidad existente y auditar el cambio.
        const previousRating = await tx.valoracionMateria.findUnique({ where: ratingWhere });
        const eventId = randomUUID();
        const row = await tx.feedback.create({ data: {
          autorId: viewer, comisionId: id, texto: input.texto, anonimo: input.anonimo, puntuacion: input.puntuacion,
          profesorId: docente?.profesorId ?? null, profesorNombre: docente?.profesorNombre ?? null,
          profesorCargo: docente?.profesorCargo ?? null,
          comisionNombre: `${context.carrera}-${context.numero}`, materiaId: context.materiaId,
          materiaNombre: context.materiaNombre, cursadaId: context.cursadaId,
          anio: context.anio, modalidad: context.modalidad,
          cuatrimestre: context.modalidad === "ANUAL" ? null : context.modalidad,
          historial: { create: { id: eventId, accion: "CREACION", texto: input.texto, anonimo: input.anonimo, puntuacion: input.puntuacion } },
        }, include: includeAutor });
        await tx.valoracionMateria.upsert({
          where: ratingWhere,
          create: { usuarioId: viewer, materiaId: context.materiaId, puntuacion: input.puntuacion },
          update: { puntuacion: input.puntuacion, deletedAt: null, updatedAt: new Date() },
        });
        const cambios: { campo: string; anterior: string | null; nuevo: string | null }[] = [
          { campo: "puntuacion", anterior: null, nuevo: String(input.puntuacion) },
        ];
        if (previousRating?.puntuacion !== input.puntuacion) cambios.push({
          campo: "valoracionMateria.puntuacion", anterior: previousRating ? String(previousRating.puntuacion) : null, nuevo: String(input.puntuacion),
        });
        if (previousRating?.deletedAt) cambios.push({ campo: "valoracionMateria.deletedAt", anterior: previousRating.deletedAt.toISOString(), nuevo: null });
        await tx.administracionHistorial.create({ data: { id: eventId, entidad: "feedback", entidadId: row.id, actorId: viewer, accion: "CREACION", cambios } });
        return present(row, viewer);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = error.meta?.["target"];
        if (target === "Feedback_autor_comision_vigente_key" ||
          (Array.isArray(target) && target.length === 2 && target[0] === "autorId" && target[1] === "comisionId")) throw new FeedbackDuplicateError();
      }
      throw error;
    }
  }

  async get(id: string, viewer: string) {
    return present(await this.owned(id, viewer), viewer);
  }

  private async owned(id: string, viewer: string, tx: Transaction = this.prisma, includeDeleted = false) {
    const row = await tx.feedback.findUnique({ where: { id }, include: includeAutor });
    if (!row || (!includeDeleted && row.deletedAt)) throw new FeedbackNotFoundError();
    assertFeedbackOwner(row.autorId, viewer);
    return row;
  }

  async update(id: string, viewer: string, input: UpdateFeedbackInput) {
    const original = await this.owned(id, viewer);
    return this.prisma.$transaction(async (tx) => {
      await this.lockComision(tx, original.comisionId);
      const row = await this.owned(id, viewer, tx);
      const context = (await this.snapshot(tx, row.comisionId))[0]!;
      assertFeedbackOpen(context.activa);
      const texto = input.texto ?? row.texto;
      const anonimo = input.anonimo ?? row.anonimo;
      const puntuacion = input.puntuacion ?? row.puntuacion;
      const puntuacionChanged = puntuacion !== row.puntuacion;
      if (texto === row.texto && anonimo === row.anonimo && !puntuacionChanged) return present(row, viewer);
      const cambios: { campo: string; anterior: string | null; nuevo: string | null }[] = [
        { campo: "texto", anterior: row.texto, nuevo: texto },
        { campo: "anonimo", anterior: String(row.anonimo), nuevo: String(anonimo) },
        { campo: "puntuacion", anterior: row.puntuacion === null ? null : String(row.puntuacion), nuevo: puntuacion === null ? null : String(puntuacion) },
      ].filter(change => change.anterior !== change.nuevo);
      const ratingWhere = { usuarioId_materiaId: { usuarioId: row.autorId, materiaId: row.materiaId } };
      if (puntuacionChanged) {
        // Mismo orden y clave que create(): comisión primero, luego usuario/materia.
        const ratingKey = `${row.autorId.toLowerCase()}:${row.materiaId.toLowerCase()}`;
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(2026071, hashtext(${ratingKey}))`;
        const previousRating = await tx.valoracionMateria.findUnique({ where: ratingWhere });
        if (previousRating?.puntuacion !== puntuacion) cambios.push({
          campo: "valoracionMateria.puntuacion", anterior: previousRating ? String(previousRating.puntuacion) : null, nuevo: String(puntuacion),
        });
        if (previousRating?.deletedAt) cambios.push({ campo: "valoracionMateria.deletedAt", anterior: previousRating.deletedAt.toISOString(), nuevo: null });
      }
      const eventId = randomUUID();
      const now = new Date();
      const updated = await tx.feedback.update({ where: { id }, data: {
        texto, anonimo, puntuacion, updatedAt: now, historial: { create: { id: eventId, accion: "EDICION", texto, anonimo, puntuacion } },
      }, include: includeAutor });
      if (puntuacionChanged && puntuacion !== null) await tx.valoracionMateria.upsert({
        where: ratingWhere,
        create: { usuarioId: row.autorId, materiaId: row.materiaId, puntuacion },
        update: { puntuacion, deletedAt: null, updatedAt: now },
      });
      await tx.administracionHistorial.create({ data: { id: eventId, entidad: "feedback", entidadId: id, actorId: viewer, accion: "EDICION", cambios } });
      return present(updated, viewer);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  private async removable(id: string, viewer: string, role: UserRole, tx: Transaction = this.prisma) {
    const row = await tx.feedback.findUnique({ where: { id }, include: includeAutor });
    if (!row || row.deletedAt) throw new FeedbackNotFoundError();
    assertFeedbackRemoval(row.autorId, viewer, role);
    return row;
  }

  async remove(id: string, viewer: string, role: UserRole = "USER") {
    const original = await this.removable(id, viewer, role);
    await this.prisma.$transaction(async (tx) => {
      await this.lockComision(tx, original.comisionId);
      const row = await this.removable(id, viewer, role, tx);
      // El actor puede ser ADMIN; el bloqueo y el voto pertenecen al autor real del comentario.
      const ratingKey = `${row.autorId.toLowerCase()}:${row.materiaId.toLowerCase()}`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(2026071, hashtext(${ratingKey}))`;
      const now = new Date();
      const eventId = randomUUID();
      await tx.feedback.update({ where: { id }, data: {
        deletedAt: now, updatedAt: now,
        historial: { create: { id: eventId, accion: "ELIMINACION", texto: row.texto, anonimo: row.anonimo, puntuacion: row.puntuacion } },
      } });
      const cambios: { campo: string; anterior: string | null; nuevo: string | null }[] = [
        { campo: "deletedAt", anterior: null, nuevo: now.toISOString() },
      ];
      if (row.puntuacion !== null) {
        const remaining = await tx.feedback.findFirst({
          where: { autorId: row.autorId, materiaId: row.materiaId, deletedAt: null, puntuacion: { not: null } },
          select: { id: true },
        });
        if (!remaining) {
          const rating = await tx.valoracionMateria.findUnique({
            where: { usuarioId_materiaId: { usuarioId: row.autorId, materiaId: row.materiaId } },
          });
          if (rating && rating.deletedAt === null) {
            const retired = await tx.valoracionMateria.updateMany({
              where: { usuarioId: row.autorId, materiaId: row.materiaId, deletedAt: null },
              data: { deletedAt: now, updatedAt: now },
            });
            if (retired.count) cambios.push({ campo: "valoracionMateria.deletedAt", anterior: null, nuevo: now.toISOString() });
          }
        }
      }
      await tx.administracionHistorial.create({ data: { id: eventId, entidad: "feedback", entidadId: id, actorId: viewer, accion: "ELIMINACION", cambios } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async history(id: string, viewer: string, pagination: Pagination) {
    await this.owned(id, viewer, this.prisma, true);
    const where = { feedbackId: id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedbackHistorial.findMany({ where, select: { id: true, accion: true, texto: true, puntuacion: true, anonimo: true, createdAt: true }, orderBy: recent, ...paging(pagination) }),
      this.prisma.feedbackHistorial.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items, total, ...pagination };
  }

}
