import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../infrastructure/prisma/prisma.module.js";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { SharedModule } from "../shared/shared.module.js";
import { ConsultarNormas } from "./application/consultar-normas.js";
import { ActualizarNormas } from "./application/actualizar-normas.js";
import { RegistrarSugerencia } from "./application/registrar-sugerencia.js";
import { NORMAS_REPOSITORY, type NormasRepository } from "./application/ports/normas.repository.js";
import { PrismaNormasRepository } from "./infrastructure/prisma-normas.repository.js";
import { ComunidadController } from "./community.controller.js";
import { SUGERENCIAS_REPOSITORY, type SugerenciasRepository } from "./application/ports/sugerencias.repository.js";
import { PrismaSugerenciasRepository } from "./infrastructure/prisma-sugerencias.repository.js";
import { AdministrarSugerencias } from "./application/administrar-sugerencias.js";

@Module({
  imports: [AuthModule, PrismaModule, SharedModule],
  controllers: [ComunidadController],
  providers: [
    { provide: NORMAS_REPOSITORY, useFactory: (prisma: PrismaService) => new PrismaNormasRepository(prisma), inject: [PrismaService] },
    { provide: ConsultarNormas, useFactory: (repository: NormasRepository) => new ConsultarNormas(repository), inject: [NORMAS_REPOSITORY] },
    { provide: ActualizarNormas, useFactory: (repository: NormasRepository) => new ActualizarNormas(repository), inject: [NORMAS_REPOSITORY] },
    { provide: SUGERENCIAS_REPOSITORY, useFactory: (prisma: PrismaService) => new PrismaSugerenciasRepository(prisma), inject: [PrismaService] },
    { provide: RegistrarSugerencia, useFactory: (repository: SugerenciasRepository) => new RegistrarSugerencia(repository), inject: [SUGERENCIAS_REPOSITORY] },
    { provide: AdministrarSugerencias, useFactory: (repository: PrismaSugerenciasRepository) => new AdministrarSugerencias(repository), inject: [SUGERENCIAS_REPOSITORY] },
  ],
})
export class ComunidadModule {}
