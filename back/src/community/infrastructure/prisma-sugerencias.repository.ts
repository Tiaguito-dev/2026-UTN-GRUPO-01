import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { SugerenciaSolicitudReutilizadaError, SugerenciaNoEncontradaError } from "../application/errors.js";
import type { SugerenciasAdministracionRepository } from "../application/ports/sugerencias-administracion.repository.js";
import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { RegistrarSugerenciaInput, SugerenciasRepository } from "../application/ports/sugerencias.repository.js";
import type { SugerenciaRegistrada, SugerenciaAdministrativa } from "../domain/sugerencia.js";

const adminSelect = { id: true, categoria: true, contenido: true, createdAt: true, meGusta: true,
  usuario: { select: { displayName: true } } } satisfies Prisma.SugerenciaSelect;
type AdminRow = Prisma.SugerenciaGetPayload<{ select: typeof adminSelect }>;
const administrative = ({ usuario, ...row }: AdminRow): SugerenciaAdministrativa => ({ ...row, autor: usuario });

export class PrismaSugerenciasRepository implements SugerenciasRepository, SugerenciasAdministracionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar({ soloMeGusta, ...pagination }: Pagination & { soloMeGusta: boolean }): Promise<PaginatedResult<SugerenciaAdministrativa>> {
    const where = { deletedAt: null, ...(soloMeGusta ? { meGusta: true } : {}) };
    // Página y total pertenecen al mismo snapshot, incluso si otro administrador elimina.
    return this.prisma.$transaction(async tx => {
      const [rows, total] = await Promise.all([
        tx.sugerencia.findMany({ where, select: adminSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }),
        tx.sugerencia.count({ where }),
      ]);
      return { items: rows.map(administrative), total, ...pagination };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async cambiarMeGusta(id: string, meGusta: boolean): Promise<SugerenciaAdministrativa> {
    try {
      return administrative(await this.prisma.sugerencia.update({
        where: { id, deletedAt: null }, data: { meGusta }, select: adminSelect,
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new SugerenciaNoEncontradaError();
      throw error;
    }
  }

  async eliminar(id: string): Promise<void> {
    const result = await this.prisma.sugerencia.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (result.count === 0) throw new SugerenciaNoEncontradaError();
  }

  registrar(input: RegistrarSugerenciaInput, usuarioId: string): Promise<SugerenciaRegistrada> {
    return this.prisma.$transaction(async tx => {
      // La unicidad serializa solicitudes concurrentes con la misma cuenta/clave sin duplicar.
      await tx.sugerencia.createMany({ data: [{ usuarioId, solicitudId: input.solicitudId, categoria: input.categoria, contenido: input.contenido }], skipDuplicates: true });
      // ReadCommitted toma un snapshot nuevo después de esperar la inserción concurrente.
      const existente = await tx.sugerencia.findUnique({
        where: { usuarioId_solicitudId: { usuarioId, solicitudId: input.solicitudId } },
        select: { id: true, createdAt: true, categoria: true, contenido: true },
      });
      if (!existente) throw new Error("No se pudo recuperar el registro de la sugerencia.");
      if (existente.categoria !== input.categoria || existente.contenido !== input.contenido) throw new SugerenciaSolicitudReutilizadaError();
      return { id: existente.id, createdAt: existente.createdAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
