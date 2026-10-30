import { ObtenerProfesor } from "./application/obtener-profesor.js";
import { ActualizarProfesor } from "./application/actualizar-profesor.js";
import { ActualizarCursada } from "./application/actualizar-cursada.js";
import { ActualizarComision } from "./application/actualizar-comision.js";
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
import { ObtenerMateria } from "./application/obtener-materia.js";
import { ObtenerCursada } from "./application/obtener-cursada.js";
import { ObtenerComision } from "./application/obtener-comision.js";
import { ActualizarMateria } from "./application/actualizar-materia.js";
import { ListarHistorialMateria } from "./application/listar-historial-materia.js";
import { AsignarProfesorComision } from "./application/asignar-profesor-comision.js";
import { QuitarProfesorComision } from "./application/quitar-profesor-comision.js";
import { AcademicAdministrationController } from "./academic-administration.controller.js";
import { ACADEMIC_ADMINISTRATION_REPOSITORY, type AcademicAdministrationRepository } from "./application/ports/academic-administration.repository.js";
import { PrismaAcademicAdministrationRepository } from "./infrastructure/prisma-academic-administration.repository.js";
import { EliminarAcademico } from "./application/eliminar-academico.js";
import { ListarHistorialAcademico } from "./application/listar-historial-academico.js";

@Module({
  imports: [PrismaModule, AuthModule, SharedModule],
  controllers: [AcademicController, AcademicAdministrationController],
  providers: [
    { provide: ACADEMIC_ADMINISTRATION_REPOSITORY, useFactory: (prisma: PrismaService) => new PrismaAcademicAdministrationRepository(prisma), inject: [PrismaService] },
    ...[EliminarAcademico, ListarHistorialAcademico].map((provide) => ({ provide, useFactory: (repository: AcademicAdministrationRepository) => new provide(repository), inject: [ACADEMIC_ADMINISTRATION_REPOSITORY] })),
    { provide: ObtenerProfesor, useFactory: (profesores: ProfesorRepository) => new ObtenerProfesor(profesores), inject: [PROFESOR_REPOSITORY] },
    { provide: ActualizarProfesor, useFactory: (profesores: ProfesorRepository) => new ActualizarProfesor(profesores), inject: [PROFESOR_REPOSITORY] },
    { provide: ActualizarCursada, useFactory: (materias: MateriaRepository, cursadas: CursadaRepository) => new ActualizarCursada(materias, cursadas), inject: [MATERIA_REPOSITORY, CURSADA_REPOSITORY] },
    { provide: ActualizarComision, useFactory: (cursadas: CursadaRepository, comisiones: ComisionRepository, materias: MateriaRepository) => new ActualizarComision(cursadas, comisiones, materias), inject: [CURSADA_REPOSITORY, COMISION_REPOSITORY, MATERIA_REPOSITORY] },
    ...[ObtenerMateria, ListarHistorialMateria].map((provide) => ({
      provide,
      useFactory: (materias: MateriaRepository) => new provide(materias),
      inject: [MATERIA_REPOSITORY],
    })),
    {
      provide: ActualizarMateria,
      useFactory: (materias: MateriaRepository, comisiones: ComisionRepository) => new ActualizarMateria(materias, comisiones),
      inject: [MATERIA_REPOSITORY, COMISION_REPOSITORY],
    },
    ...[AsignarProfesorComision, QuitarProfesorComision].map((provide) => ({
      provide,
      useFactory: (comisiones: ComisionRepository, profesores: ProfesorRepository) => new provide(comisiones, profesores),
      inject: [COMISION_REPOSITORY, PROFESOR_REPOSITORY],
    })),
    {
      provide: ObtenerComision,
      useFactory: (comisiones: ComisionRepository) => new ObtenerComision(comisiones),
      inject: [COMISION_REPOSITORY],
    },
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
      useFactory: (materias: MateriaRepository, cursadas: CursadaRepository) =>
        new ListarCursadasPorMateria(materias, cursadas),
      inject: [MATERIA_REPOSITORY, CURSADA_REPOSITORY],
    },
    {
      provide: ObtenerCursada,
      useFactory: (cursadas: CursadaRepository, materias: MateriaRepository) =>
        new ObtenerCursada(cursadas, materias),
      inject: [CURSADA_REPOSITORY, MATERIA_REPOSITORY],
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
      useFactory: (materias: MateriaRepository, cursadas: CursadaRepository) =>
        new CrearCursada(materias, cursadas),
      inject: [MATERIA_REPOSITORY, CURSADA_REPOSITORY],
    },
    {
      provide: CrearComision,
      useFactory: (cursadas: CursadaRepository, comisiones: ComisionRepository, materias: MateriaRepository) =>
        new CrearComision(cursadas, comisiones, materias),
      inject: [CURSADA_REPOSITORY, COMISION_REPOSITORY, MATERIA_REPOSITORY],
    },
  ],
})
export class AcademicModule {}
