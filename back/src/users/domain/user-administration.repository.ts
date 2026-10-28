import type { Pagination, PaginatedResult } from "../../shared/domain/pagination.js";
import type { PublicUser } from "./user.js";

export type UsuarioAdministrativo = PublicUser & { disabledAt: Date | null };
export interface UserFilters { q?: string; rol?: "ADMIN" | "USER"; estado?: "ACTIVO" | "INACTIVO" }
export interface UserHistoryEntry {
  id: string; actorId: string; accion: string; createdAt: Date;
  cambios: { campo: string; anterior: string | null; nuevo: string | null }[];
}

export const USER_ADMINISTRATION_REPOSITORY = Symbol("USER_ADMINISTRATION_REPOSITORY");
export interface UserAdministrationRepository {
  setActive(id: string, activo: boolean, actorId: string): Promise<UsuarioAdministrativo>;
  findHistorial(id: string, pagination: Pagination): Promise<PaginatedResult<UserHistoryEntry>>;
}
