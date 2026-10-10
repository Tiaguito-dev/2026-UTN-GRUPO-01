import type { Profesor } from "../../domain/profesor.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const PROFESOR_REPOSITORY = Symbol("PROFESOR_REPOSITORY");

export interface CreateProfesorInput {
  nombreCompleto: string;
}

export interface ProfesorRepository {
  findAll(pagination: Pagination): Promise<PaginatedResult<Profesor>>;
  findById(id: string): Promise<Profesor | null>;
  // Sin findByNombreCompleto a propósito: los homónimos son válidos (no hay restricción única).
  create(input: CreateProfesorInput): Promise<Profesor>;
}
