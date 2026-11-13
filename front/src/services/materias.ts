import { getAuthService } from "./auth";
import { requestJson } from "./http";
import { materiaConValoracionSchema, materiaHistorialSchema, materiaSchema, paginatedSchema, parseResponse } from "./schemas";
import { MAX_PAGE_SIZE, toQuery, type PaginatedResult, type PaginationInput } from "./pagination";
import type { AnioCarrera, Carrera, NivelElectiva, Materia, MateriaConValoracion, MateriaInput, MateriaHistorial } from "@/types/materias";

export function listarMaterias(input: PaginationInput & { carrera?: Carrera; anioCarrera?: AnioCarrera; q?: string; nivelElectiva?: NivelElectiva } = {}): Promise<PaginatedResult<MateriaConValoracion>> {
  const query = new URLSearchParams(toQuery({ page: input.page, pageSize: Math.min(MAX_PAGE_SIZE, input.pageSize ?? 9) }));
  if (input.carrera) query.set("carrera", input.carrera);
  if (input.anioCarrera) query.set("anioCarrera", input.anioCarrera);
  if (input.q?.trim()) query.set("q", input.q.trim());
  if (input.anioCarrera === "ELECTIVA" && input.nivelElectiva) query.set("nivelElectiva", input.nivelElectiva);
  return getAuthService().protectedGet(`/materias?${query}`, paginatedSchema(materiaConValoracionSchema));
}
export function obtenerMateria(id: string): Promise<MateriaConValoracion> { return getAuthService().protectedGet(`/materias/${encodeURIComponent(id)}`, materiaConValoracionSchema); }
export function crearMateria(input: MateriaInput): Promise<Materia> { return getAuthService().protectedPost("/materias", input, materiaSchema); }
export async function actualizarMateria(id: string, input: Partial<MateriaInput>): Promise<Materia> {
  await getAuthService().me();
  return parseResponse(materiaSchema, await requestJson(`/materias/${encodeURIComponent(id)}`, { method: "PATCH", body: input }));
}
export function listarHistorialMateria(id: string, pagination: PaginationInput = {}): Promise<PaginatedResult<MateriaHistorial>> {
  return getAuthService().protectedGet(`/materias/${encodeURIComponent(id)}/historial${toQuery({ page: pagination.page, pageSize: pagination.pageSize ?? 3 })}`, paginatedSchema(materiaHistorialSchema));
}
