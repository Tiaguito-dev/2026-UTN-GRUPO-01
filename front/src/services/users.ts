import type { Role } from "@/types/auth";
import { getAuthService } from "./auth";
import { paginatedSchema, usuarioRegistradoSchema } from "./schemas";
import { toQuery, type PaginatedResult, type PaginationInput } from "./pagination";
import { requestJson } from "./http";
import { parseResponse } from "./schemas";

/** `PublicUser` del backend: nunca incluye `passwordHash`. */
export interface UsuarioRegistrado { id: string; email: string; displayName: string; role: Role; createdAt: string; disabledAt: string | null }
export type EstadoUsuario = "ACTIVO" | "INACTIVO";
export interface UsuariosFilters { q?: string; rol?: Role; estado?: EstadoUsuario }

export function listarUsuarios(input: PaginationInput & UsuariosFilters = {}): Promise<PaginatedResult<UsuarioRegistrado>> {
  const query = new URLSearchParams(toQuery(input).slice(1));
  if (input.q?.trim()) query.set("q", input.q.trim());
  if (input.rol) query.set("rol", input.rol);
  if (input.estado) query.set("estado", input.estado);
  return getAuthService().protectedGet(`/users${query.size ? `?${query}` : ""}`, paginatedSchema(usuarioRegistradoSchema));
}
export async function cambiarEstadoUsuario(id: string, activo: boolean): Promise<UsuarioRegistrado> {
  await getAuthService().me();
  return parseResponse(usuarioRegistradoSchema, await requestJson(`/users/${encodeURIComponent(id)}/estado`, { method: "PATCH", body: { activo } }));
}
