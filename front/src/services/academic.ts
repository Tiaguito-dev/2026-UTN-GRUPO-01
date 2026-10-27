import { getAuthService } from "./auth";
import { requestJson } from "./http";
import { toQuery, type PaginatedResult, type PaginationInput } from "./pagination";
import {
  comisionDetalleSchema,
  comisionSchema,
  cursadaDetalleSchema,
  cursadaResumenSchema,
  cursadaSchema,
  paginatedSchema,
  parseResponse,
  profesorAsignadoSchema,
  profesorSchema,
} from "./schemas";
import type { Carrera } from "@/types/materias";

export type { Materia, Carrera, MateriaCarrera } from "@/types/materias";
export interface Profesor { id: string; nombreCompleto: string; createdAt: string; deletedAt: string | null }
export type Cuatrimestre = "PRIMERO" | "SEGUNDO" | "ANUAL";
export const CARGOS = ["TITULAR", "ADJUNTO", "JTP"] as const;
export type CargoDocente = typeof CARGOS[number];
export interface ProfesorAsignado { id: string; nombreCompleto: string; cargo: CargoDocente }
export interface Cursada { id: string; materiaId: string; anio: number; cuatrimestre: Cuatrimestre; createdAt: string; deletedAt: string | null }
export interface CursadaResumen { id: string; anio: number; cuatrimestre: Cuatrimestre; comisiones: number; profesores: number; carreras: Carrera[] }
export interface CursadaDetalle { id: string; anio: number; cuatrimestre: Cuatrimestre; materia: { id: string; nombre: string } }
export interface Comision { id: string; cursadaId: string; carrera: Carrera; numero: number; nombre: string; activa: boolean; profesores: ProfesorAsignado[]; createdAt: string; deletedAt: string | null }
export interface ComisionDetalle extends Comision { cursada: { id: string; anio: number; cuatrimestre: Cuatrimestre; materia: { id: string; nombre: string } } }

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
export function obtenerComision(comisionId: string): Promise<ComisionDetalle> {
  return getAuthService().protectedGet(`/comisiones/${encodeURIComponent(comisionId)}`, comisionDetalleSchema);
}

// Asignación y baja de profesores por comisión (rol ADMIN).
export async function asignarProfesorComision(comisionId: string, profesorId: string, cargo: CargoDocente): Promise<ProfesorAsignado> {
  await getAuthService().me();
  return parseResponse(
    profesorAsignadoSchema,
    await requestJson(`/comisiones/${encodeURIComponent(comisionId)}/profesores/${encodeURIComponent(profesorId)}`, {
      method: "PUT",
      body: { cargo },
    })
  );
}

export async function quitarProfesorComision(comisionId: string, profesorId: string): Promise<void> {
  await getAuthService().me();
  await requestJson(`/comisiones/${encodeURIComponent(comisionId)}/profesores/${encodeURIComponent(profesorId)}`, {
    method: "DELETE",
  });
}

// Altas administrativas (rol ADMIN). El backend valida de nuevo todo lo que el formulario ya
// comprueba y devuelve 409 en duplicados, 404 si la materia/cursada no existe.

export function crearProfesor(input: { nombreCompleto: string }): Promise<Profesor> {
  return getAuthService().protectedPost("/profesores", input, profesorSchema);
}
export function crearCursada(input: { materiaId: string; anio: number; cuatrimestre: Cuatrimestre }): Promise<Cursada> {
  return getAuthService().protectedPost("/cursadas", input, cursadaSchema);
}
export function crearComision(input: { cursadaId: string; carrera: Carrera; numero: number }): Promise<Comision> {
  return getAuthService().protectedPost("/comisiones", input, comisionSchema);
}
