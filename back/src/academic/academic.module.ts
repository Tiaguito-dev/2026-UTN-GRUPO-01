import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../infrastructure/prisma/prisma.module.js";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import { SharedModule } from "../shared/shared.module.js";
import { AcademicController } from "./academic.controller.js";
import { MATERIA_REPOSITORY, type MateriaRepository } from "./application/ports/materia.repository.js";
import { PROFESOR_REPOSITORY, type ProfesorRepository } from "./application/ports/profesor.repository.js";
import { CURSADA_REPOSITORY, type CursadaRepository } from "./application/ports/cursada.repository.js";
import { COMISION_REPOSITORY, type ComisionRepository } from "./application/ports/comision.repository.js";
import { PrismaMateriaRepository } from "./infrastructure/prisma-materia.repository.js";
import { PrismaProfesorRepository } from "./infrastructure/prisma-profesor.repository.js";
import { PrismaCursadaRepository } from "./infrastructure/prisma-cursada.repository.js";
import { PrismaComisionRepository } from "./infrastructure/prisma-comision.repository.js";
import { ListarMaterias } from "./application/listar-materias.js";
import { ListarProfesores } from "./application/listar-profesores.js";
import { ListarCursadasPorMateria } from "./application/listar-cursadas-por-materia.js";
import { ListarComisionesPorCursada } from "./application/listar-comisiones-por-cursada.js";
import { CrearMateria } from "./application/crear-materia.js";
import { CrearProfesor } from "./application/crear-profesor.js";
import { CrearCursada } from "./application/crear-cursada.js";
import { CrearComision } from "./application/crear-comision.js";

@Module({
  imports: [PrismaModule, AuthModule, SharedModule],
  controllers: [AcademicController],
  providers: [
    {
      provide: MATERIA_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaMateriaRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: PROFESOR_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaProfesorRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CURSADA_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaCursadaRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: COMISION_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaComisionRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ListarMaterias,
      useFactory: (materias: MateriaRepository) => new ListarMaterias(materias),
      inject: [MATERIA_REPOSITORY],
    },
    {
      provide: ListarCursadasPorMateria,
      useFactory: (materias: MateriaRepository, cursadas: CursadaRepository, profesores: ProfesorRepository) =>
        new ListarCursadasPorMateria(materias, cursadas, profesores),
      inject: [MATERIA_REPOSITORY, CURSADA_REPOSITORY, PROFESOR_REPOSITORY],
    },
    {
      provide: ListarComisionesPorCursada,
      useFactory: (cursadas: CursadaRepository, comisiones: ComisionRepository) =>
        new ListarComisionesPorCursada(cursadas, comisiones),
      inject: [CURSADA_REPOSITORY, COMISION_REPOSITORY],
    },
    {
      provide: ListarProfesores,
      useFactory: (profesores: ProfesorRepository) => new ListarProfesores(profesores),
      inject: [PROFESOR_REPOSITORY],
    },
    {
      provide: CrearMateria,
      useFactory: (materias: MateriaRepository) => new CrearMateria(materias),
      inject: [MATERIA_REPOSITORY],
    },
    {
      provide: CrearProfesor,
      useFactory: (profesores: ProfesorRepository) => new CrearProfesor(profesores),
      inject: [PROFESOR_REPOSITORY],
    },
    {
      provide: CrearCursada,
      useFactory: (materias: MateriaRepository, profesores: ProfesorRepository, cursadas: CursadaRepository) =>
        new CrearCursada(materias, profesores, cursadas),
      inject: [MATERIA_REPOSITORY, PROFESOR_REPOSITORY, CURSADA_REPOSITORY],
    },
    {
      provide: CrearComision,
      useFactory: (cursadas: CursadaRepository, comisiones: ComisionRepository) => new CrearComision(cursadas, comisiones),
      inject: [CURSADA_REPOSITORY, COMISION_REPOSITORY],
    },
  ],
})
export class AcademicModule {}
