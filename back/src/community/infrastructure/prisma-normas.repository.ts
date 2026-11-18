import type { NormasRepository } from "../application/ports/normas.repository.js";
import type { NormasConvivencia } from "../domain/normas-convivencia.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export class PrismaNormasRepository implements NormasRepository {
  constructor(private readonly prisma: PrismaService) {}

  obtenerVigentes(): Promise<NormasConvivencia | null> {
    return this.prisma.normasConvivencia.findUnique({
      where: { id: "vigentes" },
      select: { id: true, titulo: true, introduccion: true, normas: true, cierre: true, createdAt: true, updatedAt: true },
    });
  }
}
