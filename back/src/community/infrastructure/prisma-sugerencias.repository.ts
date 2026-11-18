import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { SugerenciaSolicitudReutilizadaError } from "../application/errors.js";
import type { RegistrarSugerenciaInput, SugerenciasRepository } from "../application/ports/sugerencias.repository.js";
import type { SugerenciaRegistrada } from "../domain/sugerencia.js";

export class PrismaSugerenciasRepository implements SugerenciasRepository {
  constructor(private readonly prisma: PrismaService) {}

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
