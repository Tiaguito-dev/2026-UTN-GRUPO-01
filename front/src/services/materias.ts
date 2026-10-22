import { getAuthService } from "./auth";
import { requestJson } from "./http";
import { toQuery, type PaginatedResult, type PaginationInput } from "./pagination";
import type { AnioCarrera, NivelElectiva, Materia, MateriaInput, MateriaHistorial } from "@/types/materias";
export function listarMaterias(input: PaginationInput & { anioCarrera?: AnioCarrera; q?: string; nivelElectiva?: NivelElectiva } = {}): Promise<PaginatedResult<Materia>> {
  const query = new URLSearchParams(toQuery({ page: input.page, pageSize: Math.min(9, input.pageSize ?? 9) }));
  if (input.anioCarrera) query.set("anioCarrera", input.anioCarrera);
  if (input.q?.trim()) query.set("q", input.q.trim());
  if (input.anioCarrera === "ELECTIVA" && input.nivelElectiva) query.set("nivelElectiva", input.nivelElectiva);
  return getAuthService().protectedGet(`/materias?${query}`);
}
export function obtenerMateria(id: string): Promise<Materia> { return getAuthService().protectedGet(`/materias/${encodeURIComponent(id)}`); }
export function crearMateria(input: MateriaInput): Promise<Materia> { return getAuthService().protectedPost("/materias", input); }
export async function actualizarMateria(id: string, input: Partial<MateriaInput>): Promise<Materia> {
  await getAuthService().me();
  return requestJson(`/materias/${encodeURIComponent(id)}`, { method: "PATCH", body: input });
}
export function listarHistorialMateria(id: string, pagination: PaginationInput = {}): Promise<PaginatedResult<MateriaHistorial>> {
  return getAuthService().protectedGet(`/materias/${encodeURIComponent(id)}/historial${toQuery({ page: pagination.page, pageSize: pagination.pageSize ?? 3 })}`);
}
