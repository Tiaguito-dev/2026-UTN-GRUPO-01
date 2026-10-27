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
import { ActualizarMateria } from "../src/academic/application/actualizar-materia.js";
import type { Pagination, PaginatedResult } from "../src/shared/domain/pagination.js";
import { CARRERAS, type AnioCarrera, type Carrera, type NivelElectiva, type Materia, type MateriaCarrera } from "../src/academic/domain/materia.js";
import type { Profesor } from "../src/academic/domain/profesor.js";
import type { Cursada, CursadaResumen } from "../src/academic/domain/cursada.js";
import type { CargoDocente, Comision, ComisionDetalle } from "../src/academic/domain/comision.js";
import type { MateriaRepository } from "../src/academic/application/ports/materia.repository.js";
import type { ProfesorRepository } from "../src/academic/application/ports/profesor.repository.js";
import type { CursadaRepository } from "../src/academic/application/ports/cursada.repository.js";
import type { ComisionRepository } from "../src/academic/application/ports/comision.repository.js";

const CARGOS: CargoDocente[] = ["TITULAR", "ADJUNTO", "JTP"];
const porCarrera = <T extends { carrera: Carrera }>(filas: T[]): T[] => [...filas].sort((a, b) => CARRERAS.indexOf(a.carrera) - CARRERAS.indexOf(b.carrera));

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
  // Asignaciones "comisionId:profesorId" -> cargo.
  const asignaciones = new Map<string, CargoDocente>();

  // TASK-041: el puerto devuelve las comisiones con sus profesores (cargo y después nombre).
  function conProfesores(comision: Comision): Comision {
    const asignados = [...asignaciones].filter(([clave]) => clave.startsWith(`${comision.id}:`)).map(([clave, cargo]) => {
      const profesor = profesores.get(clave.split(":")[1]!)!;
      return { id: profesor.id, nombreCompleto: profesor.nombreCompleto, cargo };
    }).sort((a, b) => CARGOS.indexOf(a.cargo) - CARGOS.indexOf(b.cargo) || a.nombreCompleto.localeCompare(b.nombreCompleto));
    return { ...comision, profesores: asignados };
  }
  // TASK-041: resumen calculado por el repositorio sobre las comisiones activas y no borradas.
  function resumir(cursada: Cursada): CursadaResumen & { materiaId: string } {
    const vigentes = [...comisiones.values()].filter((c) => c.cursadaId === cursada.id && c.activa && !c.deletedAt).map(conProfesores);
    return {
      id: cursada.id,
      materiaId: cursada.materiaId,
      anio: cursada.anio,
      cuatrimestre: cursada.cuatrimestre,
      comisiones: vigentes.length,
      profesores: new Set(vigentes.flatMap((c) => c.profesores.map((p) => p.id))).size,
      carreras: CARRERAS.filter((carrera) => vigentes.some((c) => c.carrera === carrera)),
    };
  }

  const materiaRepository: MateriaRepository = {
    findAll: vi.fn(async (pagination, filters = {}) => {
      const items = [...materias.values()].filter(m => !m.deletedAt && (!filters.q || m.nombre.toLowerCase().includes(filters.q.toLowerCase())));
      if (filters.carrera) {
        return paginate(items.filter((m) => m.carreras.some((c) => c.carrera === filters.carrera && (!filters.anioCarrera || c.anioCarrera === filters.anioCarrera) && (!filters.nivelElectiva || c.nivelElectiva === filters.nivelElectiva))), pagination);
      }
      return paginate(items.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.id.localeCompare(b.id)), pagination);
    }),
    update: vi.fn(async (id, { carreras: filas, ...input }) => {
      const materia = { ...materias.get(id)!, ...input, ...(filas ? { carreras: porCarrera(filas) } : {}) }; materias.set(id, materia); return materia;
    }),
    findCarreras: vi.fn(async (materiaId) => (materias.get(materiaId)?.carreras ?? []).map((fila) => fila.carrera)),
    findHistorial: vi.fn(async (_id, pagination) => paginate([], pagination)),
    findById: vi.fn(async (id) => { const m = materias.get(id); return m && !m.deletedAt ? m : null; }),
    findByNombre: vi.fn(async (nombre) => [...materias.values()].find((m) => m.nombre === nombre) ?? null),
    create: vi.fn(async ({ nombre, carreras: filas }) => {
      const materia: Materia = { id: randomUUID(), nombre, carreras: porCarrera(filas ?? []), createdAt: new Date(), deletedAt: null };
      materias.set(materia.id, materia);
      return materia;
    }),
  };
  const profesorRepository: ProfesorRepository = {
    update: vi.fn(async (id, input) => {
      const result = { ...profesores.get(id)!, ...input };
      profesores.set(id, result);
      return result;
    }),
    findAll: vi.fn(async (pagination) => paginate([...profesores.values()], pagination)),
    findById: vi.fn(async (id) => { const p = profesores.get(id); return p && !p.deletedAt ? p : null; }),
    create: vi.fn(async ({ nombreCompleto }) => {
      const profesor: Profesor = { id: randomUUID(), nombreCompleto, createdAt: new Date(), deletedAt: null };
      profesores.set(profesor.id, profesor);
      return profesor;
    }),
  };
  const cursadaRepository: CursadaRepository = {
    update: vi.fn(async (id, input) => {
      const result = { ...cursadas.get(id)!, ...input };
      cursadas.set(id, result);
      return result;
    }),
    findByMateriaId: vi.fn(async (materiaId, pagination) => {
      const items = [...cursadas.values()].filter((c) => c.materiaId === materiaId && !c.deletedAt).map((c) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- descarta materiaId, no viaja en el resumen paginado
        const { materiaId: _, ...resumen } = resumir(c);
        return resumen;
      });
      return paginate(items, pagination);
    }),
    findById: vi.fn(async (id) => { const c = cursadas.get(id); return c && !c.deletedAt ? resumir(c) : null; }),
    findByPeriodo: vi.fn(async (materiaId, anio, cuatrimestre) =>
      [...cursadas.values()].find((c) => c.materiaId === materiaId && c.anio === anio && c.cuatrimestre === cuatrimestre) ?? null),
    create: vi.fn(async (input) => {
      const cursada: Cursada = { ...input, id: randomUUID(), createdAt: new Date(), deletedAt: null };
      cursadas.set(cursada.id, cursada);
      return cursada;
    }),
  };
  const comisionRepository: ComisionRepository = {
    update: vi.fn(async (id, input) => {
      const result = { ...comisiones.get(id)!, ...input };
      result.nombre = `${result.carrera}-${result.numero}`;
      comisiones.set(id, result);
      return conProfesores(result);
    }),
    findByCursadaId: vi.fn(async (cursadaId, pagination) => paginate([...comisiones.values()].filter((c) => c.cursadaId === cursadaId).map(conProfesores), pagination)),
    findByCursadaIdCarreraNumero: vi.fn(async (cursadaId, carrera, numero) =>
      [...comisiones.values()].find((c) => c.cursadaId === cursadaId && c.carrera === carrera && c.numero === numero) ?? null),
    findById: vi.fn(async (id) => { const c = comisiones.get(id); return c && !c.deletedAt ? conProfesores(c) : null; }),
    findDetalleById: vi.fn(async (id): Promise<ComisionDetalle | null> => {
      const comision = comisiones.get(id);
      const cursada = comision && cursadas.get(comision.cursadaId);
      const materia = cursada && materias.get(cursada.materiaId);
      if (!comision || !cursada || !materia || comision.deletedAt || cursada.deletedAt || materia.deletedAt) return null;
      return { ...conProfesores(comision), cursada: { id: cursada.id, anio: cursada.anio, cuatrimestre: cursada.cuatrimestre, materia: { id: materia.id, nombre: materia.nombre } } };
    }),
    create: vi.fn(async ({ cursadaId, carrera, numero }) => {
      const comision: Comision = { id: randomUUID(), cursadaId, nombre: `${carrera}-${numero}`, activa: true, carrera, numero, profesores: [], createdAt: new Date(), deletedAt: null };
      comisiones.set(comision.id, comision);
      return comision;
    }),
    existsByMateriaAndCarrera: vi.fn(async (materiaId, carrera) => [...comisiones.values()].some((c) =>
      !c.deletedAt && c.carrera === carrera && cursadas.get(c.cursadaId)?.materiaId === materiaId)),
    asignarProfesor: vi.fn(async (comisionId, profesorId, cargo) => { asignaciones.set(`${comisionId}:${profesorId}`, cargo); }),
    quitarProfesor: vi.fn(async (comisionId, profesorId) => asignaciones.delete(`${comisionId}:${profesorId}`)),
  };

  function addMateria(nombre: string, anioCarrera: AnioCarrera = "1", nivelElectiva: NivelElectiva | null = null): Materia {
    const carreras: MateriaCarrera[] = [{ carrera: "S", anioCarrera, nivelElectiva: nivelElectiva ?? null }];
    const materia: Materia = { id: randomUUID(), nombre, carreras, createdAt: new Date(), deletedAt: null };
    materias.set(materia.id, materia);
    return materia;
  }
  function setCarreras(materiaId: string, filas: MateriaCarrera[]): void {
    materias.get(materiaId)!.carreras = porCarrera(filas);
  }
  function addProfesor(nombreCompleto: string): Profesor {
    const profesor: Profesor = { id: randomUUID(), nombreCompleto, createdAt: new Date(), deletedAt: null };
    profesores.set(profesor.id, profesor);
    return profesor;
  }
  function addCursada(materiaId: string, anio = 2026): Cursada {
    const cursada: Cursada = { id: randomUUID(), materiaId, anio, cuatrimestre: "PRIMERO", createdAt: new Date(), deletedAt: null };
    cursadas.set(cursada.id, cursada);
    return cursada;
  }
  function addComision(cursadaId: string, carrera: Carrera = "S", numero = 1): Comision {
    const comision: Comision = { id: randomUUID(), cursadaId, nombre: `${carrera}-${numero}`, activa: true, carrera, numero, profesores: [], createdAt: new Date(), deletedAt: null };
    comisiones.set(comision.id, comision);
    return comision;
  }

  return {
    materiaRepository, profesorRepository, cursadaRepository, comisionRepository,
    addMateria, addProfesor, addCursada, addComision, setCarreras,
    asignaciones,
    listarMaterias: new ListarMaterias(materiaRepository),
    listarProfesores: new ListarProfesores(profesorRepository),
    listarCursadasPorMateria: new ListarCursadasPorMateria(materiaRepository, cursadaRepository),
    listarComisionesPorCursada: new ListarComisionesPorCursada(cursadaRepository, comisionRepository),
    crearMateria: new CrearMateria(materiaRepository),
    crearProfesor: new CrearProfesor(profesorRepository),
    crearCursada: new CrearCursada(materiaRepository, cursadaRepository),
    crearComision: new CrearComision(cursadaRepository, comisionRepository, materiaRepository),
    actualizarMateria: new ActualizarMateria(materiaRepository, comisionRepository),
  };
}
