import { getAuthService } from "./auth";
import { toQuery, type PaginatedResult, type PaginationInput } from "./pagination";
import { comisionSchema, cursadaDetalleSchema, cursadaResumenSchema, cursadaSchema, paginatedSchema, profesorSchema } from "./schemas";

export type { Materia } from "@/types/materias";
export interface Profesor { id: string; nombreCompleto: string; createdAt: string; deletedAt: string | null }
export type Cuatrimestre = "PRIMERO" | "SEGUNDO";
export interface Cursada { id: string; materiaId: string; profesorId: string; anio: number; cuatrimestre: Cuatrimestre; createdAt: string; deletedAt: string | null }
export interface CursadaResumen { id: string; anio: number; cuatrimestre: Cuatrimestre; profesor: string }
export interface CursadaDetalle extends CursadaResumen { materia: { id: string; nombre: string } }
export interface Comision { id: string; cursadaId: string; nombre: string; activa: boolean; createdAt: string; deletedAt: string | null }

export { listarMaterias, obtenerMateria, crearMateria } from "./materias";
export function listarProfesores(pagination: PaginationInput = {}): Promise<PaginatedResult<Profesor>> {
  return getAuthService().protectedGet(`/profesores${toQuery(pagination)}`, paginatedSchema(profesorSchema));
}
export function listarCursadasPorMateria(materiaId: string, pagination: PaginationInput = {}): Promise<PaginatedResult<CursadaResumen>> {
  return getAuthService().protectedGet(`/materias/${encodeURIComponent(materiaId)}/cursadas${toQuery(pagination)}`, paginatedSchema(cursadaResumenSchema));
}
export function obtenerCursada(cursadaId: string): Promise<CursadaDetalle> {
  return getAuthService().protectedGet(`/cursadas/${encodeURIComponent(cursadaId)}`, cursadaDetalleSchema);
}
export function listarComisionesPorCursada(cursadaId: string, pagination: PaginationInput = {}): Promise<PaginatedResult<Comision>> {
  return getAuthService().protectedGet(`/cursadas/${encodeURIComponent(cursadaId)}/comisiones${toQuery(pagination)}`, paginatedSchema(comisionSchema));
}

// Altas administrativas (rol ADMIN). El backend valida de nuevo todo lo que el formulario ya
// comprueba y devuelve 409 en duplicados, 404 si la materia/profesor/cursada no existe.

export function crearProfesor(input: { nombreCompleto: string }): Promise<Profesor> {
  return getAuthService().protectedPost("/profesores", input, profesorSchema);
}
export function crearCursada(input: { materiaId: string; profesorId: string; anio: number; cuatrimestre: Cuatrimestre }): Promise<Cursada> {
  return getAuthService().protectedPost("/cursadas", input, cursadaSchema);
}
export function crearComision(input: { cursadaId: string; nombre: string }): Promise<Comision> {
  return getAuthService().protectedPost("/comisiones", input, comisionSchema);
}
