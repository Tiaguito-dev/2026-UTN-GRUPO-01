import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import type { Materia } from "../domain/materia.js";
import type { MateriaRepository } from "./ports/materia.repository.js";

export class ListarMaterias {
  constructor(private readonly materias: MateriaRepository) {}

  async execute(paginationInput: unknown): Promise<PaginatedResult<Materia>> {
    const pagination = validatePagination(paginationInput);
    return this.materias.findAll(pagination);
  }
}
