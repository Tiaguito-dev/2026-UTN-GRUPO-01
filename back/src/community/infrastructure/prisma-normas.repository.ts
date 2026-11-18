import type { ActualizarNormasInput, NormasRepository } from "../application/ports/normas.repository.js";
import type { NormasConvivencia } from "../domain/normas-convivencia.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { NormasNoDisponiblesError } from "../application/errors.js";

// El responsable queda en persistencia; no se expone en el DTO de consulta ni de guardado.
const publicFields = { id: true, titulo: true, introduccion: true, normas: true, cierre: true, createdAt: true, updatedAt: true } as const;

export class PrismaNormasRepository implements NormasRepository {
  constructor(private readonly prisma: PrismaService) {}

  obtenerVigentes(): Promise<NormasConvivencia | null> {
    return this.prisma.normasConvivencia.findUnique({
      where: { id: "vigentes" },
      select: publicFields,
    });
  }

  async actualizarVigentes(input: ActualizarNormasInput, actorId: string): Promise<NormasConvivencia> {
    try {
      // Una única actualización guarda contenido, responsable y @updatedAt sin lectura previa.
      return await this.prisma.normasConvivencia.update({
        where: { id: "vigentes" },
        data: { titulo: input.titulo, introduccion: input.introduccion, normas: input.normas, cierre: input.cierre, actualizadoPorId: actorId },
        select: publicFields,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new NormasNoDisponiblesError();
      throw error;
    }
  }
}
