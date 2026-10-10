import type { Role } from "@/types/auth";
import { getAuthService } from "./auth";
import { toQuery, type PaginatedResult, type PaginationInput } from "./pagination";

/** `PublicUser` del backend: nunca incluye `passwordHash`. */
export interface UsuarioRegistrado { id: string; email: string; displayName: string; role: Role; createdAt: string }

export function listarUsuarios(pagination: PaginationInput = {}): Promise<PaginatedResult<UsuarioRegistrado>> {
  return getAuthService().protectedGet(`/users${toQuery(pagination)}`);
}
