import { randomUUID } from "node:crypto";
import { vi } from "vitest";
import { ListarMaterias } from "../src/academic/application/listar-materias.js";
import { ListarProfesores } from "../src/academic/application/listar-profesores.js";
import { ListarCursadasPorMateria } from "../src/academic/application/listar-cursadas-por-materia.js";
import { ListarComisionesPorCursada } from "../src/academic/application/listar-comisiones-por-cursada.js";
import { CrearMateria } from "../src/academic/application/crear-materia.js";
import { CrearProfesor } from "../src/academic/application/crear-profesor.js";
import { CrearCursada } from "../src/academic/application/crear-cursada.js";
import { CrearComision } from "../src/academic/application/crear-comision.js";
import type { Pagination, PaginatedResult } from "../src/shared/domain/pagination.js";
import type { Materia } from "../src/academic/domain/materia.js";
import type { Profesor } from "../src/academic/domain/profesor.js";
import type { Cursada } from "../src/academic/domain/cursada.js";
import type { Comision } from "../src/academic/domain/comision.js";
import type { MateriaRepository } from "../src/academic/application/ports/materia.repository.js";
import type { ProfesorRepository } from "../src/academic/application/ports/profesor.repository.js";
import type { CursadaRepository } from "../src/academic/application/ports/cursada.repository.js";
import type { ComisionRepository } from "../src/academic/application/ports/comision.repository.js";

export function paginate<T>(items: T[], pagination: Pagination): PaginatedResult<T> {
  const start = (pagination.page - 1) * pagination.pageSize;
  return { items: items.slice(start, start + pagination.pageSize), total: items.length, page: pagination.page, pageSize: pagination.pageSize };
}

/** Repositorios académicos falsos en memoria más los casos de uso ya cableados contra ellos. */
export function fixture() {
  const materias = new Map<string, Materia>();
  const profesores = new Map<string, Profesor>();
  const cursadas = new Map<string, Cursada>();
  const comisiones = new Map<string, Comision>();

  const materiaRepository: MateriaRepository = {
    findAll: vi.fn(async (pagination) => paginate([...materias.values()], pagination)),
    findById: vi.fn(async (id) => materias.get(id) ?? null),
    findByNombre: vi.fn(async (nombre) => [...materias.values()].find((m) => m.nombre === nombre) ?? null),
    create: vi.fn(async ({ nombre }) => {
      const materia: Materia = { id: randomUUID(), nombre, createdAt: new Date(), deletedAt: null };
      materias.set(materia.id, materia);
      return materia;
    }),
  };
  const profesorRepository: ProfesorRepository = {
    findAll: vi.fn(async (pagination) => paginate([...profesores.values()], pagination)),
    findById: vi.fn(async (id) => profesores.get(id) ?? null),
    create: vi.fn(async ({ nombreCompleto }) => {
      const profesor: Profesor = { id: randomUUID(), nombreCompleto, createdAt: new Date(), deletedAt: null };
      profesores.set(profesor.id, profesor);
      return profesor;
    }),
  };
  const cursadaRepository: CursadaRepository = {
    findByMateriaId: vi.fn(async (materiaId, pagination) => paginate([...cursadas.values()].filter((c) => c.materiaId === materiaId), pagination)),
    findById: vi.fn(async (id) => cursadas.get(id) ?? null),
    findByPeriodo: vi.fn(async (materiaId, anio, cuatrimestre) =>
      [...cursadas.values()].find((c) => c.materiaId === materiaId && c.anio === anio && c.cuatrimestre === cuatrimestre) ?? null),
    create: vi.fn(async (input) => {
      const cursada: Cursada = { ...input, id: randomUUID(), createdAt: new Date(), deletedAt: null };
      cursadas.set(cursada.id, cursada);
      return cursada;
    }),
  };
  const comisionRepository: ComisionRepository = {
    findByCursadaId: vi.fn(async (cursadaId, pagination) => paginate([...comisiones.values()].filter((c) => c.cursadaId === cursadaId), pagination)),
    findByCursadaIdAndNombre: vi.fn(async (cursadaId, nombre) =>
      [...comisiones.values()].find((c) => c.cursadaId === cursadaId && c.nombre === nombre) ?? null),
    create: vi.fn(async ({ cursadaId, nombre }) => {
      const comision: Comision = { id: randomUUID(), cursadaId, nombre, activa: true, createdAt: new Date(), deletedAt: null };
      comisiones.set(comision.id, comision);
      return comision;
    }),
  };

  function addMateria(nombre: string): Materia {
    const materia: Materia = { id: randomUUID(), nombre, createdAt: new Date(), deletedAt: null };
    materias.set(materia.id, materia);
    return materia;
  }
  function addProfesor(nombreCompleto: string): Profesor {
    const profesor: Profesor = { id: randomUUID(), nombreCompleto, createdAt: new Date(), deletedAt: null };
    profesores.set(profesor.id, profesor);
    return profesor;
  }
  function addCursada(materiaId: string, profesorId: string, anio = 2026): Cursada {
    const cursada: Cursada = { id: randomUUID(), materiaId, profesorId, anio, cuatrimestre: "PRIMERO", createdAt: new Date(), deletedAt: null };
    cursadas.set(cursada.id, cursada);
    return cursada;
  }
  function addComision(cursadaId: string, nombre: string): Comision {
    const comision: Comision = { id: randomUUID(), cursadaId, nombre, activa: true, createdAt: new Date(), deletedAt: null };
    comisiones.set(comision.id, comision);
    return comision;
  }

  return {
    materiaRepository, profesorRepository, cursadaRepository, comisionRepository,
    addMateria, addProfesor, addCursada, addComision,
    listarMaterias: new ListarMaterias(materiaRepository),
    listarProfesores: new ListarProfesores(profesorRepository),
    listarCursadasPorMateria: new ListarCursadasPorMateria(materiaRepository, cursadaRepository, profesorRepository),
    listarComisionesPorCursada: new ListarComisionesPorCursada(cursadaRepository, comisionRepository),
    crearMateria: new CrearMateria(materiaRepository),
    crearProfesor: new CrearProfesor(profesorRepository),
    crearCursada: new CrearCursada(materiaRepository, profesorRepository, cursadaRepository),
    crearComision: new CrearComision(cursadaRepository, comisionRepository),
  };
}
