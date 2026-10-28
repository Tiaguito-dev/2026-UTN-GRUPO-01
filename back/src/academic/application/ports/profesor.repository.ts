import type { Profesor } from "../../domain/profesor.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const PROFESOR_REPOSITORY = Symbol("PROFESOR_REPOSITORY");

export interface CreateProfesorInput {
  nombreCompleto: string;
}
export interface ProfesorFilters { q?: string }

export interface ProfesorRepository {
  findAll(pagination: Pagination, filters?: ProfesorFilters): Promise<PaginatedResult<Profesor>>;
  findById(id: string): Promise<Profesor | null>;
  // Sin findByNombreCompleto a propósito: los homónimos son válidos (no hay restricción única).
  update(id: string, input: Partial<CreateProfesorInput>, actorId?: string): Promise<Profesor>;
  create(input: CreateProfesorInput): Promise<Profesor>;
}
