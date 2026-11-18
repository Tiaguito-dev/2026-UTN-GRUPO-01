import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../infrastructure/prisma/prisma.module.js";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { SharedModule } from "../shared/shared.module.js";
import { ConsultarNormas } from "./application/consultar-normas.js";
import { NORMAS_REPOSITORY, type NormasRepository } from "./application/ports/normas.repository.js";
import { PrismaNormasRepository } from "./infrastructure/prisma-normas.repository.js";
import { ComunidadController } from "./community.controller.js";

@Module({
  imports: [AuthModule, PrismaModule, SharedModule],
  controllers: [ComunidadController],
  providers: [
    { provide: NORMAS_REPOSITORY, useFactory: (prisma: PrismaService) => new PrismaNormasRepository(prisma), inject: [PrismaService] },
    { provide: ConsultarNormas, useFactory: (repository: NormasRepository) => new ConsultarNormas(repository), inject: [NORMAS_REPOSITORY] },
  ],
})
export class ComunidadModule {}
