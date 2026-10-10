import type { Materia } from "../../domain/materia.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const MATERIA_REPOSITORY = Symbol("MATERIA_REPOSITORY");

export interface CreateMateriaInput {
  nombre: string;
}

export interface MateriaRepository {
  findAll(pagination: Pagination): Promise<PaginatedResult<Materia>>;
  findById(id: string): Promise<Materia | null>;
  findByNombre(nombre: string): Promise<Materia | null>;
  create(input: CreateMateriaInput): Promise<Materia>;
}
