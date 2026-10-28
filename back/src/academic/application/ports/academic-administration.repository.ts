import type { PaginatedResult, Pagination } from "../../../shared/domain/pagination.js";

export const ACADEMIC_ADMINISTRATION_REPOSITORY = Symbol("ACADEMIC_ADMINISTRATION_REPOSITORY");
export type AcademicEntity = "materia" | "profesor" | "cursada" | "comision";
export interface AcademicHistoryChange { campo: string; anterior: string | null; nuevo: string | null }
export interface AcademicHistoryEntry {
  id: string;
  actorId: string;
  accion: string;
  cambios: AcademicHistoryChange[];
  createdAt: Date;
}
export interface AcademicAdministrationRepository {
  eliminar(entidad: AcademicEntity, id: string, actorId: string): Promise<void>;
  historial(entidad: AcademicEntity, id: string, pagination: Pagination): Promise<PaginatedResult<AcademicHistoryEntry>>;
}
