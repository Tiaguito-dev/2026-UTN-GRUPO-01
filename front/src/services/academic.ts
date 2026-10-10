import { getAuthService } from "./auth";
import { toQuery, type PaginatedResult, type PaginationInput } from "./pagination";

export interface Materia { id: string; nombre: string; createdAt: string; deletedAt: string | null }
export interface Profesor { id: string; nombreCompleto: string; createdAt: string; deletedAt: string | null }
export type Cuatrimestre = "PRIMERO" | "SEGUNDO";
export interface Cursada { id: string; materiaId: string; profesorId: string; anio: number; cuatrimestre: Cuatrimestre; createdAt: string; deletedAt: string | null }
export interface CursadaResumen { id: string; anio: number; cuatrimestre: Cuatrimestre; profesor: string }
export interface Comision { id: string; cursadaId: string; nombre: string; activa: boolean; createdAt: string; deletedAt: string | null }

export type { PaginatedResult, PaginationInput };

export function listarMaterias(pagination: PaginationInput = {}): Promise<PaginatedResult<Materia>> {
  return getAuthService().protectedGet(`/materias${toQuery(pagination)}`);
}
export function listarProfesores(pagination: PaginationInput = {}): Promise<PaginatedResult<Profesor>> {
  return getAuthService().protectedGet(`/profesores${toQuery(pagination)}`);
}
export function listarCursadasPorMateria(materiaId: string, pagination: PaginationInput = {}): Promise<PaginatedResult<CursadaResumen>> {
  return getAuthService().protectedGet(`/materias/${encodeURIComponent(materiaId)}/cursadas${toQuery(pagination)}`);
}
export function listarComisionesPorCursada(cursadaId: string, pagination: PaginationInput = {}): Promise<PaginatedResult<Comision>> {
  return getAuthService().protectedGet(`/cursadas/${encodeURIComponent(cursadaId)}/comisiones${toQuery(pagination)}`);
}

// Altas administrativas (rol ADMIN). El backend valida de nuevo todo lo que el formulario ya
// comprueba y devuelve 409 en duplicados, 404 si la materia/profesor/cursada no existe.
export function crearMateria(input: { nombre: string }): Promise<Materia> {
  return getAuthService().protectedPost("/materias", input);
}
export function crearProfesor(input: { nombreCompleto: string }): Promise<Profesor> {
  return getAuthService().protectedPost("/profesores", input);
}
export function crearCursada(input: { materiaId: string; profesorId: string; anio: number; cuatrimestre: Cuatrimestre }): Promise<Cursada> {
  return getAuthService().protectedPost("/cursadas", input);
}
export function crearComision(input: { cursadaId: string; nombre: string }): Promise<Comision> {
  return getAuthService().protectedPost("/comisiones", input);
}
